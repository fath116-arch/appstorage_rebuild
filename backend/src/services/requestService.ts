/**
 * Request & Quick Approval Service (FieldOps Inventory v2 - Tahap 6)
 * Alur Request Teknisi & Persetujuan Cepat Atomik (1 Approval Cukup)
 */

import { executeQuery, runTransaction } from '../db/database';
import { ActivityLogService } from './activityLogService';
import { CatalogService } from './catalogService';
import { StockService } from './stockService';
import { ConfirmationService } from './confirmationService';
import crypto from 'crypto';

export interface RequestRecord {
  id: string;
  pemohon_id: string;
  penyetuju_id?: string | null;
  tipe_id: number;
  box_id?: string | null;
  kode_id?: string | null;
  jumlah: number;
  alasan: string;
  catatan_penolakan?: string | null;
  status: 'menunggu' | 'disetujui' | 'ditolak';
  dibuat_pada: string;
  diproses_pada?: string | null;
  nama_pemohon?: string;
  nama_penyetuju?: string;
  nama_tipe?: string;
  nama_produk?: string;
  kode_box?: string;
}

export class RequestService {
  /**
   * Membuat permohonan barang baru oleh Teknisi / User
   */
  static async createRequest(input: {
    pemohonId: string;
    tipeId: number;
    boxId?: string;
    kodeId?: string;
    jumlah?: number;
    alasan: string;
  }): Promise<RequestRecord> {
    if (!input.alasan || input.alasan.trim().length === 0) {
      throw new Error('Alasan permohonan wajib diisi.');
    }

    const tipe = await CatalogService.getTipeById(input.tipeId);
    if (!tipe) {
      throw new Error(`Tipe #${input.tipeId} tidak ditemukan di katalog.`);
    }

    const qty = input.jumlah && input.jumlah > 0 ? input.jumlah : 1;
    const requestId = `req-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    await executeQuery(
      `INSERT INTO request (id, pemohon_id, tipe_id, box_id, kode_id, jumlah, alasan, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'menunggu')`,
      [
        requestId,
        input.pemohonId,
        input.tipeId,
        input.boxId ? input.boxId.trim() : null,
        input.kodeId ? input.kodeId.trim() : null,
        qty,
        input.alasan.trim()
      ]
    );

    await ActivityLogService.recordActivity({
      aksi: 'buat_request',
      pelaku_id: input.pemohonId,
      request_id: requestId,
      catatan: `Membuat permohonan barang: ${tipe.produk_nama} - ${tipe.nama_tipe} (${qty} unit)`
    });

    // Tahap 8: Kirim Notifikasi WhatsApp Fonnte ke Developer, Admin, dan Admin Gudang
    // (Asinkron & non-fatal, kegagalan tidak membatalkan transaksi)
    const { NotificationService } = await import('./notificationService');
    NotificationService.notifyNewRequest({
      requestId,
      pemohonId: input.pemohonId,
      produkNama: tipe.produk_nama || 'Produk',
      tipeNama: tipe.nama_tipe,
      jumlah: qty,
      alasan: input.alasan.trim()
    }).catch(e => console.warn('[RequestService] Non-fatal notification error:', e.message));

    const created = await this.getRequestById(requestId);
    return created!;
  }

  /**
   * Mengambil detail request berdasarkan ID
   */
  static async getRequestById(id: string): Promise<RequestRecord | null> {
    const sql = `
      SELECT r.*,
             u1.name as nama_pemohon, u1.username as username_pemohon,
             u2.name as nama_penyetuju, u2.username as username_penyetuju,
             t.nama_tipe, p.nama as nama_produk, b.kode as kode_box
      FROM request r
      JOIN users u1 ON r.pemohon_id = u1.id
      LEFT JOIN users u2 ON r.penyetuju_id = u2.id
      JOIN tipe t ON r.tipe_id = t.id
      JOIN produk p ON t.produk_id = p.id
      LEFT JOIN box b ON r.box_id = b.id
      WHERE r.id = ?
    `;

    const rows = await executeQuery<any>(sql, [id]);
    if (!rows || rows.length === 0) return null;
    return rows[0];
  }

  /**
   * Mengambil daftar seluruh request (dengan filter status / pemohon / search)
   */
  static async listRequests(filters?: {
    pemohonId?: string;
    status?: 'menunggu' | 'disetujui' | 'ditolak';
    search?: string;
  }): Promise<RequestRecord[]> {
    let sql = `
      SELECT r.*,
             u1.name as nama_pemohon, u1.username as username_pemohon,
             u2.name as nama_penyetuju, u2.username as username_penyetuju,
             t.nama_tipe, p.nama as nama_produk, b.kode as kode_box
      FROM request r
      JOIN users u1 ON r.pemohon_id = u1.id
      LEFT JOIN users u2 ON r.penyetuju_id = u2.id
      JOIN tipe t ON r.tipe_id = t.id
      JOIN produk p ON t.produk_id = p.id
      LEFT JOIN box b ON r.box_id = b.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filters?.pemohonId) {
      sql += ' AND r.pemohon_id = ?';
      params.push(filters.pemohonId);
    }

    if (filters?.status) {
      sql += ' AND r.status = ?';
      params.push(filters.status);
    }

    if (filters?.search) {
      sql += ' AND (UPPER(p.nama) LIKE UPPER(?) OR UPPER(t.nama_tipe) LIKE UPPER(?) OR UPPER(u1.name) LIKE UPPER(?) OR UPPER(r.alasan) LIKE UPPER(?))';
      const q = `%${filters.search.trim()}%`;
      params.push(q, q, q, q);
    }

    sql += ' ORDER BY r.dibuat_pada DESC';

    const list = await executeQuery<any>(sql, params);
    return list;
  }

  /**
   * Persetujuan Cepat Atomik (1 Approval Cukup) + Auto Deduct Stok
   */
  static async approveRequest(input: {
    requestId: string;
    penyetujuId: string;
    confirmationToken?: string;
    targetBoxId?: string;
  }) {
    const req = await this.getRequestById(input.requestId);
    if (!req) {
      throw new Error(`Permohonan #${input.requestId} tidak ditemukan.`);
    }

    if (req.status !== 'menunggu') {
      throw new Error(`Permohonan ini sudah diproses sebelumnya (Status saat ini: ${req.status.toUpperCase()}).`);
    }

    // Verifikasi Token Konfirmasi Server Tier 2 (request_approve) jika dikirim
    if (input.confirmationToken) {
      const validation = await ConfirmationService.consumeConfirmationToken(
        input.confirmationToken,
        input.penyetujuId,
        'request_approve',
        input.requestId
      );
      if (!validation.valid) {
        throw new Error(`Konfirmasi Tingkat 2 gagal: ${validation.message}`);
      }
    }

    // Eksekusi Pembaruan Status & Out Stock secara Atomik
    return await runTransaction(async (conn) => {
      // 1. Pembaruan Atomik: UPDATE ... WHERE status = 'menunggu' (Mencegah Double Approval Race Condition)
      const updateRes = await conn.query(
        `UPDATE request
         SET status = 'disetujui', penyetuju_id = ?, diproses_pada = NOW()
         WHERE id = ? AND status = 'menunggu'`,
        [input.penyetujuId, input.requestId]
      );

      const affected = typeof updateRes.affectedRows === 'number' ? updateRes.affectedRows : 1;
      if (affected === 0) {
        throw new Error('Permohonan sudah disetujui atau diproses oleh pengelola lain.');
      }

      // 2. Auto Deduct Stok
      let autoDeductResult: any = null;
      let usedBoxId = req.box_id || input.targetBoxId;

      if (req.kode_id) {
        // Otomatis keluarkan item ber-ID
        autoDeductResult = await StockService.barangKeluarSingle({
          kodeId: req.kode_id,
          userId: input.penyetujuId,
          catatan: `Barang keluar dari persetujuan Request #${input.requestId}`
        });
      } else {
        // Bila box_id belum ditentukan, cari box yang memiliki stok untuk tipe ini
        if (!usedBoxId) {
          const tipeItems = await StockService.getItemsByTipe(req.tipe_id);
          if (tipeItems.items && tipeItems.items.length > 0) {
            // Pilih box dari item fisik aktif pertama
            usedBoxId = tipeItems.items[0].box_id;
            autoDeductResult = await StockService.barangKeluarSingle({
              itemId: tipeItems.items[0].id,
              userId: input.penyetujuId,
              catatan: `Barang keluar otomatis dari persetujuan Request #${input.requestId}`
            });
          } else if (tipeItems.stokJumlah && tipeItems.stokJumlah.length > 0) {
            // Pilih box stok jumlah pertama
            usedBoxId = tipeItems.stokJumlah[0].box_id;
            autoDeductResult = await StockService.barangKeluarSingle({
              tipeId: req.tipe_id,
              boxId: usedBoxId,
              jumlah: Math.min(req.jumlah, tipeItems.stokJumlah[0].jumlah),
              userId: input.penyetujuId,
              catatan: `Stok jumlah keluar otomatis dari persetujuan Request #${input.requestId}`
            });
          } else {
            throw new Error(`Stok barang "${req.nama_produk} - ${req.nama_tipe}" tidak mencukupi untuk disetujui.`);
          }
        } else {
          // Kurangi stok jumlah di box pilihan
          autoDeductResult = await StockService.barangKeluarSingle({
            tipeId: req.tipe_id,
            boxId: usedBoxId,
            jumlah: req.jumlah,
            userId: input.penyetujuId,
            catatan: `Stok jumlah keluar dari persetujuan Request #${input.requestId}`
          });
        }
      }

      // 3. Catat Activity Log Persetujuan
      const txLog = await ActivityLogService.recordActivity({
        aksi: 'setujui_request',
        pelaku_id: input.penyetujuId,
        request_id: input.requestId,
        catatan: `Menyetujui permohonan #${input.requestId} (${req.nama_produk} - ${req.nama_tipe})`,
        details: autoDeductResult?.activityId ? undefined : [
          {
            tipe_id: req.tipe_id,
            item_id: null,
            kode_id: req.kode_id || null,
            nama_snapshot: `${req.nama_produk} - ${req.nama_tipe}`,
            jumlah: req.jumlah,
            status_sebelum: 'menunggu',
            status_sesudah: 'disetujui'
          }
        ]
      }, conn);

      return {
        success: true,
        message: `Permohonan #${input.requestId} berhasil DISETUJUI dan stok telah diperbarui.`,
        requestId: input.requestId,
        activityId: txLog.idAktivitas || (txLog as any).id_aktivitas,
        autoDeductResult
      };
    });
  }

  /**
   * Penolakan Request oleh Admin / Warehouse Admin / Developer
   */
  static async rejectRequest(input: {
    requestId: string;
    penyetujuId: string;
    catatanPenolakan?: string;
    confirmationToken?: string;
  }) {
    const req = await this.getRequestById(input.requestId);
    if (!req) {
      throw new Error(`Permohonan #${input.requestId} tidak ditemukan.`);
    }

    if (req.status !== 'menunggu') {
      throw new Error(`Permohonan ini sudah diproses sebelumnya (Status saat ini: ${req.status.toUpperCase()}).`);
    }

    // Verifikasi Token Konfirmasi Server Tier 2 (request_reject) jika dikirim
    if (input.confirmationToken) {
      const validation = await ConfirmationService.consumeConfirmationToken(
        input.confirmationToken,
        input.penyetujuId,
        'request_reject',
        input.requestId
      );
      if (!validation.valid) {
        throw new Error(`Konfirmasi Tingkat 2 gagal: ${validation.message}`);
      }
    }

    return await runTransaction(async (conn) => {
      // Pembaruan Atomik: UPDATE ... WHERE status = 'menunggu'
      const updateRes = await conn.query(
        `UPDATE request
         SET status = 'ditolak', penyetuju_id = ?, catatan_penolakan = ?, diproses_pada = NOW()
         WHERE id = ? AND status = 'menunggu'`,
        [input.penyetujuId, input.catatanPenolakan ? input.catatanPenolakan.trim() : 'Permohonan ditolak oleh admin.', input.requestId]
      );

      const affected = typeof updateRes.affectedRows === 'number' ? updateRes.affectedRows : 1;
      if (affected === 0) {
        throw new Error('Permohonan sudah disetujui atau diproses oleh pengelola lain.');
      }

      const txLog = await ActivityLogService.recordActivity({
        aksi: 'tolak_request',
        pelaku_id: input.penyetujuId,
        request_id: input.requestId,
        catatan: `Menolak permohonan #${input.requestId}: ${input.catatanPenolakan || 'Tanpa catatan'}`
      }, conn);

      return {
        success: true,
        message: `Permohonan #${input.requestId} telah DITOLAK.`,
        requestId: input.requestId,
        activityId: txLog.idAktivitas || (txLog as any).id_aktivitas
      };
    });
  }
}
