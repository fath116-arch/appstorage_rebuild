/**
 * Stock & Box Service (FieldOps Inventory v2 - Tahap 3)
 * Mengelola Box Penyimpanan, Item Fisik Ber-ID, Stok Jumlah, Scan Beruntun, & Transaction Log
 */

import { executeQuery, runTransaction } from '../db/database';
import { ActivityLogService } from './activityLogService';
import { CatalogService } from './catalogService';
import { ConfirmationService } from './confirmationService';
import crypto from 'crypto';

export interface Box {
  id: string;
  kode: string;
  keterangan?: string | null;
  aktif: boolean | number;
  dibuat_pada: string;
  total_item?: number;
}

export interface ItemFisik {
  id: string;
  kode_id: string;
  tipe_id: number;
  box_id: string;
  status: 'aktif' | 'keluar';
  kondisi?: 'Baru' | 'Baik' | 'Perlu Perbaikan' | 'Rusak';
  catatan_kondisi?: string | null;
  dibuat_pada: string;
  nama_tipe?: string;
  nama_produk?: string;
  kode_box?: string;
}

export interface StokJumlah {
  tipe_id: number;
  box_id: string;
  jumlah: number;
  nama_tipe?: string;
  nama_produk?: string;
  kode_box?: string;
}

export class StockService {
  // ============================================================================
  // 1. PENGELOLAAN BOX
  // ============================================================================

  static async listBoxes(): Promise<Box[]> {
    const list = await executeQuery<any>(
      `SELECT b.*, 
        (SELECT COUNT(i.id) FROM item i WHERE i.box_id = b.id AND i.status = 'aktif') +
        (SELECT COALESCE(SUM(sj.jumlah), 0) FROM stok_jumlah sj WHERE sj.box_id = b.id) as total_item
       FROM box b
       WHERE b.aktif = 1
       ORDER BY b.kode ASC`
    );
    return list;
  }

  static async getBoxById(id: string): Promise<Box | null> {
    const rows = await executeQuery<any>('SELECT * FROM box WHERE id = ?', [id]);
    if (!rows || rows.length === 0) return null;
    return rows[0];
  }

  static async getBoxByKode(kode: string): Promise<Box | null> {
    const cleanKode = kode.trim().toUpperCase();
    const rows = await executeQuery<any>('SELECT * FROM box WHERE UPPER(kode) = ?', [cleanKode]);
    if (!rows || rows.length === 0) return null;
    return rows[0];
  }

  static async createBox(kode: string, keterangan?: string, userId?: string): Promise<Box> {
    const cleanKode = kode.trim().toUpperCase();

    // Cek duplikasi kode box
    const existing = await this.getBoxByKode(cleanKode);
    if (existing) {
      throw new Error(`Box dengan kode "${cleanKode}" sudah terdaftar.`);
    }

    const boxId = `box-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    await executeQuery(
      `INSERT INTO box (id, kode, keterangan, aktif) VALUES (?, ?, ?, 1)`,
      [boxId, cleanKode, keterangan ? keterangan.trim() : null]
    );

    if (userId) {
      await ActivityLogService.recordActivity({
        aksi: 'tambah_box',
        pelaku_id: userId,
        box_tujuan: cleanKode,
        catatan: `Membuat Box penyimpanan baru "${cleanKode}"`
      });
    }

    const created = await this.getBoxById(boxId);
    return created!;
  }

  /**
   * Mengambil seluruh isi box (dikelompokkan per produk dan tipe)
   */
  static async getBoxContents(boxId: string) {
    const box = await this.getBoxById(boxId);
    if (!box) {
      throw new Error(`Box ID "${boxId}" tidak ditemukan.`);
    }

    // Ambil item fisik ber-ID di box ini
    const items = await executeQuery<any>(
      `SELECT i.*, t.nama_tipe, p.nama as nama_produk, j.nama as jenis_nama
       FROM item i
       JOIN tipe t ON i.tipe_id = t.id
       JOIN produk p ON t.produk_id = p.id
       JOIN jenis j ON p.jenis_id = j.id
       WHERE i.box_id = ? AND i.status = 'aktif'
       ORDER BY p.nama ASC, t.nama_tipe ASC, i.kode_id ASC`,
      [boxId]
    );

    // Ambil stok jumlah di box ini
    const stokJumlahList = await executeQuery<any>(
      `SELECT sj.*, t.nama_tipe, p.nama as nama_produk, j.nama as jenis_nama
       FROM stok_jumlah sj
       JOIN tipe t ON sj.tipe_id = t.id
       JOIN produk p ON t.produk_id = p.id
       JOIN jenis j ON p.jenis_id = j.id
       WHERE sj.box_id = ? AND sj.jumlah > 0
       ORDER BY p.nama ASC, t.nama_tipe ASC`,
      [boxId]
    );

    // Kelompokkan per produk
    const grouped: { [produkNama: string]: { [tipeNama: string]: { items: any[]; stokJumlah: number } } } = {};

    for (const it of items) {
      if (!grouped[it.nama_produk]) grouped[it.nama_produk] = {};
      if (!grouped[it.nama_produk][it.nama_tipe]) grouped[it.nama_produk][it.nama_tipe] = { items: [], stokJumlah: 0 };
      grouped[it.nama_produk][it.nama_tipe].items.push(it);
    }

    for (const sj of stokJumlahList) {
      if (!grouped[sj.nama_produk]) grouped[sj.nama_produk] = {};
      if (!grouped[sj.nama_produk][sj.nama_tipe]) grouped[sj.nama_produk][sj.nama_tipe] = { items: [], stokJumlah: 0 };
      grouped[sj.nama_produk][sj.nama_tipe].stokJumlah += sj.jumlah;
    }

    return {
      box,
      total_items: items.length,
      total_stok_jumlah: stokJumlahList.reduce((acc: number, cur: any) => acc + cur.jumlah, 0),
      contents: grouped,
      raw_items: items,
      raw_stok_jumlah: stokJumlahList
    };
  }

  /**
   * Memindahkan item fisik atau stok jumlah antar box
   */
  static async pindahBox(input: {
    itemId?: string;
    tipeId?: number;
    boxAsalId: string;
    boxTujuanId: string;
    jumlah?: number;
    userId: string;
    catatan?: string;
  }) {
    const boxAsal = await this.getBoxById(input.boxAsalId);
    const boxTujuan = await this.getBoxById(input.boxTujuanId);

    if (!boxAsal || !boxTujuan) {
      throw new Error('Box asal atau box tujuan tidak ditemukan.');
    }

    return await runTransaction(async (conn) => {
      let namaSnapshot = '';
      let movedCount = 0;
      let tipeId = input.tipeId;

      if (input.itemId) {
        // Pindah Item Fisik Ber-ID
        const itemRows = await conn.query('SELECT * FROM item WHERE id = ? AND status = "aktif"', [input.itemId]);
        if (!itemRows || itemRows.length === 0) {
          throw new Error(`Item fisik #${input.itemId} tidak aktif atau tidak ditemukan.`);
        }
        const item = itemRows[0];
        tipeId = item.tipe_id;

        const tipe = await CatalogService.getTipeById(tipeId!);
        namaSnapshot = tipe ? `${tipe.produk_nama} - ${tipe.nama_tipe}` : `Tipe #${tipeId}`;

        await conn.query('UPDATE item SET box_id = ? WHERE id = ?', [input.boxTujuanId, input.itemId]);
        movedCount = 1;
      } else if (input.tipeId && input.jumlah && input.jumlah > 0) {
        // Pindah Stok Jumlah
        const sjRows = await conn.query(
          'SELECT * FROM stok_jumlah WHERE tipe_id = ? AND box_id = ?',
          [input.tipeId, input.boxAsalId]
        );
        if (!sjRows || sjRows.length === 0 || sjRows[0].jumlah < input.jumlah) {
          throw new Error(`Stok jumlah di ${boxAsal.kode} tidak mencukupi untuk dipindahkan.`);
        }

        const tipe = await CatalogService.getTipeById(input.tipeId);
        namaSnapshot = tipe ? `${tipe.produk_nama} - ${tipe.nama_tipe}` : `Tipe #${input.tipeId}`;

        // Kurangi di box asal
        await conn.query(
          'UPDATE stok_jumlah SET jumlah = jumlah - ? WHERE tipe_id = ? AND box_id = ?',
          [input.jumlah, input.tipeId, input.boxAsalId]
        );

        // Tambahkan di box tujuan
        const destRows = await conn.query(
          'SELECT * FROM stok_jumlah WHERE tipe_id = ? AND box_id = ?',
          [input.tipeId, input.boxTujuanId]
        );

        if (destRows && destRows.length > 0) {
          await conn.query(
            'UPDATE stok_jumlah SET jumlah = jumlah + ? WHERE tipe_id = ? AND box_id = ?',
            [input.jumlah, input.tipeId, input.boxTujuanId]
          );
        } else {
          await conn.query(
            'INSERT INTO stok_jumlah (tipe_id, box_id, jumlah) VALUES (?, ?, ?)',
            [input.tipeId, input.boxTujuanId, input.jumlah]
          );
        }

        movedCount = input.jumlah;
      } else {
        throw new Error('Harus menyertakan itemId atau tipeId + jumlah.');
      }

      // Catat Log Transaksi Pindah Box
      const txLog = await ActivityLogService.recordActivity({
        aksi: 'pindah_box',
        pelaku_id: input.userId,
        box_asal: boxAsal.kode,
        box_tujuan: boxTujuan.kode,
        catatan: input.catatan || `Pindah ${movedCount} unit dari ${boxAsal.kode} ke ${boxTujuan.kode}`,
        details: [
          {
            tipe_id: tipeId!,
            item_id: input.itemId || null,
            kode_id: input.itemId ? (await conn.query('SELECT kode_id FROM item WHERE id = ?', [input.itemId]))[0]?.kode_id : null,
            nama_snapshot: namaSnapshot,
            jumlah: movedCount,
            status_sebelum: boxAsal.kode,
            status_sesudah: boxTujuan.kode
          }
        ]
      }, conn);

      return {
        success: true,
        message: `Berhasil memindahkan ${movedCount} unit dari ${boxAsal.kode} ke ${boxTujuan.kode}.`,
        activityId: txLog.idAktivitas || (txLog as any).id_aktivitas
      };
    });
  }

  // ============================================================================
  // 2. INPUT STOK FISIK (SINGLE & BULK CAMERA SCANNER)
  // ============================================================================

  /**
   * Cek keberadaan kode_id di seluruh sistem untuk mencegah duplikasi
   */
  static async checkDuplicateKodeId(kodeId: string): Promise<{ exists: boolean; item?: any }> {
    const cleanKode = kodeId.trim();
    const rows = await executeQuery<any>(
      `SELECT i.*, b.kode as kode_box, t.nama_tipe, p.nama as nama_produk
       FROM item i
       JOIN box b ON i.box_id = b.id
       JOIN tipe t ON i.tipe_id = t.id
       JOIN produk p ON t.produk_id = p.id
       WHERE UPPER(i.kode_id) = UPPER(?)`,
      [cleanKode]
    );

    if (rows && rows.length > 0) {
      return { exists: true, item: rows[0] };
    }
    return { exists: false };
  }

  /**
   * Input Stok Item Fisik Tunggal (Kamera / Scanner / Manual)
   */
  static async inputStokItemSingle(input: {
    tipe_id: number;
    box_id: string;
    kode_id: string;
    user_id: string;
    kondisi?: 'Baru' | 'Baik' | 'Perlu Perbaikan' | 'Rusak';
    catatan_kondisi?: string;
    catatan?: string;
  }) {
    const cleanKode = input.kode_id.trim();
    if (!cleanKode) {
      throw new Error('Kode ID / Serial Number tidak boleh kosong.');
    }

    const tipe = await CatalogService.getTipeById(input.tipe_id);
    if (!tipe) throw new Error(`Tipe #${input.tipe_id} tidak ditemukan.`);

    const box = await this.getBoxById(input.box_id);
    if (!box) throw new Error(`Box ID "${input.box_id}" tidak ditemukan.`);

    // 1. Cek Duplikasi Kode ID
    const dupCheck = await this.checkDuplicateKodeId(cleanKode);
    if (dupCheck.exists) {
      const it = dupCheck.item;
      throw new Error(
        `ID "${cleanKode}" sudah terdaftar pada produk "${it.nama_produk} - ${it.nama_tipe}" (Status: ${it.status}, Posisi: Box ${it.kode_box}).`
      );
    }

    // 2. Validasi Pola Regex (pola_id) jika ditentukan
    if (tipe.pola_id && tipe.pola_id.trim().length > 0) {
      const regex = new RegExp(tipe.pola_id.trim());
      if (!regex.test(cleanKode)) {
        throw new Error(
          `Kode ID "${cleanKode}" tidak sesuai pola validasi regex tipe ini: ${tipe.pola_id}`
        );
      }
    }

    const kondisiItem = input.kondisi || 'Baik';
    const catatanKondisi = input.catatan_kondisi ? input.catatan_kondisi.trim() : null;

    return await runTransaction(async (conn) => {
      const itemId = `item-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

      // Insert ke tabel item
      await conn.query(
        `INSERT INTO item (id, kode_id, tipe_id, box_id, status, kondisi, catatan_kondisi) VALUES (?, ?, ?, ?, 'aktif', ?, ?)`,
        [itemId, cleanKode, input.tipe_id, input.box_id, kondisiItem, catatanKondisi]
      );

      // Kunci aturan ID tipe jika belum dikunci (id_dikunci = 1)
      await conn.query(`UPDATE tipe SET id_dikunci = 1 WHERE id = ?`, [input.tipe_id]);

      const namaSnapshot = `${tipe.produk_nama} - ${tipe.nama_tipe}`;

      // Record Activity Transaction
      const txLog = await ActivityLogService.recordActivity({
        aksi: 'tambah_item',
        pelaku_id: input.user_id,
        box_tujuan: box.kode,
        catatan: input.catatan || `Input stok item fisik ber-ID (${cleanKode}) di ${box.kode}`,
        details: [
          {
            tipe_id: input.tipe_id,
            item_id: itemId,
            kode_id: cleanKode,
            nama_snapshot: namaSnapshot,
            jumlah: 1,
            status_sebelum: null,
            status_sesudah: 'aktif'
          }
        ]
      }, conn);

      // Sync into unified transactions table (type = 'IN')
      const txId = `tx-in-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      await conn.query(
        `INSERT INTO transactions (id, type, item_id, quantity, previous_qty, new_qty, reference_type, reference_number, recipient_destination, user_id, performed_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [txId, 'IN', itemId, 1, 0, 1, 'SINGLE_SCAN', cleanKode, box.kode, input.user_id, input.user_id, input.catatan || `Input stok item (${cleanKode})`]
      );

      return {
        success: true,
        message: `Berhasil menambahkan item [${cleanKode}] ke ${box.kode}.`,
        itemId,
        kodeId: cleanKode,
        activityId: txLog.idAktivitas || (txLog as any).id_aktivitas
      };
    });
  }

  /**
   * Input Stok Massal N Unit / Scan Beruntun (Satu Operasi = Satu Transaksi AKT-YYYYMMDD-NNNN)
   */
  static async inputStokItemBulk(input: {
    tipe_id: number;
    box_id: string;
    kode_ids?: string[];
    auto_count?: number;
    user_id: string;
    catatan?: string;
    confirmation_token?: string;
  }) {
    const tipe = await CatalogService.getTipeById(input.tipe_id);
    if (!tipe) throw new Error(`Tipe #${input.tipe_id} tidak ditemukan.`);

    const box = await this.getBoxById(input.box_id);
    if (!box) throw new Error(`Box ID "${input.box_id}" tidak ditemukan.`);

    let finalKodeIds: string[] = [];

    // Jika mode otomatis N unit
    if (typeof input.auto_count === 'number' && input.auto_count > 0) {
      if (tipe.sumber_id !== 'otomatis') {
        throw new Error('Fitur generate N unit otomatis hanya berlaku untuk tipe dengan sumber_id = "otomatis".');
      }

      const prefix = (tipe.prefix_id || 'ITEM-').trim();
      const timestamp = Date.now().toString().slice(-6);

      for (let i = 1; i <= input.auto_count; i++) {
        const autoSeq = String(i).padStart(4, '0');
        finalKodeIds.push(`${prefix}${timestamp}-${autoSeq}`);
      }
    } else if (input.kode_ids && Array.isArray(input.kode_ids) && input.kode_ids.length > 0) {
      // Bersihkan dan buang duplikat di input array
      const rawList = input.kode_ids.map(s => s.trim()).filter(s => s.length > 0);
      const uniqueInputSet = new Set(rawList);
      finalKodeIds = Array.from(uniqueInputSet);
    } else {
      throw new Error('Harus memberikan daftar kode_ids atau angka auto_count.');
    }

    if (finalKodeIds.length === 0) {
      throw new Error('Daftar ID item fisik tidak boleh kosong.');
    }

    // 1. Cek Duplikasi Seluruh Kode ID
    for (const kode of finalKodeIds) {
      const dupCheck = await this.checkDuplicateKodeId(kode);
      if (dupCheck.exists) {
        const it = dupCheck.item;
        throw new Error(
          `Gagal input massal: ID "${kode}" sudah ada di sistem (${it.nama_produk} - ${it.nama_tipe}, Box ${it.kode_box}).`
        );
      }

      // Validasi Regex jika ada
      if (tipe.pola_id && tipe.pola_id.trim().length > 0) {
        const regex = new RegExp(tipe.pola_id.trim());
        if (!regex.test(kode)) {
          throw new Error(`Gagal input massal: ID "${kode}" tidak cocok dengan pola regex: ${tipe.pola_id}`);
        }
      }
    }

    // 2. Verifikasi Confirmation Token (Tier 2 untuk Bulk Input) jika dikirim
    if (input.confirmation_token) {
      await ConfirmationService.consumeConfirmationToken(
        input.confirmation_token,
        input.user_id,
        'bulk_stock_in',
        String(input.tipe_id)
      );
    }

    return await runTransaction(async (conn) => {
      const namaSnapshot = `${tipe.produk_nama} - ${tipe.nama_tipe}`;
      const detailsPayload: any[] = [];
      const insertedItemIds: string[] = [];

      for (const kode of finalKodeIds) {
        const itemId = `item-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        await conn.query(
          `INSERT INTO item (id, kode_id, tipe_id, box_id, status) VALUES (?, ?, ?, ?, 'aktif')`,
          [itemId, kode, input.tipe_id, input.box_id]
        );

        insertedItemIds.push(itemId);
        detailsPayload.push({
          tipe_id: input.tipe_id,
          item_id: itemId,
          kode_id: kode,
          nama_snapshot: namaSnapshot,
          jumlah: 1,
          status_sebelum: null,
          status_sesudah: 'aktif'
        });
      }

      // Kunci aturan ID tipe (id_dikunci = 1)
      await conn.query(`UPDATE tipe SET id_dikunci = 1 WHERE id = ?`, [input.tipe_id]);

      // Catat 1 Transaksi Tunggal untuk seluruh batch N item
      const txLog = await ActivityLogService.recordActivity({
        aksi: 'tambah_item_massal',
        pelaku_id: input.user_id,
        box_tujuan: box.kode,
        catatan: input.catatan || `Input stok massal ${finalKodeIds.length} unit di ${box.kode}`,
        details: detailsPayload
      }, conn);

      // Sync into unified transactions table (type = 'IN')
      const txId = `tx-in-bulk-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      await conn.query(
        `INSERT INTO transactions (id, type, item_id, quantity, previous_qty, new_qty, reference_type, reference_number, recipient_destination, user_id, performed_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [txId, 'IN', insertedItemIds[0] || String(input.tipe_id), finalKodeIds.length, 0, finalKodeIds.length, 'BULK_SCAN', `BULK-${finalKodeIds.length}`, box.kode, input.user_id, input.user_id, input.catatan || `Input stok massal ${finalKodeIds.length} unit`]
      );

      return {
        success: true,
        message: `Berhasil menambahkan batch ${finalKodeIds.length} unit item ke ${box.kode}.`,
        totalCount: finalKodeIds.length,
        activityId: txLog.idAktivitas || (txLog as any).id_aktivitas,
        kodeIds: finalKodeIds
      };
    });
  }

  // ============================================================================
  // 3. INPUT STOK JUMLAH (MODE TANPA_ID / BULK NON-SN)
  // ============================================================================

  static async inputStokJumlah(input: {
    tipe_id: number;
    box_id: string;
    jumlah: number;
    user_id: string;
    catatan?: string;
  }) {
    if (!input.jumlah || input.jumlah <= 0) {
      throw new Error('Jumlah unit masuk harus lebih besar dari 0.');
    }

    const tipe = await CatalogService.getTipeById(input.tipe_id);
    if (!tipe) throw new Error(`Tipe #${input.tipe_id} tidak ditemukan.`);

    const box = await this.getBoxById(input.box_id);
    if (!box) throw new Error(`Box ID "${input.box_id}" tidak ditemukan.`);

    return await runTransaction(async (conn) => {
      // Cek apakah sudah ada baris stok_jumlah
      const existing = await conn.query(
        'SELECT * FROM stok_jumlah WHERE tipe_id = ? AND box_id = ?',
        [input.tipe_id, input.box_id]
      );

      if (existing && existing.length > 0) {
        await conn.query(
          'UPDATE stok_jumlah SET jumlah = jumlah + ? WHERE tipe_id = ? AND box_id = ?',
          [input.jumlah, input.tipe_id, input.box_id]
        );
      } else {
        await conn.query(
          'INSERT INTO stok_jumlah (tipe_id, box_id, jumlah) VALUES (?, ?, ?)',
          [input.tipe_id, input.box_id, input.jumlah]
        );
      }

      // Kunci aturan ID tipe
      await conn.query('UPDATE tipe SET id_dikunci = 1 WHERE id = ?', [input.tipe_id]);

      const namaSnapshot = `${tipe.produk_nama} - ${tipe.nama_tipe}`;

      // Record Activity Log
      const txLog = await ActivityLogService.recordActivity({
        aksi: 'tambah_stok_jumlah',
        pelaku_id: input.user_id,
        box_tujuan: box.kode,
        catatan: input.catatan || `Input stok jumlah +${input.jumlah} unit di ${box.kode}`,
        details: [
          {
            tipe_id: input.tipe_id,
            item_id: null,
            kode_id: null,
            nama_snapshot: namaSnapshot,
            jumlah: input.jumlah,
            status_sebelum: null,
            status_sesudah: 'aktif'
          }
        ]
      }, conn);

      // Sync into unified transactions table (type = 'IN')
      const txId = `tx-in-qty-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      await conn.query(
        `INSERT INTO transactions (id, type, item_id, quantity, previous_qty, new_qty, reference_type, reference_number, recipient_destination, user_id, performed_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [txId, 'IN', String(input.tipe_id), input.jumlah, 0, input.jumlah, 'QUANTITY_INPUT', `QTY-${input.jumlah}`, box.kode, input.user_id, input.user_id, input.catatan || `Input stok jumlah +${input.jumlah} unit`]
      );

      return {
        success: true,
        message: `Berhasil menambahkan +${input.jumlah} unit ke ${box.kode}.`,
        activityId: txLog.idAktivitas || (txLog as any).id_aktivitas
      };
    });
  }

  /**
   * Mengambil daftar ID item fisik dan stok jumlah untuk satu Tipe
   */
  static async getItemsByTipe(tipeId: number, options?: { excludeRusak?: boolean }) {
    let itemQuery = `SELECT i.*, b.kode as box_kode, b.keterangan as box_keterangan
       FROM item i
       JOIN box b ON i.box_id = b.id
       WHERE i.tipe_id = ? AND i.status = 'aktif'`;

    if (options?.excludeRusak) {
      itemQuery += ` AND (i.kondisi IS NULL OR i.kondisi != 'Rusak')`;
    }

    itemQuery += ` ORDER BY i.kode_id ASC`;

    const items = await executeQuery<any>(itemQuery, [tipeId]);

    const stokJumlah = await executeQuery<any>(
      `SELECT sj.*, b.kode as box_kode, b.keterangan as box_keterangan
       FROM stok_jumlah sj
       JOIN box b ON sj.box_id = b.id
       WHERE sj.tipe_id = ? AND sj.jumlah > 0
       ORDER BY b.kode ASC`,
      [tipeId]
    );

    return { items, stokJumlah };
  }

  // ============================================================================
  // TAHAP 5: BARANG KELUAR, ARSIP, & RESTORE
  // ============================================================================

  /**
   * Barang Keluar Tunggal (Item Ber-ID atau Stok Jumlah)
   * Soft delete status = 'keluar'
   */
  static async barangKeluarSingle(input: {
    kodeId?: string;
    itemId?: string;
    tipeId?: number;
    boxId?: string;
    jumlah?: number;
    userId: string;
    catatan?: string;
    confirmationToken?: string;
  }) {
    if (input.kodeId || input.itemId) {
      // Keluar Item Ber-ID
      const cleanKode = input.kodeId ? input.kodeId.trim() : '';
      const dupCheck = await this.checkDuplicateKodeId(cleanKode || input.itemId || '');
      if (!dupCheck.exists) {
        throw new Error(`Item dengan ID "${cleanKode || input.itemId}" tidak ditemukan di sistem.`);
      }

      const item = dupCheck.item;
      if (item.status === 'keluar') {
        throw new Error(`Item "${cleanKode}" sudah berstatus KELUAR di Arsip.`);
      }

      return await runTransaction(async (conn) => {
        await conn.query('UPDATE item SET status = "keluar" WHERE id = ?', [item.id]);

        const namaSnapshot = `${item.nama_produk} - ${item.nama_tipe}`;

        const txLog = await ActivityLogService.recordActivity({
          aksi: 'barang_keluar',
          pelaku_id: input.userId,
          box_asal: item.kode_box,
          catatan: input.catatan || `Barang keluar item ber-ID (${item.kode_id})`,
          details: [
            {
              tipe_id: item.tipe_id,
              item_id: item.id,
              kode_id: item.kode_id,
              nama_snapshot: namaSnapshot,
              jumlah: 1,
              status_sebelum: 'aktif',
              status_sesudah: 'keluar'
            }
          ]
        }, conn);

        // Sync into unified transactions table (type = 'OUT')
        const txId = `tx-out-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        await conn.query(
          `INSERT INTO transactions (id, type, item_id, quantity, previous_qty, new_qty, reference_type, reference_number, recipient_destination, user_id, performed_by, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [txId, 'OUT', item.id, 1, 1, 0, 'STOCK_OUT', item.kode_id, item.kode_box || 'Gudang', input.userId, input.userId, input.catatan || `Barang keluar item (${item.kode_id})`]
        );

        return {
          success: true,
          message: `Item "${item.kode_id}" (${namaSnapshot}) berhasil dikeluarkan ke Arsip.`,
          activityId: txLog.idAktivitas || (txLog as any).id_aktivitas
        };
      });
    } else if (input.tipeId && input.boxId && input.jumlah && input.jumlah > 0) {
      // Keluar Stok Jumlah
      const tipe = await CatalogService.getTipeById(input.tipeId);
      if (!tipe) throw new Error(`Tipe #${input.tipeId} tidak ditemukan.`);

      const box = await this.getBoxById(input.boxId);
      if (!box) throw new Error(`Box ID "${input.boxId}" tidak ditemukan.`);

      return await runTransaction(async (conn) => {
        const sjRows = await conn.query(
          'SELECT jumlah FROM stok_jumlah WHERE tipe_id = ? AND box_id = ?',
          [input.tipeId, input.boxId]
        );

        const currentQty = sjRows && sjRows.length > 0 ? sjRows[0].jumlah : 0;
        if (currentQty < input.jumlah!) {
          throw new Error(`Stok jumlah di ${box.kode} tidak mencukupi (Tersedia: ${currentQty}, Diminta: ${input.jumlah}).`);
        }

        await conn.query(
          'UPDATE stok_jumlah SET jumlah = jumlah - ? WHERE tipe_id = ? AND box_id = ?',
          [input.jumlah, input.tipeId, input.boxId]
        );

        const namaSnapshot = `${tipe.produk_nama} - ${tipe.nama_tipe}`;

        const outQty = input.jumlah!;
        const txLog = await ActivityLogService.recordActivity({
          aksi: 'barang_keluar_jumlah',
          pelaku_id: input.userId,
          box_asal: box.kode,
          catatan: input.catatan || `Pengurangan stok jumlah -${outQty} unit di ${box.kode}`,
          details: [
            {
              tipe_id: input.tipeId,
              item_id: null,
              kode_id: null,
              nama_snapshot: namaSnapshot,
              jumlah: outQty,
              status_sebelum: 'aktif',
              status_sesudah: 'keluar'
            }
          ]
        }, conn);

        // Sync into unified transactions table (type = 'OUT')
        const txId = `tx-out-qty-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        await conn.query(
          `INSERT INTO transactions (id, type, item_id, quantity, previous_qty, new_qty, reference_type, reference_number, recipient_destination, user_id, performed_by, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [txId, 'OUT', String(input.tipeId), outQty, currentQty, currentQty - outQty, 'STOCK_OUT', `QTY-OUT-${outQty}`, box.kode, input.userId, input.userId, input.catatan || `Pengurangan stok jumlah -${outQty} unit`]
        );

        return {
          success: true,
          message: `Stok jumlah -${outQty} unit (${namaSnapshot}) di ${box.kode} berhasil dikeluarkan.`,
          activityId: txLog.idAktivitas || (txLog as any).id_aktivitas
        };
      });
    }

    throw new Error('Parameter barang keluar tidak lengkap.');
  }

  /**
   * Barang Keluar Massal (Konfirmasi Tier 2 `approve`)
   */
  static async barangKeluarBulk(input: {
    items: Array<{ kodeId?: string; itemId?: string; tipeId?: number; boxId?: string; jumlah?: number }>;
    userId: string;
    catatan?: string;
    confirmationToken?: string;
  }) {
    if (!input.items || input.items.length === 0) {
      throw new Error('Daftar barang keluar massal tidak boleh kosong.');
    }

    // Verifikasi Token Konfirmasi Server Tier 2
    const validation = await ConfirmationService.consumeConfirmationToken(
      input.confirmationToken,
      input.userId,
      'bulk_stock_out',
      'bulk'
    );
    if (!validation.valid) {
      throw new Error(`Konfirmasi Tingkat 2 diperlukan: ${validation.message}`);
    }

    return await runTransaction(async (conn) => {
      const detailsPayload: any[] = [];
      let totalOutCount = 0;

      for (const itemInput of input.items) {
        if (itemInput.kodeId || itemInput.itemId) {
          const cleanKode = itemInput.kodeId ? itemInput.kodeId.trim() : '';
          const dupCheck = await this.checkDuplicateKodeId(cleanKode || itemInput.itemId || '');
          if (dupCheck.exists && dupCheck.item.status === 'aktif') {
            const item = dupCheck.item;
            await conn.query('UPDATE item SET status = "keluar" WHERE id = ?', [item.id]);

            detailsPayload.push({
              tipe_id: item.tipe_id,
              item_id: item.id,
              kode_id: item.kode_id,
              nama_snapshot: `${item.nama_produk} - ${item.nama_tipe}`,
              jumlah: 1,
              status_sebelum: 'aktif',
              status_sesudah: 'keluar'
            });
            totalOutCount++;
          }
        }
      }

      const txLog = await ActivityLogService.recordActivity({
        aksi: 'barang_keluar_massal',
        pelaku_id: input.userId,
        catatan: input.catatan || `Barang keluar massal ${totalOutCount} unit`,
        details: detailsPayload
      }, conn);

      // Sync into unified transactions table (type = 'OUT')
      const txId = `tx-out-bulk-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      await conn.query(
        `INSERT INTO transactions (id, type, item_id, quantity, previous_qty, new_qty, reference_type, reference_number, recipient_destination, user_id, performed_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [txId, 'OUT', 'bulk-items', totalOutCount, totalOutCount, 0, 'BULK_DISPATCH', `BULK-OUT-${totalOutCount}`, 'Arsip', input.userId, input.userId, input.catatan || `Barang keluar massal ${totalOutCount} unit`]
      );

      return {
        success: true,
        message: `Berhasil mengeluarkan batch ${totalOutCount} unit barang ke Arsip.`,
        totalCount: totalOutCount,
        activityId: txLog.idAktivitas || (txLog as any).id_aktivitas
      };
    });
  }

  /**
   * Menampilkan Daftar Arsip Barang Keluar
   */
  static async listArsip(filters?: { search?: string }) {
    let sql = `
      SELECT i.*, b.kode as kode_box, t.nama_tipe, p.nama as nama_produk, j.nama as jenis_nama
      FROM item i
      JOIN box b ON i.box_id = b.id
      JOIN tipe t ON i.tipe_id = t.id
      JOIN produk p ON t.produk_id = p.id
      JOIN jenis j ON p.jenis_id = j.id
      WHERE i.status = 'keluar'
    `;
    const params: any[] = [];

    if (filters?.search) {
      sql += ' AND (UPPER(i.kode_id) LIKE UPPER(?) OR UPPER(p.nama) LIKE UPPER(?) OR UPPER(t.nama_tipe) LIKE UPPER(?))';
      params.push(`%${filters.search.trim()}%`, `%${filters.search.trim()}%`, `%${filters.search.trim()}%`);
    }

    sql += ' ORDER BY i.dibuat_pada DESC';

    const items = await executeQuery<any>(sql, params);
    return items;
  }

  /**
   * Restore Item dari Arsip ke Stok Aktif di Box Pilihan
   * (Wajib konfirmasi produk sama & verifikasi duplikasi)
   */
  static async restoreItemFromArchive(input: {
    kodeId: string;
    targetBoxId: string;
    userId: string;
    confirmProductMatched: boolean;
    catatan?: string;
    kondisi?: 'Baru' | 'Baik' | 'Perlu Perbaikan' | 'Rusak';
    catatanKondisi?: string;
  }) {
    const cleanKode = input.kodeId.trim();
    if (!cleanKode) {
      throw new Error('Kode ID / Serial Number tidak boleh kosong.');
    }

    // Cek di seluruh sistem
    const checkRes = await this.checkDuplicateKodeId(cleanKode);

    // 1. Bila ID sudah berstatus AKTIF -> cegah duplikasi!
    if (checkRes.exists && checkRes.item.status === 'aktif') {
      return {
        success: false,
        isAlreadyActive: true,
        message: `ID "${cleanKode}" saat ini sudah AKTIF di Box ${checkRes.item.kode_box} (${checkRes.item.nama_produk} - ${checkRes.item.nama_tipe}). Tidak dapat diduplikasi.`
      };
    }

    // 2. Bila ID tidak ada di Arsip maupun sistem -> tawarkan input stok baru
    if (!checkRes.exists) {
      return {
        success: false,
        isNotInArchive: true,
        message: `ID "${cleanKode}" tidak ditemukan di Arsip maupun stok aktif. Apakah Anda ingin menginputnya sebagai stok baru?`
      };
    }

    const item = checkRes.item;
    const targetBox = await this.getBoxById(input.targetBoxId);
    if (!targetBox) {
      throw new Error(`Box tujuan ID "${input.targetBoxId}" tidak ditemukan.`);
    }

    // 3. Konfirmasi produk sama
    if (!input.confirmProductMatched) {
      return {
        success: false,
        requiresMatchConfirmation: true,
        itemData: item,
        message: `Mohon konfirmasi bahwa produk yang dikembalikan adalah "${item.nama_produk} - ${item.nama_tipe}".`
      };
    }

    const targetKondisi = input.kondisi || item.kondisi || 'Baik';
    const targetCatatanKondisi = input.catatanKondisi !== undefined ? (input.catatanKondisi ? input.catatanKondisi.trim() : null) : (item.catatan_kondisi || null);

    // 4. Restore ke status 'aktif'
    return await runTransaction(async (conn) => {
      await conn.query(
        'UPDATE item SET status = "aktif", box_id = ?, kondisi = ?, catatan_kondisi = ? WHERE id = ?',
        [input.targetBoxId, targetKondisi, targetCatatanKondisi, item.id]
      );

      const namaSnapshot = `${item.nama_produk} - ${item.nama_tipe}`;

      const txLog = await ActivityLogService.recordActivity({
        aksi: 'restore_item',
        pelaku_id: input.userId,
        box_tujuan: targetBox.kode,
        catatan: input.catatan || `Restore barang dari Arsip (${cleanKode}) ke ${targetBox.kode} [Kondisi: ${targetKondisi}]`,
        details: [
          {
            tipe_id: item.tipe_id,
            item_id: item.id,
            kode_id: cleanKode,
            nama_snapshot: namaSnapshot,
            jumlah: 1,
            status_sebelum: 'keluar',
            status_sesudah: 'aktif'
          }
        ]
      }, conn);

      return {
        success: true,
        message: `Berhasil mengembalikan barang "${cleanKode}" (${namaSnapshot}) ke stok aktif di ${targetBox.kode} [Kondisi: ${targetKondisi}].`,
        activityId: txLog.idAktivitas || (txLog as any).id_aktivitas
      };
    });
  }

  /**
   * Mengubah Kondisi Item Fisik Ber-ID (Baru, Baik, Perlu Perbaikan, Rusak) & Catatan Kondisi
   */
  static async updateKondisiItem(input: {
    itemId: string;
    kondisi: 'Baru' | 'Baik' | 'Perlu Perbaikan' | 'Rusak';
    catatanKondisi?: string;
    userId: string;
  }) {
    const rows = await executeQuery<any>('SELECT * FROM item WHERE id = ? OR kode_id = ?', [input.itemId, input.itemId]);
    if (!rows || rows.length === 0) {
      throw new Error(`Item "${input.itemId}" tidak ditemukan.`);
    }

    const item = rows[0];
    const kondisiLama = item.kondisi || 'Baik';
    const kondisiBaru = input.kondisi;
    const catatan = input.catatanKondisi ? input.catatanKondisi.trim() : null;

    await executeQuery(
      'UPDATE item SET kondisi = ?, catatan_kondisi = ? WHERE id = ?',
      [kondisiBaru, catatan, item.id]
    );

    await ActivityLogService.recordActivity({
      aksi: 'ubah_kondisi_item',
      pelaku_id: input.userId,
      catatan: `Mengubah kondisi item "${item.kode_id}": dari ${kondisiLama} ke ${kondisiBaru}${catatan ? ` (${catatan})` : ''}`
    });

    return {
      success: true,
      message: `Kondisi item "${item.kode_id}" berhasil diperbarui dari ${kondisiLama} ke ${kondisiBaru}.`,
      item: { ...item, kondisi: kondisiBaru, catatan_kondisi: catatan }
    };
  }
}
