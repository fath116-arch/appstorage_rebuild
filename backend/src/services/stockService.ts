/**
 * Stock & Box Service (Single Canonical Inventory Model)
 * Mengelola Box Penyimpanan, Item Fisik Ber-ID, Stok Jumlah, Pencarian Item, Barang Keluar (Cart), Arsip, & Restore
 */

import { executeQuery, runTransaction } from '../db/database';
import { ActivityDetailInput, ActivityLogService } from './activityLogService';
import { CatalogService } from './catalogService';
import { ConfirmationService } from './confirmationService';
import { TrashService } from './trashService';
import { toMysqlUtcDatetime } from '../utils/timezone';
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
  status: 'aktif' | 'dipesan' | 'keluar';
  kondisi?: 'Baru' | 'Baik' | 'Perlu Perbaikan' | 'Rusak';
  catatan_kondisi?: string | null;
  reserved_for_request_id?: string | null;
  reserved_for_user_id?: string | null;
  dibuat_pada: string;
  nama_tipe?: string;
  nama_produk?: string;
  produk_id?: number;
  kode_box?: string;
  kategori_barang?: 'Alat' | 'Barang Habis Pakai';
  tipe_stok?: string;
}

export interface StokJumlah {
  tipe_id: number;
  box_id: string;
  jumlah: number;
  reserved_qty?: number;
  nama_tipe?: string;
  nama_produk?: string;
  kode_box?: string;
}

export interface StockAttributionInput {
  actorId?: string;
  actorName?: string;
  recordedById?: string;
  recordedByName?: string;
  recordedByRole?: string;
  onBehalfReason?: string;
  occurredAt?: string;
  requestId?: string;
  referenceType?: string;
  referenceNumber?: string;
  recipientDestination?: string;
}

export interface SearchStockItemResult extends ItemFisik {
  jenis_nama?: string;
  selectable: boolean;
  unselectableReason: string | null;
}

interface TotalCountRow {
  total: number | string;
}

interface BoxItemDetailRow extends ItemFisik {
  nama_tipe: string;
  nama_produk: string;
  jenis_nama: string;
}

interface BoxStokJumlahDetailRow extends StokJumlah {
  nama_tipe: string;
  nama_produk: string;
  jenis_nama: string;
}

interface DuplicateItemRow extends ItemFisik {
  kode_box: string;
  nama_tipe: string;
  nama_produk: string;
}

interface ArchiveItemRow extends DuplicateItemRow {
  jenis_nama: string;
}

interface TipeItemRow extends ItemFisik {
  box_kode: string;
  box_keterangan?: string | null;
}

interface TipeStokJumlahRow extends StokJumlah {
  box_kode: string;
  box_keterangan?: string | null;
}

interface KodeIdRow {
  kode_id: string;
}

export class StockService {
  /**
   * Mengambil stok tersedia tunggal untuk satu Tipe.
   * Rumus: SUM(GREATEST(0, stok_jumlah.jumlah - reserved_qty)) + COUNT(item status='aktif' AND kondisi != 'Rusak')
   */
  static async getStock(tipeId: number): Promise<number> {
    const sjRows = await executeQuery<TotalCountRow>(
      'SELECT COALESCE(SUM(GREATEST(0, jumlah - COALESCE(reserved_qty, 0))), 0) as total FROM stok_jumlah WHERE tipe_id = ?',
      [tipeId]
    );
    const itemRows = await executeQuery<TotalCountRow>(
      `SELECT COUNT(*) as total FROM item WHERE tipe_id = ? AND status = 'aktif' AND (kondisi IS NULL OR kondisi != 'Rusak')`,
      [tipeId]
    );
    const totalSj = Number(sjRows[0]?.total || 0);
    const totalItem = Number(itemRows[0]?.total || 0);
    return totalSj + totalItem;
  }

  // ============================================================================
  // 1. PENGELOLAAN BOX
  // ============================================================================

  static async listBoxes(): Promise<Box[]> {
    const list = await executeQuery<Box>(
      `SELECT b.*,
        (SELECT COUNT(i.id) FROM item i WHERE i.box_id = b.id AND i.status IN ('aktif', 'dipesan')) +
        (SELECT COALESCE(SUM(sj.jumlah), 0) FROM stok_jumlah sj WHERE sj.box_id = b.id) as total_item
       FROM box b
       WHERE b.aktif = 1
       ORDER BY b.kode ASC`
    );
    return list;
  }

  static async getBoxById(id: string): Promise<Box | null> {
    const rows = await executeQuery<Box>('SELECT * FROM box WHERE id = ?', [id]);
    if (!rows || rows.length === 0) return null;
    return rows[0];
  }

  static async getBoxByKode(kode: string): Promise<Box | null> {
    const cleanKode = kode.trim().toUpperCase();
    const rows = await executeQuery<Box>('SELECT * FROM box WHERE UPPER(kode) = ?', [cleanKode]);
    if (!rows || rows.length === 0) return null;
    return rows[0];
  }

  static async createBox(kode: string, keterangan?: string, userId?: string): Promise<Box> {
    const cleanKode = kode.trim().toUpperCase();

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

  static async canDeleteBox(id: string): Promise<{ canDelete: boolean; message?: string; existing?: Box }> {
    const existing = await this.getBoxById(id);
    if (!existing || !existing.aktif) {
      return { canDelete: false, message: 'Storage Box tidak ditemukan.' };
    }

    const itemRows = await executeQuery<TotalCountRow>(
      `SELECT COUNT(*) as total FROM item WHERE box_id = ? AND status IN ('aktif', 'dipesan')`,
      [id]
    );
    const activeItems = Number(itemRows[0]?.total || 0);

    const sjRows = await executeQuery<{ total: number | string; reserved: number | string }>(
      `SELECT COALESCE(SUM(jumlah), 0) as total, COALESCE(SUM(COALESCE(reserved_qty, 0)), 0) as reserved FROM stok_jumlah WHERE box_id = ?`,
      [id]
    );
    const activeSj = Number(sjRows[0]?.total || 0);
    const reservedSj = Number(sjRows[0]?.reserved || 0);

    if (activeItems > 0 || activeSj > 0 || reservedSj > 0) {
      return {
        canDelete: false,
        existing,
        message: `Tidak dapat menghapus Storage Box "${existing.kode}" karena masih menyimpan ${activeItems} item ber-ID dan ${activeSj} stok jumlah.`
      };
    }

    const reqRows = await executeQuery<TotalCountRow>(
      `SELECT COUNT(*) as total FROM request WHERE (box_id = ? OR return_box_id = ?) AND status IN ('diajukan', 'menunggu', 'disetujui')`,
      [id, id]
    );
    const openReqs = Number(reqRows[0]?.total || 0);
    if (openReqs > 0) {
      return {
        canDelete: false,
        existing,
        message: `Tidak dapat menghapus Storage Box "${existing.kode}" karena masih direferensikan oleh ${openReqs} request aktif.`
      };
    }

    return { canDelete: true, existing };
  }

  static async deleteBox(id: string, userId: string): Promise<{ success: boolean; message: string }> {
    const check = await this.canDeleteBox(id);
    if (!check.canDelete || !check.existing) {
      return { success: false, message: check.message || 'Storage Box tidak dapat dihapus.' };
    }
    const existing = check.existing;

    await TrashService.moveToTrash({
      jenis_objek: 'box',
      objek_id: existing.id,
      snapshot: existing,
      dihapus_oleh: userId,
      catatan: `Hapus Storage Box "${existing.kode}"`
    });

    await executeQuery('UPDATE box SET aktif = 0 WHERE id = ?', [existing.id]);
    return {
      success: true,
      message: `Storage Box "${existing.kode}" berhasil dihapus (disimpan di Kotak Sampah 14 hari).`
    };
  }

  /**
   * Mengambil seluruh isi box (dikelompokkan per produk dan tipe)
   */
  static async getBoxContents(boxId: string) {
    const box = await this.getBoxById(boxId);
    if (!box) {
      throw new Error(`Box ID "${boxId}" tidak ditemukan.`);
    }

    const items = await executeQuery<BoxItemDetailRow>(
      `SELECT i.*, t.nama_tipe, p.nama as nama_produk, j.nama as jenis_nama
       FROM item i
       JOIN tipe t ON i.tipe_id = t.id
       JOIN produk p ON t.produk_id = p.id
       JOIN jenis j ON p.jenis_id = j.id
       WHERE i.box_id = ? AND i.status = 'aktif'
       ORDER BY p.nama ASC, t.nama_tipe ASC, i.kode_id ASC`,
      [boxId]
    );

    const stokJumlahList = await executeQuery<BoxStokJumlahDetailRow>(
      `SELECT sj.*, t.nama_tipe, p.nama as nama_produk, j.nama as jenis_nama
       FROM stok_jumlah sj
       JOIN tipe t ON sj.tipe_id = t.id
       JOIN produk p ON t.produk_id = p.id
       JOIN jenis j ON p.jenis_id = j.id
       WHERE sj.box_id = ? AND sj.jumlah > 0
       ORDER BY p.nama ASC, t.nama_tipe ASC`,
      [boxId]
    );

    const grouped: { [produkNama: string]: { [tipeNama: string]: { items: BoxItemDetailRow[]; stokJumlah: number } } } = {};

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
      total_stok_jumlah: stokJumlahList.reduce((acc, cur) => acc + cur.jumlah, 0),
      contents: grouped,
      raw_items: items,
      raw_stok_jumlah: stokJumlahList
    };
  }

  /**
   * Memindahkan item fisik atau stok jumlah antar box
   */
  static async pindahBox(input: StockAttributionInput & {
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
        const sjRows = await conn.query(
          'SELECT * FROM stok_jumlah WHERE tipe_id = ? AND box_id = ?',
          [input.tipeId, input.boxAsalId]
        );
        const available = sjRows && sjRows.length > 0 ? Math.max(0, Number(sjRows[0].jumlah) - Number(sjRows[0].reserved_qty || 0)) : 0;
        if (available < input.jumlah) {
          throw new Error(`Stok tersedia di ${boxAsal.kode} (${available}) tidak mencukupi untuk dipindahkan.`);
        }

        const tipe = await CatalogService.getTipeById(input.tipeId);
        namaSnapshot = tipe ? `${tipe.produk_nama} - ${tipe.nama_tipe}` : `Tipe #${input.tipeId}`;

        await conn.query(
          'UPDATE stok_jumlah SET jumlah = jumlah - ? WHERE tipe_id = ? AND box_id = ?',
          [input.jumlah, input.tipeId, input.boxAsalId]
        );

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

      const txLog = await ActivityLogService.recordActivity({
        aksi: 'pindah_box',
        pelaku_id: input.actorId || input.userId,
        actor_id: input.actorId || input.userId,
        actor_nama: input.actorName,
        recorded_by_id: input.recordedById || input.userId,
        recorded_by_nama: input.recordedByName,
        recorded_by_role: input.recordedByRole,
        on_behalf_reason: input.onBehalfReason,
        occurred_at: input.occurredAt,
        tipe_mutasi: 'TRANSFER',
        reference_type: input.referenceType || 'PINDAH_BOX',
        reference_number: input.referenceNumber,
        recipient_destination: boxTujuan.kode,
        qty_total: movedCount,
        box_asal: boxAsal.kode,
        box_tujuan: boxTujuan.kode,
        catatan: input.catatan || `Pindah ${movedCount} unit dari ${boxAsal.kode} ke ${boxTujuan.kode}`,
        details: [
          {
            tipe_id: tipeId!,
            item_id: input.itemId || null,
            kode_id: input.itemId
              ? (await conn.query<KodeIdRow[]>('SELECT kode_id FROM item WHERE id = ?', [input.itemId]))[0]?.kode_id
              : null,
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
        activityId: txLog.idAktivitas
      };
    });
  }

  // ============================================================================
  // 2. PENCARIAN ITEM & DUPLIKASI ID
  // ============================================================================

  /**
   * Pencarian langsung berdasarkan SN/kode_id (partial/full), nama produk, nama tipe, atau kode box.
   * Mengembalikan semua kandidat yang cocok dengan flag `selectable` dan `unselectableReason` yang jelas.
   */
  static async searchStockItems(query: string): Promise<SearchStockItemResult[]> {
    const cleanQ = (query || '').trim();
    const pattern = `%${cleanQ}%`;

    const rows = await executeQuery<DuplicateItemRow & { jenis_nama?: string }>(
      `SELECT i.*, b.kode as kode_box, t.nama_tipe, p.nama as nama_produk, p.id as produk_id,
              p.kategori_barang, p.tipe_stok, j.nama as jenis_nama
       FROM item i
       JOIN box b ON i.box_id = b.id
       JOIN tipe t ON i.tipe_id = t.id
       JOIN produk p ON t.produk_id = p.id
       JOIN jenis j ON p.jenis_id = j.id
       WHERE p.aktif = 1 AND t.aktif = 1
         AND (
           UPPER(i.kode_id) LIKE UPPER(?)
           OR UPPER(p.nama) LIKE UPPER(?)
           OR UPPER(t.nama_tipe) LIKE UPPER(?)
           OR UPPER(b.kode) LIKE UPPER(?)
         )
       ORDER BY CASE WHEN i.status = 'aktif' THEN 0 WHEN i.status = 'dipesan' THEN 1 ELSE 2 END, p.nama ASC, i.kode_id ASC
       LIMIT 50`,
      [pattern, pattern, pattern, pattern]
    );

    return rows.map(row => {
      let unselectableReason: string | null = null;
      if (row.status === 'keluar') {
        unselectableReason = 'Sudah keluar / tidak tersedia di gudang';
      } else if (row.status === 'dipesan' || row.reserved_for_request_id) {
        unselectableReason = `Sedang dipesan untuk Request #${row.reserved_for_request_id || '-'}`;
      } else if (row.kondisi === 'Rusak') {
        unselectableReason = 'Kondisi Rusak — tidak dapat dikeluarkan sebagai barang layak';
      }

      return {
        ...row,
        selectable: unselectableReason === null && row.status === 'aktif',
        unselectableReason
      };
    });
  }

  /**
   * Cek keberadaan kode_id di seluruh sistem untuk mencegah duplikasi
   */
  static async checkDuplicateKodeId(kodeId: string): Promise<{ exists: boolean; item?: DuplicateItemRow }> {
    const cleanKode = kodeId.trim();
    const rows = await executeQuery<DuplicateItemRow>(
      `SELECT i.*, b.kode as kode_box, t.nama_tipe, p.nama as nama_produk,
              p.id as produk_id, p.kategori_barang, p.tipe_stok
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

  // ============================================================================
  // 3. INPUT STOK FISIK (SINGLE, BULK CAMERA SCANNER, & JUMLAH)
  // ============================================================================

  static async inputStokItemSingle(input: StockAttributionInput & {
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

    const dupCheck = await this.checkDuplicateKodeId(cleanKode);
    if (dupCheck.exists && dupCheck.item) {
      const it = dupCheck.item;
      throw new Error(
        `ID "${cleanKode}" sudah terdaftar pada produk "${it.nama_produk} - ${it.nama_tipe}" (Status: ${it.status}, Posisi: Box ${it.kode_box}).`
      );
    }

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

      await conn.query(
        `INSERT INTO item (id, kode_id, tipe_id, box_id, status, kondisi, catatan_kondisi) VALUES (?, ?, ?, ?, 'aktif', ?, ?)`,
        [itemId, cleanKode, input.tipe_id, input.box_id, kondisiItem, catatanKondisi]
      );

      await conn.query(`UPDATE tipe SET id_dikunci = 1 WHERE id = ?`, [input.tipe_id]);

      const namaSnapshot = `${tipe.produk_nama} - ${tipe.nama_tipe}`;

      const txLog = await ActivityLogService.recordActivity({
        aksi: 'tambah_item',
        pelaku_id: input.actorId || input.user_id,
        actor_id: input.actorId || input.user_id,
        actor_nama: input.actorName,
        recorded_by_id: input.recordedById || input.user_id,
        recorded_by_nama: input.recordedByName,
        recorded_by_role: input.recordedByRole,
        on_behalf_reason: input.onBehalfReason,
        occurred_at: input.occurredAt,
        request_id: input.requestId || null,
        tipe_mutasi: 'MASUK',
        reference_type: input.referenceType || 'SINGLE_SCAN',
        reference_number: input.referenceNumber || cleanKode,
        recipient_destination: input.recipientDestination || box.kode,
        qty_total: 1,
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

      return {
        success: true,
        message: `Berhasil menambahkan item [${cleanKode}] ke ${box.kode}.`,
        itemId,
        kodeId: cleanKode,
        activityId: txLog.idAktivitas,
        transaksiId: txLog.transaksiId
      };
    });
  }

  static async inputStokItemBulk(input: StockAttributionInput & {
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
      const rawList = input.kode_ids.map(s => s.trim()).filter(s => s.length > 0);
      const uniqueInputSet = new Set(rawList);
      finalKodeIds = Array.from(uniqueInputSet);
    } else {
      throw new Error('Harus memberikan daftar kode_ids atau angka auto_count.');
    }

    if (finalKodeIds.length === 0) {
      throw new Error('Daftar ID item fisik tidak boleh kosong.');
    }

    for (const kode of finalKodeIds) {
      const dupCheck = await this.checkDuplicateKodeId(kode);
      if (dupCheck.exists && dupCheck.item) {
        const it = dupCheck.item;
        throw new Error(
          `Gagal input massal: ID "${kode}" sudah ada di sistem (${it.nama_produk} - ${it.nama_tipe}, Box ${it.kode_box}).`
        );
      }

      if (tipe.pola_id && tipe.pola_id.trim().length > 0) {
        const regex = new RegExp(tipe.pola_id.trim());
        if (!regex.test(kode)) {
          throw new Error(`Gagal input massal: ID "${kode}" tidak cocok dengan pola regex: ${tipe.pola_id}`);
        }
      }
    }

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
      const detailsPayload: ActivityDetailInput[] = [];

      for (const kode of finalKodeIds) {
        const itemId = `item-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        await conn.query(
          `INSERT INTO item (id, kode_id, tipe_id, box_id, status) VALUES (?, ?, ?, ?, 'aktif')`,
          [itemId, kode, input.tipe_id, input.box_id]
        );

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

      await conn.query(`UPDATE tipe SET id_dikunci = 1 WHERE id = ?`, [input.tipe_id]);

      const txLog = await ActivityLogService.recordActivity({
        aksi: 'tambah_item_massal',
        pelaku_id: input.actorId || input.user_id,
        actor_id: input.actorId || input.user_id,
        actor_nama: input.actorName,
        recorded_by_id: input.recordedById || input.user_id,
        recorded_by_nama: input.recordedByName,
        recorded_by_role: input.recordedByRole,
        on_behalf_reason: input.onBehalfReason,
        occurred_at: input.occurredAt,
        request_id: input.requestId || null,
        tipe_mutasi: 'MASUK',
        reference_type: input.referenceType || 'BULK_SCAN',
        reference_number: input.referenceNumber || `BULK-${finalKodeIds.length}`,
        recipient_destination: input.recipientDestination || box.kode,
        qty_total: finalKodeIds.length,
        box_tujuan: box.kode,
        catatan: input.catatan || `Input stok massal ${finalKodeIds.length} unit di ${box.kode}`,
        details: detailsPayload
      }, conn);

      return {
        success: true,
        message: `Berhasil menambahkan batch ${finalKodeIds.length} unit item ke ${box.kode}.`,
        totalCount: finalKodeIds.length,
        activityId: txLog.idAktivitas,
        transaksiId: txLog.transaksiId,
        kodeIds: finalKodeIds
      };
    });
  }

  static async inputStokJumlah(input: StockAttributionInput & {
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

      await conn.query('UPDATE tipe SET id_dikunci = 1 WHERE id = ?', [input.tipe_id]);

      const namaSnapshot = `${tipe.produk_nama} - ${tipe.nama_tipe}`;

      const txLog = await ActivityLogService.recordActivity({
        aksi: 'tambah_stok_jumlah',
        pelaku_id: input.actorId || input.user_id,
        actor_id: input.actorId || input.user_id,
        actor_nama: input.actorName,
        recorded_by_id: input.recordedById || input.user_id,
        recorded_by_nama: input.recordedByName,
        recorded_by_role: input.recordedByRole,
        on_behalf_reason: input.onBehalfReason,
        occurred_at: input.occurredAt,
        request_id: input.requestId || null,
        tipe_mutasi: 'MASUK',
        reference_type: input.referenceType || 'QUANTITY_INPUT',
        reference_number: input.referenceNumber || `QTY-${input.jumlah}`,
        recipient_destination: input.recipientDestination || box.kode,
        qty_total: input.jumlah,
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

      return {
        success: true,
        message: `Berhasil menambahkan +${input.jumlah} unit ke ${box.kode}.`,
        activityId: txLog.idAktivitas,
        transaksiId: txLog.transaksiId
      };
    });
  }

  /**
   * Mengambil daftar ID item fisik aktif dan stok jumlah untuk satu Tipe
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

    const items = await executeQuery<TipeItemRow>(itemQuery, [tipeId]);

    const stokJumlah = await executeQuery<TipeStokJumlahRow>(
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
  // 4. BARANG KELUAR (TUNGGAL & KERANJANG KELUAR MULTI-ITEM), ARSIP, & RESTORE
  // ============================================================================

  static async barangKeluarSingle(input: StockAttributionInput & {
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
      const cleanKode = (input.kodeId || input.itemId || '').trim();
      const dupCheck = await this.checkDuplicateKodeId(cleanKode);
      let item = dupCheck.item;
      if (!item && input.itemId) {
        const byIdRows = await executeQuery<DuplicateItemRow>(
          `SELECT i.*, b.kode as kode_box, t.nama_tipe, p.nama as nama_produk
           FROM item i
           JOIN box b ON i.box_id = b.id
           JOIN tipe t ON i.tipe_id = t.id
           JOIN produk p ON t.produk_id = p.id
           WHERE i.id = ?`,
          [input.itemId]
        );
        item = byIdRows[0];
      }

      if (!item) {
        throw new Error(`Item dengan ID "${cleanKode}" tidak ditemukan di sistem.`);
      }
      if (item.status === 'keluar') {
        throw new Error(`Item "${item.kode_id}" sudah berstatus KELUAR dan tidak tersedia.`);
      }
      if (item.status === 'dipesan' && (!input.requestId || item.reserved_for_request_id !== input.requestId)) {
        throw new Error(`Item "${item.kode_id}" sedang dipesan untuk Request #${item.reserved_for_request_id || '-'}.`);
      }
      if (item.kondisi === 'Rusak') {
        throw new Error(`Item "${item.kode_id}" dalam kondisi RUSAK dan tidak dapat dikeluarkan.`);
      }

      const targetItem = item;
      return await runTransaction(async (conn) => {
        await conn.query('UPDATE item SET status = "keluar" WHERE id = ?', [targetItem.id]);

        const namaSnapshot = `${targetItem.nama_produk} - ${targetItem.nama_tipe}`;

        const txLog = await ActivityLogService.recordActivity({
          aksi: input.requestId ? 'ambil_request' : 'barang_keluar',
          pelaku_id: input.actorId || input.userId,
          actor_id: input.actorId || input.userId,
          actor_nama: input.actorName,
          recorded_by_id: input.recordedById || input.userId,
          recorded_by_nama: input.recordedByName,
          recorded_by_role: input.recordedByRole,
          on_behalf_reason: input.onBehalfReason,
          occurred_at: input.occurredAt,
          request_id: input.requestId || null,
          tipe_mutasi: 'KELUAR',
          reference_type: input.referenceType || (input.requestId ? 'REQUEST_PICKUP' : 'STOCK_OUT'),
          reference_number: input.referenceNumber || targetItem.kode_id,
          recipient_destination: input.recipientDestination || input.actorName || targetItem.kode_box || 'Lapangan',
          qty_total: 1,
          box_asal: targetItem.kode_box,
          catatan: input.catatan || `Barang keluar item ber-ID (${targetItem.kode_id})`,
          details: [
            {
              tipe_id: targetItem.tipe_id,
              item_id: targetItem.id,
              kode_id: targetItem.kode_id,
              nama_snapshot: namaSnapshot,
              jumlah: 1,
              status_sebelum: targetItem.status,
              status_sesudah: 'keluar'
            }
          ]
        }, conn);

        if (input.requestId) {
          await conn.query(
            `UPDATE request SET status = 'diambil', taken_at = ?, transaction_out_id = ?, allocated_item_ids = ? WHERE id = ?`,
            [toMysqlUtcDatetime(txLog.occurredAtIso), txLog.transaksiId, JSON.stringify([targetItem.id]), input.requestId]
          );
        }

        return {
          success: true,
          message: `Item "${targetItem.kode_id}" (${namaSnapshot}) berhasil dikeluarkan.`,
          activityId: txLog.idAktivitas,
          transaksiId: txLog.transaksiId
        };
      });
    } else if (input.tipeId && input.boxId && input.jumlah && input.jumlah > 0) {
      const tipe = await CatalogService.getTipeById(input.tipeId);
      if (!tipe) throw new Error(`Tipe #${input.tipeId} tidak ditemukan.`);

      const box = await this.getBoxById(input.boxId);
      if (!box) throw new Error(`Box ID "${input.boxId}" tidak ditemukan.`);

      return await runTransaction(async (conn) => {
        const sjRows = await conn.query(
          'SELECT jumlah, COALESCE(reserved_qty, 0) as reserved_qty FROM stok_jumlah WHERE tipe_id = ? AND box_id = ?',
          [input.tipeId, input.boxId]
        );

        const row = sjRows && sjRows[0];
        const totalQty = row ? Number(row.jumlah || 0) : 0;
        const reservedQty = row ? Number(row.reserved_qty || 0) : 0;
        const availableQty = input.requestId ? totalQty : Math.max(0, totalQty - reservedQty);

        if (availableQty < input.jumlah!) {
          throw new Error(`Stok tersedia di ${box.kode} tidak mencukupi (Tersedia: ${availableQty}, Diminta: ${input.jumlah}).`);
        }

        await conn.query(
          'UPDATE stok_jumlah SET jumlah = jumlah - ? WHERE tipe_id = ? AND box_id = ?',
          [input.jumlah, input.tipeId, input.boxId]
        );

        const namaSnapshot = `${tipe.produk_nama} - ${tipe.nama_tipe}`;
        const outQty = input.jumlah!;

        const txLog = await ActivityLogService.recordActivity({
          aksi: input.requestId ? 'ambil_request' : 'barang_keluar_jumlah',
          pelaku_id: input.actorId || input.userId,
          actor_id: input.actorId || input.userId,
          actor_nama: input.actorName,
          recorded_by_id: input.recordedById || input.userId,
          recorded_by_nama: input.recordedByName,
          recorded_by_role: input.recordedByRole,
          on_behalf_reason: input.onBehalfReason,
          occurred_at: input.occurredAt,
          request_id: input.requestId || null,
          tipe_mutasi: 'KELUAR',
          reference_type: input.referenceType || (input.requestId ? 'REQUEST_PICKUP' : 'STOCK_OUT'),
          reference_number: input.referenceNumber || `QTY-OUT-${outQty}`,
          recipient_destination: input.recipientDestination || box.kode,
          qty_total: outQty,
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
        } as any, conn);

        if (input.requestId) {
          await conn.query(
            `UPDATE request SET status = 'diambil', taken_at = ?, transaction_out_id = ? WHERE id = ?`,
            [toMysqlUtcDatetime(txLog.occurredAtIso), txLog.transaksiId, input.requestId]
          );
        }

        return {
          success: true,
          message: `Stok jumlah -${outQty} unit (${namaSnapshot}) di ${box.kode} berhasil dikeluarkan.`,
          activityId: txLog.idAktivitas,
          transaksiId: txLog.transaksiId
        };
      });
    }

    throw new Error('Parameter barang keluar tidak lengkap.');
  }

  /**
   * Barang Keluar Massal / Keranjang Keluar (mendukung campuran item ber-ID dan TANPA_ID qty secara atomik)
   */
  static async barangKeluarBulk(input: StockAttributionInput & {
    items: Array<{ kodeId?: string; itemId?: string; tipeId?: number; boxId?: string; jumlah?: number }>;
    userId: string;
    catatan?: string;
    confirmationToken?: string;
  }) {
    if (!input.items || input.items.length === 0) {
      throw new Error('Daftar barang keluar tidak boleh kosong.');
    }

    if (input.confirmationToken) {
      const validation = await ConfirmationService.consumeConfirmationToken(
        input.confirmationToken,
        input.userId,
        'bulk_stock_out',
        'bulk'
      );
      if (!validation.valid) {
        throw new Error(`Konfirmasi Tingkat 2 gagal: ${validation.message}`);
      }
    }

    // Validasi awal seluruh item dalam keranjang agar gagal bersih jika ada yang tidak tersedia
    const seenItemIds = new Set<string>();
    const validatedIdItems: DuplicateItemRow[] = [];
    const validatedQtyItems: Array<{ tipeId: number; boxId: string; boxKode: string; namaSnapshot: string; jumlah: number }> = [];

    for (const entry of input.items) {
      if (entry.kodeId || entry.itemId) {
        const lookupKey = (entry.kodeId || entry.itemId || '').trim();
        let found: DuplicateItemRow | undefined;
        if (entry.kodeId) {
          const dup = await this.checkDuplicateKodeId(lookupKey);
          found = dup.item;
        }
        if (!found && entry.itemId) {
          const rows = await executeQuery<DuplicateItemRow>(
            `SELECT i.*, b.kode as kode_box, t.nama_tipe, p.nama as nama_produk
             FROM item i
             JOIN box b ON i.box_id = b.id
             JOIN tipe t ON i.tipe_id = t.id
             JOIN produk p ON t.produk_id = p.id
             WHERE i.id = ? OR UPPER(i.kode_id) = UPPER(?)`,
            [entry.itemId, lookupKey]
          );
          found = rows[0];
        }

        if (!found) {
          throw new Error(`Item "${lookupKey}" tidak ditemukan di katalog inventori.`);
        }
        if (found.status === 'keluar') {
          throw new Error(`Item "${found.kode_id}" sudah keluar dan tidak tersedia.`);
        }
        if (found.status === 'dipesan' && (!input.requestId || found.reserved_for_request_id !== input.requestId)) {
          throw new Error(`Item "${found.kode_id}" sedang dipesan untuk Request #${found.reserved_for_request_id || '-'}.`);
        }
        if (found.kondisi === 'Rusak') {
          throw new Error(`Item "${found.kode_id}" berstatus RUSAK dan tidak boleh dikeluarkan.`);
        }
        if (seenItemIds.has(found.id)) {
          throw new Error(`Item "${found.kode_id}" duplikat di daftar barang keluar.`);
        }
        seenItemIds.add(found.id);
        validatedIdItems.push(found);
      } else if (entry.tipeId && entry.boxId && entry.jumlah && entry.jumlah > 0) {
        const tipe = await CatalogService.getTipeById(entry.tipeId);
        if (!tipe) throw new Error(`Tipe #${entry.tipeId} tidak ditemukan.`);
        const box = await this.getBoxById(entry.boxId);
        if (!box) throw new Error(`Box "${entry.boxId}" tidak ditemukan.`);

        const sjRows = await executeQuery<{ jumlah: number; reserved_qty?: number }>(
          'SELECT jumlah, COALESCE(reserved_qty, 0) as reserved_qty FROM stok_jumlah WHERE tipe_id = ? AND box_id = ?',
          [entry.tipeId, entry.boxId]
        );
        const total = sjRows[0] ? Number(sjRows[0].jumlah || 0) : 0;
        const reserved = sjRows[0] ? Number(sjRows[0].reserved_qty || 0) : 0;
        const avail = input.requestId ? total : Math.max(0, total - reserved);
        if (avail < entry.jumlah) {
          throw new Error(`Stok "${tipe.produk_nama} - ${tipe.nama_tipe}" di ${box.kode} tidak mencukupi (Tersedia: ${avail}, Diminta: ${entry.jumlah}).`);
        }
        validatedQtyItems.push({
          tipeId: entry.tipeId,
          boxId: entry.boxId,
          boxKode: box.kode,
          namaSnapshot: `${tipe.produk_nama} - ${tipe.nama_tipe}`,
          jumlah: entry.jumlah
        });
      } else {
        throw new Error('Entri barang keluar tidak valid.');
      }
    }

    return await runTransaction(async (conn) => {
      const detailsPayload: ActivityDetailInput[] = [];
      let totalOutCount = 0;
      const boxCodes = new Set<string>();
      const allocatedIds: string[] = [];

      for (const item of validatedIdItems) {
        await conn.query('UPDATE item SET status = "keluar" WHERE id = ?', [item.id]);
        allocatedIds.push(item.id);
        if (item.kode_box) boxCodes.add(item.kode_box);

        detailsPayload.push({
          tipe_id: item.tipe_id,
          item_id: item.id,
          kode_id: item.kode_id,
          nama_snapshot: `${item.nama_produk} - ${item.nama_tipe}`,
          jumlah: 1,
          status_sebelum: item.status,
          status_sesudah: 'keluar'
        });
        totalOutCount++;
      }

      for (const qItem of validatedQtyItems) {
        await conn.query(
          'UPDATE stok_jumlah SET jumlah = jumlah - ? WHERE tipe_id = ? AND box_id = ?',
          [qItem.jumlah, qItem.tipeId, qItem.boxId]
        );
        boxCodes.add(qItem.boxKode);

        detailsPayload.push({
          tipe_id: qItem.tipeId,
          item_id: null,
          kode_id: null,
          nama_snapshot: qItem.namaSnapshot,
          jumlah: qItem.jumlah,
          status_sebelum: 'aktif',
          status_sesudah: 'keluar'
        });
        totalOutCount += qItem.jumlah;
      }

      const boxAsalJoined = Array.from(boxCodes).join(', ') || null;

      const txLog = await ActivityLogService.recordActivity({
        aksi: input.requestId ? 'ambil_request' : 'barang_keluar_massal',
        pelaku_id: input.actorId || input.userId,
        actor_id: input.actorId || input.userId,
        actor_nama: input.actorName,
        recorded_by_id: input.recordedById || input.userId,
        recorded_by_nama: input.recordedByName,
        recorded_by_role: input.recordedByRole,
        on_behalf_reason: input.onBehalfReason,
        occurred_at: input.occurredAt,
        request_id: input.requestId || null,
        tipe_mutasi: 'KELUAR',
        reference_type: input.referenceType || (input.requestId ? 'REQUEST_PICKUP' : 'BULK_DISPATCH'),
        reference_number: input.referenceNumber || `OUT-${totalOutCount}`,
        recipient_destination: input.recipientDestination || input.actorName || 'Lapangan',
        qty_total: totalOutCount,
        box_asal: boxAsalJoined,
        catatan: input.catatan || `Barang keluar (${totalOutCount} unit)`,
        details: detailsPayload
      }, conn);

      if (input.requestId) {
        await conn.query(
          `UPDATE request SET status = 'diambil', taken_at = ?, transaction_out_id = ?, allocated_item_ids = ? WHERE id = ?`,
          [
            toMysqlUtcDatetime(txLog.occurredAtIso),
            txLog.transaksiId,
            allocatedIds.length > 0 ? JSON.stringify(allocatedIds) : null,
            input.requestId
          ]
        );
      }

      return {
        success: true,
        message: `Berhasil mengeluarkan ${totalOutCount} unit barang.`,
        totalCount: totalOutCount,
        activityId: txLog.idAktivitas,
        transaksiId: txLog.transaksiId
      };
    });
  }

  /**
   * Menampilkan Daftar Arsip Barang Keluar
   */
  static async listArsip(filters?: { search?: string }): Promise<ArchiveItemRow[]> {
    let sql = `
      SELECT i.*, b.kode as kode_box, t.nama_tipe, p.nama as nama_produk, j.nama as jenis_nama
      FROM item i
      JOIN box b ON i.box_id = b.id
      JOIN tipe t ON i.tipe_id = t.id
      JOIN produk p ON t.produk_id = p.id
      JOIN jenis j ON p.jenis_id = j.id
      WHERE i.status = 'keluar'
    `;
    const params: unknown[] = [];

    if (filters?.search) {
      sql += ' AND (UPPER(i.kode_id) LIKE UPPER(?) OR UPPER(p.nama) LIKE UPPER(?) OR UPPER(t.nama_tipe) LIKE UPPER(?))';
      params.push(`%${filters.search.trim()}%`, `%${filters.search.trim()}%`, `%${filters.search.trim()}%`);
    }

    sql += ' ORDER BY i.dibuat_pada DESC';

    return await executeQuery<ArchiveItemRow>(sql, params);
  }

  /**
   * Restore Item dari Arsip ke Stok Aktif di Box Pilihan
   */
  static async restoreItemFromArchive(input: StockAttributionInput & {
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

    const checkRes = await this.checkDuplicateKodeId(cleanKode);

    if (checkRes.exists && checkRes.item?.status === 'aktif') {
      return {
        success: false,
        isAlreadyActive: true,
        message: `ID "${cleanKode}" saat ini sudah AKTIF di Box ${checkRes.item.kode_box} (${checkRes.item.nama_produk} - ${checkRes.item.nama_tipe}). Tidak dapat diduplikasi.`
      };
    }

    if (!checkRes.exists || !checkRes.item) {
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

    if (!input.confirmProductMatched) {
      return {
        success: false,
        requiresMatchConfirmation: true,
        itemData: item,
        message: `Mohon konfirmasi bahwa produk yang dikembalikan adalah "${item.nama_produk} - ${item.nama_tipe}".`
      };
    }

    const targetKondisi = input.kondisi || item.kondisi || 'Baik';
    const targetCatatanKondisi = input.catatanKondisi !== undefined
      ? (input.catatanKondisi ? input.catatanKondisi.trim() : null)
      : (item.catatan_kondisi || null);

    return await runTransaction(async (conn) => {
      await conn.query(
        'UPDATE item SET status = "aktif", box_id = ?, kondisi = ?, catatan_kondisi = ? WHERE id = ?',
        [input.targetBoxId, targetKondisi, targetCatatanKondisi, item.id]
      );

      const namaSnapshot = `${item.nama_produk} - ${item.nama_tipe}`;

      const txLog = await ActivityLogService.recordActivity({
        aksi: 'restore_item',
        pelaku_id: input.actorId || input.userId,
        actor_id: input.actorId || input.userId,
        actor_nama: input.actorName,
        recorded_by_id: input.recordedById || input.userId,
        recorded_by_nama: input.recordedByName,
        recorded_by_role: input.recordedByRole,
        on_behalf_reason: input.onBehalfReason,
        occurred_at: input.occurredAt,
        request_id: input.requestId || null,
        tipe_mutasi: 'MASUK',
        reference_type: input.referenceType || 'RESTORE_ARSIP',
        reference_number: input.referenceNumber || cleanKode,
        recipient_destination: targetBox.kode,
        qty_total: 1,
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
        activityId: txLog.idAktivitas,
        transaksiId: txLog.transaksiId
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
    const rows = await executeQuery<ItemFisik>('SELECT * FROM item WHERE id = ? OR kode_id = ?', [input.itemId, input.itemId]);
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
