/**
 * Request, Reservation, Pickup & Mandatory Return Service
 * FieldOps IT — Single Canonical Flow
 * Alur Status: diajukan (menunggu) -> disetujui (reservasi 'dipesan') -> diambil ('keluar') -> dikembalikan (wajib untuk Alat) | ditolak | dibatalkan
 */

import { executeQuery, runTransaction } from '../db/database';
import { ActivityDetailInput, ActivityLogService } from './activityLogService';
import { CatalogService } from './catalogService';
import { StockService } from './stockService';
import { ConfirmationService } from './confirmationService';
import { canActOnBehalf, isWarehouseManager } from '../utils/permissions';
import { toMysqlUtcDatetime, validateOccurredAt } from '../utils/timezone';
import crypto from 'crypto';

export type RequestStatus = 'diajukan' | 'menunggu' | 'disetujui' | 'diambil' | 'dikembalikan' | 'ditolak' | 'dibatalkan';

export interface RequestRecord {
  id: string;
  pemohon_id: string;
  actor_id?: string | null;
  recorded_by_id?: string | null;
  penyetuju_id?: string | null;
  tipe_id: number;
  box_id?: string | null;
  kode_id?: string | null;
  jumlah: number;
  alasan: string;
  catatan_penolakan?: string | null;
  status: RequestStatus;
  dibuat_pada: string;
  diproses_pada?: string | null;
  taken_at?: string | null;
  returned_at?: string | null;
  returned_by_id?: string | null;
  return_condition?: string | null;
  return_notes?: string | null;
  return_box_id?: string | null;
  return_box_kode?: string | null;
  allocated_item_ids?: string | null;
  transaction_out_id?: string | null;
  transaction_in_id?: string | null;
  nama_pemohon?: string;
  username_pemohon?: string;
  nama_penyetuju?: string;
  username_penyetuju?: string;
  nama_tipe?: string;
  nama_produk?: string;
  kategori_barang?: 'Alat' | 'Barang Habis Pakai';
  tipe_stok?: string;
  mode_stok?: 'per_id' | 'jumlah';
  kode_box?: string;
  held_duration_ms?: number | null;
}

export class RequestService {
  /**
   * Membuat permohonan barang baru (Status awal: 'diajukan')
   * Teknisi hanya boleh membuat untuk dirinya sendiri; Pengelola boleh atas nama teknisi.
   */
  static async createRequest(input: {
    pemohonId: string;
    actorId?: string;
    actorRole?: string;
    recordedByRole?: string;
    onBehalfReason?: string;
    tipeId: number;
    boxId?: string;
    kodeId?: string;
    jumlah?: number;
    alasan: string;
  }): Promise<RequestRecord> {
    if (!input.alasan || input.alasan.trim().length === 0) {
      throw new Error('Alasan permohonan wajib diisi.');
    }

    const effectiveActorId = (input.actorId || input.pemohonId).trim();
    const isOnBehalf = effectiveActorId !== input.pemohonId;
    if (isOnBehalf && !canActOnBehalf(input.recordedByRole || input.actorRole)) {
      throw new Error('Hanya pengelola gudang / admin yang dapat membuat permohonan atas nama teknisi lain.');
    }
    if (isOnBehalf && (!input.onBehalfReason || input.onBehalfReason.trim().length < 3)) {
      throw new Error('Alasan pengajuan atas nama teknisi lain wajib diisi.');
    }

    const tipe = await CatalogService.getTipeById(input.tipeId);
    if (!tipe) {
      throw new Error(`Tipe #${input.tipeId} tidak ditemukan di katalog.`);
    }

    // Validasi ketersediaan item fisik jika kodeId dipilih
    if (input.kodeId) {
      const itemCheck = await StockService.checkDuplicateKodeId(input.kodeId.trim());
      if (!itemCheck.exists || !itemCheck.item) {
        throw new Error(`Item "${input.kodeId.trim()}" tidak ditemukan.`);
      }
      if (itemCheck.item.status !== 'aktif') {
        throw new Error(`Item "${input.kodeId.trim()}" saat ini berstatus ${itemCheck.item.status.toUpperCase()} dan tidak dapat diajukan.`);
      }
      if (itemCheck.item.kondisi === 'Rusak') {
        throw new Error(`Item "${input.kodeId.trim()}" dalam kondisi Rusak dan tidak dapat dipilih untuk permohonan teknisi.`);
      }
    }

    const qty = input.jumlah && input.jumlah > 0 ? input.jumlah : 1;
    const requestId = `req-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    await executeQuery(
      `INSERT INTO request (id, pemohon_id, tipe_id, box_id, kode_id, jumlah, alasan, status, actor_id, recorded_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        requestId,
        effectiveActorId,
        input.tipeId,
        input.boxId ? input.boxId.trim() : null,
        input.kodeId ? input.kodeId.trim() : null,
        qty,
        input.alasan.trim(),
        'diajukan',
        effectiveActorId,
        input.pemohonId
      ]
    );

    await ActivityLogService.recordActivity({
      aksi: 'buat_request',
      pelaku_id: input.pemohonId,
      actor_id: effectiveActorId,
      recorded_by_id: input.pemohonId,
      recorded_by_role: input.recordedByRole,
      on_behalf_reason: isOnBehalf ? input.onBehalfReason : null,
      request_id: requestId,
      tipe_mutasi: 'SYSTEM',
      reference_type: 'REQUEST_CREATE',
      reference_number: requestId,
      catatan: `Membuat permohonan barang: ${tipe.produk_nama} - ${tipe.nama_tipe} (${qty} unit)`
    });

    const { NotificationService } = await import('./notificationService');
    NotificationService.notifyNewRequest({
      requestId,
      pemohonId: effectiveActorId,
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
             t.nama_tipe, t.mode_stok, p.nama as nama_produk, p.kategori_barang, p.tipe_stok,
             b.kode as kode_box, rb.kode as return_box_kode
      FROM request r
      JOIN users u1 ON COALESCE(r.actor_id, r.pemohon_id) = u1.id
      LEFT JOIN users u2 ON r.penyetuju_id = u2.id
      JOIN tipe t ON r.tipe_id = t.id
      JOIN produk p ON t.produk_id = p.id
      LEFT JOIN box b ON r.box_id = b.id
      LEFT JOIN box rb ON r.return_box_id = rb.id
      WHERE r.id = ?
    `;

    const rows = await executeQuery<RequestRecord>(sql, [id]);
    if (!rows || rows.length === 0) return null;
    return this.attachHeldDuration(rows[0]);
  }

  private static attachHeldDuration(row: RequestRecord): RequestRecord {
    let heldMs: number | null = null;
    if (row.taken_at) {
      const start = new Date(row.taken_at).getTime();
      const end = row.returned_at ? new Date(row.returned_at).getTime() : Date.now();
      if (!isNaN(start) && !isNaN(end)) {
        heldMs = Math.max(0, end - start);
      }
    }
    return {
      ...row,
      kategori_barang: row.kategori_barang || 'Barang Habis Pakai',
      tipe_stok: row.tipe_stok || 'unit',
      held_duration_ms: heldMs
    };
  }

  /**
   * Mengambil daftar request dengan filter status / pemohon / search
   */
  static async listRequests(filters?: {
    pemohonId?: string;
    status?: RequestStatus | 'all';
    search?: string;
  }): Promise<RequestRecord[]> {
    let sql = `
      SELECT r.*,
             u1.name as nama_pemohon, u1.username as username_pemohon,
             u2.name as nama_penyetuju, u2.username as username_penyetuju,
             t.nama_tipe, t.mode_stok, p.nama as nama_produk, p.kategori_barang, p.tipe_stok,
             b.kode as kode_box, rb.kode as return_box_kode
      FROM request r
      JOIN users u1 ON COALESCE(r.actor_id, r.pemohon_id) = u1.id
      LEFT JOIN users u2 ON r.penyetuju_id = u2.id
      JOIN tipe t ON r.tipe_id = t.id
      JOIN produk p ON t.produk_id = p.id
      LEFT JOIN box b ON r.box_id = b.id
      LEFT JOIN box rb ON r.return_box_id = rb.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filters?.pemohonId) {
      sql += ' AND (r.pemohon_id = ? OR r.actor_id = ?)';
      params.push(filters.pemohonId, filters.pemohonId);
    }

    if (filters?.status && filters.status !== 'all') {
      if (filters.status === 'diajukan' || filters.status === 'menunggu') {
        sql += " AND r.status IN ('diajukan', 'menunggu')";
      } else {
        sql += ' AND r.status = ?';
        params.push(filters.status);
      }
    }

    if (filters?.search) {
      sql += ' AND (UPPER(p.nama) LIKE UPPER(?) OR UPPER(t.nama_tipe) LIKE UPPER(?) OR UPPER(u1.name) LIKE UPPER(?) OR UPPER(r.alasan) LIKE UPPER(?))';
      const q = `%${filters.search.trim()}%`;
      params.push(q, q, q, q);
    }

    sql += ' ORDER BY r.dibuat_pada DESC';

    const list = await executeQuery<RequestRecord>(sql, params);
    return list.map(r => this.attachHeldDuration(r));
  }

  /**
   * Daftar request aktif/terbuka untuk teknisi tertentu (untuk 1-klik "Hubungkan ke Request" saat Output atas nama)
   */
  static async listOpenRequestsForActor(actorId: string): Promise<RequestRecord[]> {
    const sql = `
      SELECT r.*,
             u1.name as nama_pemohon, u1.username as username_pemohon,
             u2.name as nama_penyetuju, u2.username as username_penyetuju,
             t.nama_tipe, t.mode_stok, p.nama as nama_produk, p.kategori_barang, p.tipe_stok,
             b.kode as kode_box
      FROM request r
      JOIN users u1 ON COALESCE(r.actor_id, r.pemohon_id) = u1.id
      LEFT JOIN users u2 ON r.penyetuju_id = u2.id
      JOIN tipe t ON r.tipe_id = t.id
      JOIN produk p ON t.produk_id = p.id
      LEFT JOIN box b ON r.box_id = b.id
      WHERE (r.pemohon_id = ? OR r.actor_id = ?)
        AND r.status IN ('menunggu', 'diajukan', 'disetujui')
      ORDER BY r.dibuat_pada DESC
    `;
    const list = await executeQuery<RequestRecord>(sql, [actorId, actorId]);
    return list.map(r => this.attachHeldDuration(r));
  }

  /**
   * Daftar "Barang di Tangan Teknisi" (request berstatus 'diambil')
   */
  static async listHeldByTechnicians(filters?: { actorId?: string }): Promise<RequestRecord[]> {
    let sql = `
      SELECT r.*,
             u1.name as nama_pemohon, u1.username as username_pemohon,
             u2.name as nama_penyetuju, u2.username as username_penyetuju,
             t.nama_tipe, t.mode_stok, p.nama as nama_produk, p.kategori_barang, p.tipe_stok,
             b.kode as kode_box
      FROM request r
      JOIN users u1 ON COALESCE(r.actor_id, r.pemohon_id) = u1.id
      LEFT JOIN users u2 ON r.penyetuju_id = u2.id
      JOIN tipe t ON r.tipe_id = t.id
      JOIN produk p ON t.produk_id = p.id
      LEFT JOIN box b ON r.box_id = b.id
      WHERE r.status = 'diambil'
    `;
    const params: any[] = [];
    if (filters?.actorId) {
      sql += ' AND (r.pemohon_id = ? OR r.actor_id = ?)';
      params.push(filters.actorId, filters.actorId);
    }
    sql += ' ORDER BY COALESCE(r.taken_at, r.diproses_pada, r.dibuat_pada) ASC';
    const list = await executeQuery<RequestRecord>(sql, params);
    return list.map(r => this.attachHeldDuration(r));
  }

  /**
   * Timeline Activity Log untuk satu Request tertentu
   */
  static async getRequestTimeline(requestId: string) {
    return await ActivityLogService.getTransactionsFeed({ requestId, limit: 100 });
  }

  /**
   * Persetujuan Cepat Atomik: mengunci stok via reservasi ('dipesan' / reserved_qty) agar tidak diambil ganda sebelum pickup!
   */
  static async approveRequest(input: {
    requestId: string;
    penyetujuId: string;
    penyetujuRole?: string;
    confirmationToken?: string;
    targetBoxId?: string;
  }) {
    const req = await this.getRequestById(input.requestId);
    if (!req) {
      throw new Error(`Permohonan #${input.requestId} tidak ditemukan.`);
    }

    if (req.status !== 'menunggu' && req.status !== 'diajukan') {
      throw new Error(`Permohonan ini sudah diproses sebelumnya (Status saat ini: ${req.status.toUpperCase()}).`);
    }

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

    return await runTransaction(async (conn) => {
      const targetActorId = req.actor_id || req.pemohon_id;
      const allocatedIds: string[] = [];
      let usedBoxId = req.box_id || input.targetBoxId || null;

      if (req.kode_id) {
        const itemCheck = await StockService.checkDuplicateKodeId(req.kode_id);
        if (!itemCheck.exists || !itemCheck.item) {
          throw new Error(`Item "${req.kode_id}" tidak ditemukan di stok.`);
        }
        if (itemCheck.item.status !== 'aktif') {
          throw new Error(`Item "${req.kode_id}" saat ini berstatus ${itemCheck.item.status.toUpperCase()} dan tidak tersedia untuk dipesan.`);
        }
        if (itemCheck.item.kondisi === 'Rusak') {
          throw new Error(`Item "${req.kode_id}" dalam kondisi Rusak dan tidak dapat disetujui.`);
        }

        await conn.query(
          `UPDATE item SET status = 'dipesan', reserved_for_request_id = ?, reserved_for_user_id = ? WHERE id = ?`,
          [input.requestId, targetActorId, itemCheck.item.id]
        );
        allocatedIds.push(itemCheck.item.id);
        usedBoxId = usedBoxId || itemCheck.item.box_id;
      } else {
        const tipeItems = await StockService.getItemsByTipe(req.tipe_id, { excludeRusak: true });
        if (req.mode_stok === 'per_id' || (tipeItems.items && tipeItems.items.length > 0 && req.jumlah <= tipeItems.items.length)) {
          const candidates = usedBoxId
            ? tipeItems.items.filter(i => i.box_id === usedBoxId)
            : tipeItems.items;

          if (candidates.length < req.jumlah) {
            throw new Error(`Stok tersedia "${req.nama_produk} - ${req.nama_tipe}" tidak mencukupi (Tersedia: ${candidates.length}, Diminta: ${req.jumlah}).`);
          }
          const picked = candidates.slice(0, req.jumlah);
          for (const it of picked) {
            await conn.query(
              `UPDATE item SET status = 'dipesan', reserved_for_request_id = ?, reserved_for_user_id = ? WHERE id = ?`,
              [input.requestId, targetActorId, it.id]
            );
            allocatedIds.push(it.id);
          }
          usedBoxId = usedBoxId || picked[0].box_id;
        } else {
          // Stok jumlah (TANPA_ID)
          const sjCandidates = usedBoxId
            ? tipeItems.stokJumlah.filter(s => s.box_id === usedBoxId)
            : tipeItems.stokJumlah;

          const chosenSj = sjCandidates.find(s => (s.jumlah - (s.reserved_qty || 0)) >= req.jumlah);
          if (!chosenSj) {
            throw new Error(`Stok tersedia "${req.nama_produk} - ${req.nama_tipe}" tidak mencukupi untuk dipesan (${req.jumlah} unit).`);
          }
          usedBoxId = chosenSj.box_id;
          await conn.query(
            `UPDATE stok_jumlah SET reserved_qty = COALESCE(reserved_qty, 0) + ? WHERE tipe_id = ? AND box_id = ?`,
            [req.jumlah, req.tipe_id, usedBoxId]
          );
        }
      }

      const updateRes = await conn.query(
        `UPDATE request
         SET status = 'disetujui', penyetuju_id = ?, diproses_pada = NOW(), allocated_item_ids = ?, box_id = ?
         WHERE id = ? AND status IN ('menunggu', 'diajukan')`,
        [
          input.penyetujuId,
          allocatedIds.length > 0 ? JSON.stringify(allocatedIds) : null,
          usedBoxId,
          input.requestId
        ]
      );

      const affected = typeof updateRes.affectedRows === 'number' ? updateRes.affectedRows : 1;
      if (affected === 0) {
        throw new Error('Permohonan sudah disetujui atau diproses oleh pengelola lain.');
      }

      const txLog = await ActivityLogService.recordActivity({
        aksi: 'setujui_request',
        pelaku_id: targetActorId,
        actor_id: targetActorId,
        recorded_by_id: input.penyetujuId,
        recorded_by_role: input.penyetujuRole || 'warehouse_admin',
        on_behalf_reason: targetActorId !== input.penyetujuId ? `Persetujuan & reservasi stok untuk Request #${input.requestId}` : null,
        penyetuju_id: input.penyetujuId,
        request_id: input.requestId,
        tipe_mutasi: 'SYSTEM',
        reference_type: 'REQUEST_APPROVE',
        reference_number: input.requestId,
        catatan: `Menyetujui & mereservasi stok untuk permohonan #${input.requestId} (${req.nama_produk} - ${req.nama_tipe})`,
        details: [
          {
            tipe_id: req.tipe_id,
            item_id: allocatedIds[0] || null,
            kode_id: req.kode_id || null,
            nama_snapshot: `${req.nama_produk} - ${req.nama_tipe}`,
            jumlah: req.jumlah,
            status_sebelum: req.status,
            status_sesudah: 'disetujui'
          }
        ]
      }, conn);

      return {
        success: true,
        message: `Permohonan #${input.requestId} DISETUJUI dan stok telah direservasi untuk teknisi.`,
        requestId: input.requestId,
        activityId: txLog.idAktivitas
      };
    });
  }

  /**
   * Penyerahan / Pickup barang oleh Teknisi: memindahkan 'disetujui' -> 'diambil' & mencatat transaksi OUT
   */
  static async pickupRequest(input: {
    requestId: string;
    recordedById: string;
    recordedByName?: string;
    recordedByRole?: string;
    occurredAt?: string;
    catatan?: string;
  }) {
    const req = await this.getRequestById(input.requestId);
    if (!req) {
      throw new Error(`Permohonan #${input.requestId} tidak ditemukan.`);
    }
    if (req.status !== 'disetujui') {
      throw new Error(`Hanya permohonan berstatus DISETUJUI yang dapat diserahkan/diambil (Status saat ini: ${req.status.toUpperCase()}).`);
    }

    const timeCheck = validateOccurredAt({ occurredAt: input.occurredAt, role: input.recordedByRole });
    if (!timeCheck.valid) {
      throw new Error(timeCheck.message || 'Waktu pengambilan tidak valid.');
    }

    return await runTransaction(async (conn) => {
      const targetActorId = req.actor_id || req.pemohon_id;
      const allocatedIds: string[] = req.allocated_item_ids
        ? (typeof req.allocated_item_ids === 'string' ? JSON.parse(req.allocated_item_ids) : req.allocated_item_ids)
        : [];

      const detailsPayload: ActivityDetailInput[] = [];
      let boxKode: string | null = req.kode_box || null;

      if (allocatedIds.length > 0) {
        for (const itId of allocatedIds) {
          const rows = await conn.query('SELECT * FROM item WHERE id = ?', [itId]);
          const it = rows[0];
          if (!it) continue;
          if (!boxKode) {
            const b = await StockService.getBoxById(it.box_id);
            if (b) boxKode = b.kode;
          }
          await conn.query('UPDATE item SET status = "keluar" WHERE id = ?', [it.id]);
          detailsPayload.push({
            tipe_id: req.tipe_id,
            item_id: it.id,
            kode_id: it.kode_id,
            nama_snapshot: `${req.nama_produk} - ${req.nama_tipe}`,
            jumlah: 1,
            status_sebelum: 'dipesan',
            status_sesudah: 'keluar'
          });
        }
      } else if (req.box_id) {
        if (!boxKode) {
          const b = await StockService.getBoxById(req.box_id);
          if (b) boxKode = b.kode;
        }
        await conn.query(
          'UPDATE stok_jumlah SET reserved_qty = GREATEST(0, COALESCE(reserved_qty, 0) - ?) WHERE tipe_id = ? AND box_id = ?',
          [req.jumlah, req.tipe_id, req.box_id]
        );
        await conn.query(
          'UPDATE stok_jumlah SET jumlah = jumlah - ? WHERE tipe_id = ? AND box_id = ?',
          [req.jumlah, req.tipe_id, req.box_id]
        );
        detailsPayload.push({
          tipe_id: req.tipe_id,
          item_id: null,
          kode_id: null,
          nama_snapshot: `${req.nama_produk} - ${req.nama_tipe}`,
          jumlah: req.jumlah,
          status_sebelum: 'dipesan',
          status_sesudah: 'keluar'
        });
      }

      const txLog = await ActivityLogService.recordActivity({
        aksi: 'ambil_request',
        pelaku_id: targetActorId,
        actor_id: targetActorId,
        actor_nama: req.nama_pemohon,
        recorded_by_id: input.recordedById,
        recorded_by_nama: input.recordedByName,
        recorded_by_role: input.recordedByRole,
        on_behalf_reason: targetActorId !== input.recordedById ? `Penyerahan barang Request #${req.id} kepada teknisi` : null,
        occurred_at: timeCheck.utcIso,
        request_id: req.id,
        tipe_mutasi: 'KELUAR',
        reference_type: 'REQUEST_PICKUP',
        reference_number: req.id,
        recipient_destination: req.nama_pemohon || targetActorId,
        qty_total: req.jumlah,
        box_asal: boxKode,
        catatan: input.catatan || `Pengambilan barang Request #${req.id} (${req.nama_produk} - ${req.nama_tipe}) oleh ${req.nama_pemohon}`,
        details: detailsPayload
      }, conn);

      await conn.query(
        `UPDATE request SET status = 'diambil', taken_at = ?, transaction_out_id = ?, allocated_item_ids = ? WHERE id = ?`,
        [
          timeCheck.mysqlDatetimeUtc,
          txLog.transaksiId,
          allocatedIds.length > 0 ? JSON.stringify(allocatedIds) : null,
          req.id
        ]
      );

      return {
        success: true,
        message: `Barang Request #${req.id} telah diserahkan dan kini berstatus DIAMBIL.`,
        requestId: req.id,
        activityId: txLog.idAktivitas,
        transaksiId: txLog.transaksiId
      };
    });
  }

  /**
   * Pengembalian barang dari Teknisi ('diambil' -> 'dikembalikan'), wajib untuk kategori Alat
   */
  static async returnRequest(input: {
    requestId: string;
    recordedById: string;
    recordedByName?: string;
    recordedByRole?: string;
    returnCondition: 'Baru' | 'Baik' | 'Perlu Perbaikan' | 'Rusak';
    returnNotes?: string;
    returnBoxId: string;
    occurredAt?: string;
  }) {
    const req = await this.getRequestById(input.requestId);
    if (!req) {
      throw new Error(`Permohonan #${input.requestId} tidak ditemukan.`);
    }
    if (req.status !== 'diambil') {
      throw new Error(`Hanya barang berstatus DIAMBIL yang dapat dikembalikan (Status saat ini: ${req.status.toUpperCase()}).`);
    }

    const targetBox = await StockService.getBoxById(input.returnBoxId);
    if (!targetBox) {
      throw new Error(`Box tujuan pengembalian "${input.returnBoxId}" tidak ditemukan.`);
    }

    const timeCheck = validateOccurredAt({ occurredAt: input.occurredAt, role: input.recordedByRole });
    if (!timeCheck.valid) {
      throw new Error(timeCheck.message || 'Waktu pengembalian tidak valid.');
    }

    return await runTransaction(async (conn) => {
      const targetActorId = req.actor_id || req.pemohon_id;
      const allocatedIds: string[] = req.allocated_item_ids
        ? (typeof req.allocated_item_ids === 'string' ? JSON.parse(req.allocated_item_ids) : req.allocated_item_ids)
        : [];

      const detailsPayload: ActivityDetailInput[] = [];

      if (allocatedIds.length > 0) {
        for (const itId of allocatedIds) {
          const rows = await conn.query('SELECT * FROM item WHERE id = ?', [itId]);
          const it = rows[0];
          if (!it) continue;
          await conn.query(
            `UPDATE item SET status = 'aktif', box_id = ?, kondisi = ?, catatan_kondisi = ? WHERE id = ?`,
            [targetBox.id, input.returnCondition, input.returnNotes ? input.returnNotes.trim() : null, it.id]
          );
          detailsPayload.push({
            tipe_id: req.tipe_id,
            item_id: it.id,
            kode_id: it.kode_id,
            nama_snapshot: `${req.nama_produk} - ${req.nama_tipe}`,
            jumlah: 1,
            status_sebelum: 'keluar',
            status_sesudah: 'aktif'
          });
        }
      } else {
        const sjRows = await conn.query(
          'SELECT * FROM stok_jumlah WHERE tipe_id = ? AND box_id = ?',
          [req.tipe_id, targetBox.id]
        );
        if (sjRows && sjRows.length > 0) {
          await conn.query(
            'UPDATE stok_jumlah SET jumlah = jumlah + ? WHERE tipe_id = ? AND box_id = ?',
            [req.jumlah, req.tipe_id, targetBox.id]
          );
        } else {
          await conn.query(
            'INSERT INTO stok_jumlah (tipe_id, box_id, jumlah) VALUES (?, ?, ?)',
            [req.tipe_id, targetBox.id, req.jumlah]
          );
        }
        detailsPayload.push({
          tipe_id: req.tipe_id,
          item_id: null,
          kode_id: null,
          nama_snapshot: `${req.nama_produk} - ${req.nama_tipe}`,
          jumlah: req.jumlah,
          status_sebelum: 'keluar',
          status_sesudah: 'aktif'
        });
      }

      const txLog = await ActivityLogService.recordActivity({
        aksi: req.kategori_barang === 'Alat' ? 'kembali_alat' : 'kembalikan_request',
        pelaku_id: targetActorId,
        actor_id: targetActorId,
        actor_nama: req.nama_pemohon,
        recorded_by_id: input.recordedById,
        recorded_by_nama: input.recordedByName,
        recorded_by_role: input.recordedByRole,
        on_behalf_reason: targetActorId !== input.recordedById ? `Pengembalian barang Request #${req.id} ke gudang` : null,
        occurred_at: timeCheck.utcIso,
        request_id: req.id,
        tipe_mutasi: 'MASUK',
        reference_type: 'REQUEST_RETURN',
        reference_number: req.id,
        recipient_destination: targetBox.kode,
        qty_total: req.jumlah,
        box_tujuan: targetBox.kode,
        catatan: `Pengembalian barang Request #${req.id} ke ${targetBox.kode} [Kondisi: ${input.returnCondition}]${input.returnNotes ? ` - ${input.returnNotes.trim()}` : ''}`,
        details: detailsPayload
      }, conn);

      await conn.query(
        `UPDATE request
         SET status = 'dikembalikan', returned_at = ?, returned_by_id = ?, return_condition = ?,
             return_notes = ?, return_box_id = ?, transaction_in_id = ?
         WHERE id = ?`,
        [
          timeCheck.mysqlDatetimeUtc,
          input.recordedById,
          input.returnCondition,
          input.returnNotes ? input.returnNotes.trim() : null,
          targetBox.id,
          txLog.transaksiId,
          req.id
        ]
      );

      return {
        success: true,
        message: `Barang Request #${req.id} berhasil dikembalikan ke ${targetBox.kode} [Kondisi: ${input.returnCondition}].`,
        requestId: req.id,
        activityId: txLog.idAktivitas,
        transaksiId: txLog.transaksiId
      };
    });
  }

  /**
   * Penolakan Request oleh Admin / Warehouse Admin / Developer (melepas reservasi jika ada)
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

    if (req.status !== 'menunggu' && req.status !== 'diajukan') {
      throw new Error(`Permohonan ini sudah diproses sebelumnya (Status saat ini: ${req.status.toUpperCase()}).`);
    }

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
      const updateRes = await conn.query(
        `UPDATE request
         SET status = 'ditolak', penyetuju_id = ?, catatan_penolakan = ?, diproses_pada = NOW()
         WHERE id = ? AND status IN ('menunggu', 'diajukan')`,
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
        tipe_mutasi: 'SYSTEM',
        reference_type: 'REQUEST_REJECT',
        reference_number: input.requestId,
        catatan: `Menolak permohonan #${input.requestId}: ${input.catatanPenolakan || 'Tanpa catatan'}`
      }, conn);

      return {
        success: true,
        message: `Permohonan #${input.requestId} telah DITOLAK.`,
        requestId: input.requestId,
        activityId: txLog.idAktivitas
      };
    });
  }

  /**
   * Pembatalan Request: teknisi bisa membatalkan pengajuan sendiri selama masih diajukan/menunggu;
   * pengelola bisa membatalkan hingga tahap disetujui & otomatis melepas stok 'dipesan'
   */
  static async cancelRequest(input: {
    requestId: string;
    userId: string;
    userRole: string;
    catatan?: string;
  }) {
    const req = await this.getRequestById(input.requestId);
    if (!req) {
      throw new Error(`Permohonan #${input.requestId} tidak ditemukan.`);
    }

    const isManager = isWarehouseManager(input.userRole);
    const isOwner = req.pemohon_id === input.userId || req.actor_id === input.userId;
    if (!isManager && !isOwner) {
      throw new Error('Anda tidak memiliki izin membatalkan permohonan ini.');
    }
    if (!isManager && req.status !== 'diajukan' && req.status !== 'menunggu') {
      throw new Error('Teknisi hanya dapat membatalkan permohonan yang belum disetujui.');
    }
    if (req.status !== 'diajukan' && req.status !== 'menunggu' && req.status !== 'disetujui') {
      throw new Error(`Permohonan berstatus ${req.status.toUpperCase()} tidak dapat dibatalkan.`);
    }

    return await runTransaction(async (conn) => {
      // Lepas reservasi jika sebelumnya sudah disetujui
      if (req.status === 'disetujui') {
        await conn.query(
          `UPDATE item SET reserved_for_request_id = NULL, reserved_for_user_id = NULL, status = 'aktif' WHERE reserved_for_request_id = ?`,
          [req.id]
        );
        if (!req.allocated_item_ids && req.box_id && req.mode_stok === 'jumlah') {
          await conn.query(
            `UPDATE stok_jumlah SET reserved_qty = GREATEST(0, COALESCE(reserved_qty, 0) - ?) WHERE tipe_id = ? AND box_id = ?`,
            [req.jumlah, req.tipe_id, req.box_id]
          );
        }
      }

      await conn.query(
        `UPDATE request SET status = 'dibatalkan', catatan_penolakan = ?, diproses_pada = NOW() WHERE id = ?`,
        [input.catatan ? input.catatan.trim() : 'Dibatalkan', req.id]
      );

      const txLog = await ActivityLogService.recordActivity({
        aksi: 'batal_request',
        pelaku_id: input.userId,
        request_id: req.id,
        tipe_mutasi: 'SYSTEM',
        reference_type: 'REQUEST_CANCEL',
        reference_number: req.id,
        catatan: `Membatalkan permohonan #${req.id}: ${input.catatan || 'Dibatalkan'}`
      }, conn);

      return {
        success: true,
        message: `Permohonan #${req.id} berhasil dibatalkan dan reservasi stok (jika ada) telah dilepaskan.`,
        requestId: req.id,
        activityId: txLog.idAktivitas
      };
    });
  }
}
