/**
 * Catalog Service (Jenis, Atribut, Produk, Tipe)
 * FieldOps Inventory v2 - Tahap 2: Katalog Bertingkat
 * Mengelola struktur katalog modular, nama tipe otomatis, dan aturan ID per tipe.
 */

import { executeQuery, runTransaction } from '../db/database';
import { ActivityLogService } from './activityLogService';
import { TrashService } from './trashService';

export interface AtributOpsi {
  id: number;
  atribut_id: number;
  nilai: string;
  urutan: number;
}

export interface Atribut {
  id: number;
  jenis_id: number;
  kode: string;
  nama: string;
  tipe_isian: 'angka' | 'pilihan' | 'teks';
  satuan?: string | null;
  wajib: boolean | number;
  urutan: number;
  masuk_nama: boolean | number;
  opsi?: AtributOpsi[];
}

export interface Jenis {
  id: number;
  nama: string;
  sumber_id_bawaan: 'scan_sn' | 'otomatis' | 'manual' | 'tanpa_id';
  prefix_id_bawaan?: string | null;
  aktif: boolean | number;
  dibuat_pada: string;
  atributs?: Atribut[];
  total_produk?: number;
}

export interface Produk {
  id: number;
  jenis_id: number;
  jenis_nama?: string;
  nama: string;
  kategori: 'fast_moving' | 'recycle';
  kategori_barang?: 'Alat' | 'Barang Habis Pakai';
  tipe_stok?: string;
  catatan?: string | null;
  aktif: boolean | number;
  dibuat_oleh?: string | null;
  dibuat_pada: string;
  total_stok?: number;
  stok_rusak?: number;
  tipes?: Tipe[];
  total_tipe?: number;
}

export interface NilaiAtributInput {
  atribut_id: number;
  nilai_angka?: number | null;
  opsi_id?: number | null;
  opsi_baru?: string | null;
  nilai_teks?: string | null;
}

export interface Tipe {
  id: number;
  produk_id: number;
  produk_nama?: string;
  jenis_nama?: string;
  nama_tipe: string;
  catatan?: string | null;
  sumber_id: 'scan_sn' | 'otomatis' | 'manual' | 'tanpa_id';
  mode_stok: 'per_id' | 'jumlah';
  prefix_id?: string | null;
  pola_id?: string | null;
  id_dikunci: boolean | number;
  aktif: boolean | number;
  dibuat_pada: string;
  stok_total?: number;
  stok_tersedia?: number;
  stok_rusak?: number;
  stok_per_kondisi?: {
    baru: number;
    baik: number;
    perlu_perbaikan: number;
    rusak: number;
  };
  sebaran_box?: Array<{ box_id: string; box_kode: string; box_keterangan?: string; jumlah: number }>;
  riwayat_terakhir?: Array<{
    id_aktivitas: string;
    aksi: string;
    waktu: string;
    catatan?: string;
    nama_pelaku?: string;
    jumlah?: number;
    kode_id?: string;
    status_sebelum?: string;
    status_sesudah?: string;
  }>;
  nilai_atribut?: Array<{
    atribut_id: number;
    atribut_nama: string;
    tipe_isian: string;
    satuan?: string;
    nilai_tampil: string;
    nilai_angka?: number;
    opsi_id?: number;
    nilai_teks?: string;
  }>;
}

export class CatalogService {
  // ============================================================================
  // 1. JENIS
  // ============================================================================

  static async listJenis(): Promise<Jenis[]> {
    const list = await executeQuery<any>(
      `SELECT j.*, COUNT(p.id) as total_produk
       FROM jenis j
       LEFT JOIN produk p ON j.id = p.jenis_id AND p.aktif = 1
       WHERE j.aktif = 1
       GROUP BY j.id
       ORDER BY j.nama ASC`
    );

    for (const j of list) {
      j.atributs = await this.listAtributByJenis(j.id);
    }

    return list;
  }

  static async getJenisById(id: number): Promise<Jenis | null> {
    const rows = await executeQuery<any>('SELECT * FROM jenis WHERE id = ?', [id]);
    if (!rows || rows.length === 0) return null;
    const j = rows[0];
    j.atributs = await this.listAtributByJenis(id);
    return j;
  }

  static async createJenis(input: {
    nama: string;
    sumber_id_bawaan?: 'scan_sn' | 'otomatis' | 'manual' | 'tanpa_id';
    prefix_id_bawaan?: string;
    atributs?: Array<{
      kode: string;
      nama: string;
      tipe_isian: 'angka' | 'pilihan' | 'teks';
      satuan?: string;
      wajib?: boolean;
      urutan?: number;
      masuk_nama?: boolean;
      opsi?: string[];
    }>;
  }, userId: string): Promise<Jenis> {
    const cleanNama = input.nama.trim();
    const sumberId = input.sumber_id_bawaan || 'manual';
    const prefixId = input.prefix_id_bawaan ? input.prefix_id_bawaan.trim() : null;

    return await runTransaction(async (conn) => {
      const res = await conn.query(
        `INSERT INTO jenis (nama, sumber_id_bawaan, prefix_id_bawaan, aktif)
         VALUES (?, ?, ?, 1)`,
        [cleanNama, sumberId, prefixId]
      );

      const jenisId = res.insertId || res.id;

      if (input.atributs && input.atributs.length > 0) {
        for (let i = 0; i < input.atributs.length; i++) {
          const a = input.atributs[i];
          const aRes = await conn.query(
            `INSERT INTO atribut (jenis_id, kode, nama, tipe_isian, satuan, wajib, urutan, masuk_nama)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              jenisId,
              a.kode.trim().toLowerCase(),
              a.nama.trim(),
              a.tipe_isian,
              a.satuan ? a.satuan.trim() : null,
              a.wajib !== false ? 1 : 0,
              typeof a.urutan === 'number' ? a.urutan : i,
              a.masuk_nama !== false ? 1 : 0
            ]
          );

          const atributId = aRes.insertId || aRes.id;
          if (a.tipe_isian === 'pilihan' && a.opsi && a.opsi.length > 0) {
            for (let j = 0; j < a.opsi.length; j++) {
              await conn.query(
                `INSERT INTO atribut_opsi (atribut_id, nilai, urutan) VALUES (?, ?, ?)`,
                [atributId, a.opsi[j].trim(), j]
              );
            }
          }
        }
      }

      await ActivityLogService.recordActivity({
        aksi: 'tambah_jenis',
        pelaku_id: userId,
        catatan: `Menambahkan Jenis baru: ${cleanNama}`
      });

      const created = await this.getJenisById(jenisId);
      return created!;
    });
  }

  static async updateJenis(id: number, input: {
    nama: string;
    sumber_id_bawaan?: 'scan_sn' | 'otomatis' | 'manual' | 'tanpa_id';
    prefix_id_bawaan?: string;
  }, userId: string): Promise<Jenis> {
    const cleanNama = input.nama.trim();
    await executeQuery(
      `UPDATE jenis SET nama = ?, sumber_id_bawaan = ?, prefix_id_bawaan = ? WHERE id = ?`,
      [cleanNama, input.sumber_id_bawaan || 'manual', input.prefix_id_bawaan || null, id]
    );

    await ActivityLogService.recordActivity({
      aksi: 'ubah_jenis',
      pelaku_id: userId,
      catatan: `Mengubah data Jenis #${id} (${cleanNama})`
    });

    const updated = await this.getJenisById(id);
    return updated!;
  }

  static async deleteJenis(id: number, userId: string): Promise<{ success: boolean; message: string }> {
    const existing = await this.getJenisById(id);
    if (!existing) {
      return { success: false, message: 'Jenis tidak ditemukan.' };
    }

    // Blokir jika masih punya produk aktif
    const prods = await executeQuery<any>('SELECT id FROM produk WHERE jenis_id = ? AND aktif = 1', [id]);
    if (prods && prods.length > 0) {
      return {
        success: false,
        message: `Tidak dapat menghapus Jenis "${existing.nama}" karena masih memiliki ${prods.length} produk aktif di dalamnya.`
      };
    }

    // Pindahkan ke sampah hapus permanen 14 hari
    await TrashService.moveToTrash({
      jenis_objek: 'jenis',
      objek_id: String(id),
      snapshot: existing,
      dihapus_oleh: userId,
      catatan: `Hapus permanen Jenis "${existing.nama}"`
    });

    await executeQuery('UPDATE jenis SET aktif = 0 WHERE id = ?', [id]);
    return { success: true, message: `Jenis "${existing.nama}" berhasil dihapus (disimpan di tempat sampah 14 hari).` };
  }

  // ============================================================================
  // 2. ATRIBUT & OPSI
  // ============================================================================

  static async listAtributByJenis(jenisId: number): Promise<Atribut[]> {
    const atributs = await executeQuery<any>(
      `SELECT * FROM atribut WHERE jenis_id = ? ORDER BY urutan ASC, id ASC`,
      [jenisId]
    );

    for (const a of atributs) {
      if (a.tipe_isian === 'pilihan') {
        a.opsi = await executeQuery<any>(
          `SELECT * FROM atribut_opsi WHERE atribut_id = ? ORDER BY urutan ASC, id ASC`,
          [a.id]
        );
      } else {
        a.opsi = [];
      }
    }

    return atributs;
  }

  static async createAtribut(input: {
    jenis_id: number;
    kode: string;
    nama: string;
    tipe_isian: 'angka' | 'pilihan' | 'teks';
    satuan?: string;
    wajib?: boolean;
    urutan?: number;
    masuk_nama?: boolean;
    opsi?: string[];
  }): Promise<Atribut> {
    const kode = input.kode.trim().toLowerCase();
    const nama = input.nama.trim();

    return await runTransaction(async (conn) => {
      const res = await conn.query(
        `INSERT INTO atribut (jenis_id, kode, nama, tipe_isian, satuan, wajib, urutan, masuk_nama)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.jenis_id,
          kode,
          nama,
          input.tipe_isian,
          input.satuan ? input.satuan.trim() : null,
          input.wajib !== false ? 1 : 0,
          typeof input.urutan === 'number' ? input.urutan : 0,
          input.masuk_nama !== false ? 1 : 0
        ]
      );

      const atributId = res.insertId || res.id;
      const opsiList: AtributOpsi[] = [];

      if (input.tipe_isian === 'pilihan' && input.opsi && input.opsi.length > 0) {
        for (let i = 0; i < input.opsi.length; i++) {
          const val = input.opsi[i].trim();
          if (val) {
            const oRes = await conn.query(
              `INSERT INTO atribut_opsi (atribut_id, nilai, urutan) VALUES (?, ?, ?)`,
              [atributId, val, i]
            );
            opsiList.push({ id: oRes.insertId || oRes.id, atribut_id: atributId, nilai: val, urutan: i });
          }
        }
      }

      return {
        id: atributId,
        jenis_id: input.jenis_id,
        kode,
        nama,
        tipe_isian: input.tipe_isian,
        satuan: input.satuan || null,
        wajib: input.wajib !== false,
        urutan: input.urutan || 0,
        masuk_nama: input.masuk_nama !== false,
        opsi: opsiList
      };
    });
  }

  static async addAtributOpsi(atributId: number, nilai: string): Promise<AtributOpsi> {
    const cleanNilai = nilai.trim();
    // Cek apakah opsi sudah ada
    const existing = await executeQuery<any>(
      'SELECT * FROM atribut_opsi WHERE atribut_id = ? AND LOWER(nilai) = LOWER(?)',
      [atributId, cleanNilai]
    );

    if (existing && existing.length > 0) {
      return existing[0];
    }

    const res: any = await executeQuery(
      `INSERT INTO atribut_opsi (atribut_id, nilai, urutan) VALUES (?, ?, 0)`,
      [atributId, cleanNilai]
    );

    return {
      id: res.insertId || res.id,
      atribut_id: atributId,
      nilai: cleanNilai,
      urutan: 0
    };
  }

  // ============================================================================
  // 3. PRODUK
  // ============================================================================

  static async listProduk(filters?: { jenis_id?: number; kategori?: string; kategori_barang?: string; search?: string }): Promise<Produk[]> {
    let sql = `
      SELECT p.*, j.nama as jenis_nama, COUNT(DISTINCT t.id) as total_tipe
      FROM produk p
      JOIN jenis j ON p.jenis_id = j.id
      LEFT JOIN tipe t ON p.id = t.produk_id AND t.aktif = 1
      WHERE p.aktif = 1
    `;
    const params: any[] = [];

    if (filters?.jenis_id) {
      sql += ' AND p.jenis_id = ?';
      params.push(filters.jenis_id);
    }

    if (filters?.kategori) {
      sql += ' AND p.kategori = ?';
      params.push(filters.kategori);
    }

    if (filters?.kategori_barang) {
      sql += ' AND (p.kategori_barang = ? OR (? = "Barang Habis Pakai" AND p.kategori_barang IS NULL))';
      params.push(filters.kategori_barang, filters.kategori_barang);
    }

    if (filters?.search) {
      sql += ' AND (LOWER(p.nama) LIKE ? OR LOWER(j.nama) LIKE ?)';
      params.push(`%${filters.search.toLowerCase()}%`, `%${filters.search.toLowerCase()}%`);
    }

    sql += ' GROUP BY p.id ORDER BY p.nama ASC';

    const prods = await executeQuery<any>(sql, params);

    for (const p of prods) {
      const pId = Number(p.id);
      p.kategori_barang = p.kategori_barang || 'Barang Habis Pakai';
      p.tipe_stok = p.tipe_stok || 'unit';

      const tipes = await executeQuery<any>('SELECT id FROM tipe WHERE produk_id = ? AND aktif = 1', [pId]);
      let totalItemCount = 0;
      let totalSjCount = 0;
      let totalRusakCount = 0;

      if (tipes && tipes.length > 0) {
        for (const t of tipes) {
          const tId = Number(t.id);

          // Stok aktif & kondisi bukan Rusak = stok tersedia
          const itemStok = await executeQuery<any>(
            `SELECT COUNT(id) as total FROM item WHERE tipe_id = ? AND status = 'aktif' AND (kondisi IS NULL OR kondisi != 'Rusak')`,
            [tId]
          );
          totalItemCount += Number(itemStok[0]?.total || 0);

          // Stok rusak
          const itemRusak = await executeQuery<any>(
            `SELECT COUNT(id) as total FROM item WHERE tipe_id = ? AND status = 'aktif' AND kondisi = 'Rusak'`,
            [tId]
          );
          totalRusakCount += Number(itemRusak[0]?.total || 0);

          const sjStok = await executeQuery<any>(
            `SELECT COALESCE(SUM(jumlah), 0) as total FROM stok_jumlah WHERE tipe_id = ?`,
            [tId]
          );
          totalSjCount += Number(sjStok[0]?.total || 0);
        }
      }

      p.total_stok = totalItemCount + totalSjCount;
      p.stok_rusak = totalRusakCount;
      p.total_tipe = Number(p.total_tipe || (tipes ? tipes.length : 0));
    }

    return prods;
  }

  static async getProdukById(id: number): Promise<Produk | null> {
    const rows = await executeQuery<any>(
      `SELECT p.*, j.nama as jenis_nama
       FROM produk p
       JOIN jenis j ON p.jenis_id = j.id
       WHERE p.id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) return null;
    const prod = rows[0];
    prod.kategori_barang = prod.kategori_barang || 'Barang Habis Pakai';
    prod.tipe_stok = prod.tipe_stok || 'unit';
    prod.tipes = await this.listTipeByProduk(id);
    return prod;
  }

  static async createProduk(input: {
    jenis_id: number;
    nama: string;
    kategori: 'fast_moving' | 'recycle';
    kategori_barang?: 'Alat' | 'Barang Habis Pakai';
    tipe_stok?: string;
    catatan?: string;
  }, userId: string): Promise<Produk> {
    const cleanNama = input.nama.trim();
    const kategoriBarang = input.kategori_barang || 'Barang Habis Pakai';
    const tipeStok = (input.tipe_stok || 'unit').trim().toLowerCase();

    const res: any = await executeQuery(
      `INSERT INTO produk (jenis_id, nama, kategori, kategori_barang, tipe_stok, catatan, aktif, dibuat_oleh)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [input.jenis_id, cleanNama, input.kategori, kategoriBarang, tipeStok, input.catatan || null, userId]
    );

    const prodId = res.insertId || res.id;

    await ActivityLogService.recordActivity({
      aksi: 'tambah_produk',
      pelaku_id: userId,
      catatan: `Menambahkan Produk baru: "${cleanNama}" (${kategoriBarang}, Tipe Stok: ${tipeStok})`
    });

    const created = await this.getProdukById(prodId);
    return created!;
  }

  static async updateProduk(id: number, input: {
    nama: string;
    kategori: 'fast_moving' | 'recycle';
    kategori_barang?: 'Alat' | 'Barang Habis Pakai';
    tipe_stok?: string;
    catatan?: string;
  }, userId: string): Promise<Produk> {
    const cleanNama = input.nama.trim();
    const kategoriBarang = input.kategori_barang || 'Barang Habis Pakai';
    const tipeStok = (input.tipe_stok || 'unit').trim().toLowerCase();

    await executeQuery(
      `UPDATE produk SET nama = ?, kategori = ?, kategori_barang = ?, tipe_stok = ?, catatan = ? WHERE id = ?`,
      [cleanNama, input.kategori, kategoriBarang, tipeStok, input.catatan || null, id]
    );

    await ActivityLogService.recordActivity({
      aksi: 'ubah_produk',
      pelaku_id: userId,
      catatan: `Memperbarui Produk #${id} ("${cleanNama}", ${kategoriBarang}, Tipe Stok: ${tipeStok})`
    });

    const updated = await this.getProdukById(id);
    return updated!;
  }

  static async getTipeStokSuggestions(): Promise<string[]> {
    const rows = await executeQuery<any>('SELECT DISTINCT tipe_stok FROM produk WHERE tipe_stok IS NOT NULL AND tipe_stok != ""');
    const existing = rows.map((r: any) => String(r.tipe_stok).toLowerCase().trim());
    const defaults = ['unit', 'roll', 'pcs', 'meter', 'box', 'pack', 'set'];
    const combined = Array.from(new Set([...defaults, ...existing]));
    return combined;
  }

  static async deleteProduk(id: number, userId: string): Promise<{ success: boolean; message: string }> {
    const existing = await this.getProdukById(id);
    if (!existing) {
      return { success: false, message: 'Produk tidak ditemukan.' };
    }

    // Pindahkan ke tempat sampah hapus permanen 14 hari
    await TrashService.moveToTrash({
      jenis_objek: 'produk',
      objek_id: String(id),
      snapshot: existing,
      dihapus_oleh: userId,
      catatan: `Hapus permanen Produk "${existing.nama}"`
    });

    await executeQuery('UPDATE produk SET aktif = 0 WHERE id = ?', [id]);
    return { success: true, message: `Produk "${existing.nama}" berhasil dihapus (disimpan di tempat sampah 14 hari).` };
  }

  // ============================================================================
  // 4. TIPE (Varian Produk & Otomatisasi Nama Tipe)
  // ============================================================================

  /**
   * Membentuk nama tipe otomatis dari nilai-nilai atribut yang masuk_nama = 1
   */
  static generateTipeName(atributs: Atribut[], values: NilaiAtributInput[]): string {
    const nameParts: string[] = [];

    // Urutkan atribut berdasarkan 'urutan' ASC
    const sortedAtributs = [...atributs].sort((a, b) => a.urutan - b.urutan);

    for (const a of sortedAtributs) {
      if (!a.masuk_nama) continue;

      const val = values.find(v => v.atribut_id === a.id);
      if (!val) continue;

      if (a.tipe_isian === 'angka' && typeof val.nilai_angka === 'number') {
        const satuan = a.satuan ? `${a.satuan}` : '';
        nameParts.push(`${val.nilai_angka}${satuan}`);
      } else if (a.tipe_isian === 'pilihan') {
        if (val.opsi_baru) {
          nameParts.push(val.opsi_baru.trim());
        } else if (val.opsi_id && a.opsi) {
          const matchedOpsi = a.opsi.find(o => o.id === val.opsi_id);
          if (matchedOpsi) {
            nameParts.push(matchedOpsi.nilai.trim());
          }
        }
      } else if (a.tipe_isian === 'teks' && val.nilai_teks) {
        nameParts.push(val.nilai_teks.trim());
      }
    }

    return nameParts.length > 0 ? nameParts.join(' / ') : 'Standar';
  }

  static async listTipeByProduk(produkId: number): Promise<Tipe[]> {
    const tipes = await executeQuery<any>(
      `SELECT t.*, p.nama as produk_nama, j.nama as jenis_nama
       FROM tipe t
       JOIN produk p ON t.produk_id = p.id
       JOIN jenis j ON p.jenis_id = j.id
       WHERE t.produk_id = ? AND t.aktif = 1
       ORDER BY t.nama_tipe ASC`,
      [produkId]
    );

    for (const t of tipes) {
      t.nilai_atribut = await this.getNilaiAtributTipe(t.id);

      // Hitung total stok (item fisik per kondisi + stok jumlah)
      const itemStokAvailable = await executeQuery<any>(
        `SELECT COUNT(id) as total FROM item WHERE tipe_id = ? AND status = 'aktif' AND (kondisi IS NULL OR kondisi != 'Rusak')`,
        [t.id]
      );
      const countAvailableItem = Number(itemStokAvailable[0]?.total || 0);

      const itemStokRusak = await executeQuery<any>(
        `SELECT COUNT(id) as total FROM item WHERE tipe_id = ? AND status = 'aktif' AND kondisi = 'Rusak'`,
        [t.id]
      );
      const countRusakItem = Number(itemStokRusak[0]?.total || 0);

      const itemConditionBreakdown = await executeQuery<any>(
        `SELECT COALESCE(kondisi, 'Baik') as kondisi_name, COUNT(id) as total
         FROM item WHERE tipe_id = ? AND status = 'aktif'
         GROUP BY COALESCE(kondisi, 'Baik')`,
        [t.id]
      );

      const breakdown = { baru: 0, baik: 0, perlu_perbaikan: 0, rusak: 0 };
      itemConditionBreakdown.forEach((r: any) => {
        const k = String(r.kondisi_name).toLowerCase().replace(/ /g, '_');
        if (k in breakdown) {
          (breakdown as any)[k] = Number(r.total || 0);
        }
      });

      const sjStok = await executeQuery<any>(
        `SELECT COALESCE(SUM(jumlah), 0) as total FROM stok_jumlah WHERE tipe_id = ?`,
        [t.id]
      );
      const countSj = Number(sjStok[0]?.total || 0);

      t.stok_tersedia = countAvailableItem + countSj;
      t.stok_rusak = countRusakItem;
      t.stok_total = t.stok_tersedia + t.stok_rusak;
      t.stok_per_kondisi = breakdown;

      // Sebaran box per tipe
      const itemBoxes = await executeQuery<any>(
        `SELECT b.id as box_id, b.kode as box_kode, b.keterangan as box_keterangan, COUNT(i.id) as jumlah
         FROM item i
         JOIN box b ON i.box_id = b.id
         WHERE i.tipe_id = ? AND i.status = 'aktif'
         GROUP BY b.id, b.kode, b.keterangan`,
        [t.id]
      );

      const sjBoxes = await executeQuery<any>(
        `SELECT b.id as box_id, b.kode as box_kode, b.keterangan as box_keterangan, sj.jumlah
         FROM stok_jumlah sj
         JOIN box b ON sj.box_id = b.id
         WHERE sj.tipe_id = ? AND sj.jumlah > 0`,
        [t.id]
      );

      const boxMap: { [boxId: string]: { box_id: string; box_kode: string; box_keterangan?: string; jumlah: number } } = {};
      for (const ib of itemBoxes) {
        boxMap[ib.box_id] = { box_id: ib.box_id, box_kode: ib.box_kode, box_keterangan: ib.box_keterangan, jumlah: Number(ib.jumlah) };
      }
      for (const sb of sjBoxes) {
        if (boxMap[sb.box_id]) {
          boxMap[sb.box_id].jumlah += Number(sb.jumlah);
        } else {
          boxMap[sb.box_id] = { box_id: sb.box_id, box_kode: sb.box_kode, box_keterangan: sb.box_keterangan, jumlah: Number(sb.jumlah) };
        }
      }
      t.sebaran_box = Object.values(boxMap);

      // Riwayat transaksi terakhir (dibaca langsung dari log transaksi)
      const historyLogs = await executeQuery<any>(
        `SELECT tr.id_aktivitas, tr.aksi, tr.waktu, tr.catatan, u.name as nama_pelaku, td.jumlah, td.kode_id, td.status_sebelum, td.status_sesudah
         FROM transaksi_detail td
         JOIN transaksi tr ON td.transaksi_id = tr.id
         LEFT JOIN users u ON tr.pelaku_id = u.id
         WHERE td.tipe_id = ?
         ORDER BY tr.waktu DESC
         LIMIT 5`,
        [t.id]
      );
      t.riwayat_terakhir = historyLogs;
    }

    return tipes;
  }

  static async getTipeById(id: number): Promise<Tipe | null> {
    const rows = await executeQuery<any>(
      `SELECT t.*, p.nama as produk_nama, j.nama as jenis_nama
       FROM tipe t
       JOIN produk p ON t.produk_id = p.id
       JOIN jenis j ON p.jenis_id = j.id
       WHERE t.id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) return null;
    const t = rows[0];
    t.nilai_atribut = await this.getNilaiAtributTipe(id);

    // Hitung stok fisik dan breakdown kondisi (Paket 4)
    const physicalRows = await executeQuery<any>(
      `SELECT
         COUNT(id) as total,
         SUM(CASE WHEN kondisi = 'Rusak' THEN 1 ELSE 0 END) as rusak,
         SUM(CASE WHEN kondisi = 'Baru' THEN 1 ELSE 0 END) as baru,
         SUM(CASE WHEN kondisi = 'Baik' THEN 1 ELSE 0 END) as baik,
         SUM(CASE WHEN kondisi = 'Perlu Perbaikan' THEN 1 ELSE 0 END) as perlu_perbaikan
       FROM item
       WHERE tipe_id = ? AND status = 'aktif'`,
      [t.id]
    );

    const countPhysicalTotal = Number(physicalRows[0]?.total || 0);
    const countRusakItem = Number(physicalRows[0]?.rusak || 0);
    const countAvailableItem = countPhysicalTotal - countRusakItem;

    const breakdown = {
      baru: Number(physicalRows[0]?.baru || 0),
      baik: Number(physicalRows[0]?.baik || 0),
      perlu_perbaikan: Number(physicalRows[0]?.perlu_perbaikan || 0),
      rusak: countRusakItem
    };

    const sjStok = await executeQuery<any>(
      `SELECT COALESCE(SUM(jumlah), 0) as total FROM stok_jumlah WHERE tipe_id = ?`,
      [t.id]
    );
    const countSj = Number(sjStok[0]?.total || 0);

    t.stok_tersedia = countAvailableItem + countSj;
    t.stok_rusak = countRusakItem;
    t.stok_total = t.stok_tersedia + t.stok_rusak;
    t.stok_per_kondisi = breakdown;

    return t;
  }

  static async getNilaiAtributTipe(tipeId: number) {
    const rows = await executeQuery<any>(
      `SELECT tn.*, a.nama as atribut_nama, a.tipe_isian, a.satuan, ao.nilai as opsi_nilai
       FROM tipe_nilai tn
       JOIN atribut a ON tn.atribut_id = a.id
       LEFT JOIN atribut_opsi ao ON tn.opsi_id = ao.id
       WHERE tn.tipe_id = ?
       ORDER BY a.urutan ASC`,
      [tipeId]
    );

    return rows.map(r => {
      let nilaiTampil = '';
      if (r.tipe_isian === 'angka') {
        nilaiTampil = `${r.nilai_angka}${r.satuan || ''}`;
      } else if (r.tipe_isian === 'pilihan') {
        nilaiTampil = r.opsi_nilai || '';
      } else {
        nilaiTampil = r.nilai_teks || '';
      }
      return {
        atribut_id: r.atribut_id,
        atribut_nama: r.atribut_nama,
        tipe_isian: r.tipe_isian,
        satuan: r.satuan,
        nilai_tampil: nilaiTampil,
        nilai_angka: r.nilai_angka,
        opsi_id: r.opsi_id,
        nilai_teks: r.nilai_teks
      };
    });
  }

  static async createTipe(input: {
    produk_id: number;
    catatan?: string;
    sumber_id?: 'scan_sn' | 'otomatis' | 'manual' | 'tanpa_id';
    prefix_id?: string;
    pola_id?: string;
    nilai_atribut: NilaiAtributInput[];
  }, userId: string): Promise<Tipe> {
    const prod = await this.getProdukById(input.produk_id);
    if (!prod) {
      throw new Error(`Produk #${input.produk_id} tidak ditemukan.`);
    }

    const atributs = await this.listAtributByJenis(prod.jenis_id);

    // Validasi atribut wajib
    for (const a of atributs) {
      if (a.wajib) {
        const val = input.nilai_atribut.find(v => v.atribut_id === a.id);
        const hasVal = val && (
          val.nilai_angka !== undefined || 
          val.opsi_id !== undefined || 
          (val.opsi_baru && val.opsi_baru.trim().length > 0) || 
          (val.nilai_teks && val.nilai_teks.trim().length > 0)
        );
        if (!hasVal) {
          throw new Error(`Atribut wajib "${a.nama}" belum diisi.`);
        }
      }
    }

    // Jika ada opsi_baru, tambahkan ke tabel atribut_opsi dulu
    for (const v of input.nilai_atribut) {
      if (v.opsi_baru && v.opsi_baru.trim().length > 0) {
        const added = await this.addAtributOpsi(v.atribut_id, v.opsi_baru.trim());
        v.opsi_id = added.id;
      }
    }

    // Bentuk nama tipe otomatis
    const autoName = this.generateTipeName(atributs, input.nilai_atribut);

    // Cek duplikasi nama tipe di produk yang sama
    const duplicate = await executeQuery<any>(
      'SELECT id FROM tipe WHERE produk_id = ? AND nama_tipe = ? AND aktif = 1',
      [input.produk_id, autoName]
    );
    if (duplicate && duplicate.length > 0) {
      throw new Error(`Tipe "${autoName}" sudah terdaftar untuk produk "${prod.nama}".`);
    }

    // Tentukan sumber_id dan mode_stok
    const sumberId = input.sumber_id || 'manual';
    const modeStok = sumberId === 'tanpa_id' ? 'jumlah' : 'per_id';

    return await runTransaction(async (conn) => {
      const res = await conn.query(
        `INSERT INTO tipe (produk_id, nama_tipe, catatan, sumber_id, mode_stok, prefix_id, pola_id, id_dikunci, aktif)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)`,
        [
          input.produk_id,
          autoName,
          input.catatan || null,
          sumberId,
          modeStok,
          input.prefix_id || null,
          input.pola_id || null
        ]
      );

      const tipeId = res.insertId || res.id;

      // Masukkan baris tipe_nilai
      for (const v of input.nilai_atribut) {
        await conn.query(
          `INSERT INTO tipe_nilai (tipe_id, atribut_id, nilai_angka, opsi_id, nilai_teks)
           VALUES (?, ?, ?, ?, ?)`,
          [
            tipeId,
            v.atribut_id,
            typeof v.nilai_angka === 'number' ? v.nilai_angka : null,
            v.opsi_id || null,
            v.nilai_teks || null
          ]
        );
      }

      await ActivityLogService.recordActivity({
        aksi: 'tambah_tipe',
        pelaku_id: userId,
        catatan: `Menambahkan Tipe varian baru "${autoName}" pada produk "${prod.nama}"`
      });

      const created = await this.getTipeById(tipeId);
      return created!;
    });
  }

  /**
   * Koreksi Aturan ID Tipe (Koreksi ID jika id_dikunci = 1)
   */
  static async updateAturanId(tipeId: number, input: {
    sumber_id: 'scan_sn' | 'otomatis' | 'manual' | 'tanpa_id';
    prefix_id?: string;
    pola_id?: string;
    alasan: string;
  }, userId: string): Promise<Tipe> {
    const existing = await this.getTipeById(tipeId);
    if (!existing) {
      throw new Error(`Tipe #${tipeId} tidak ditemukan.`);
    }

    const modeStok = input.sumber_id === 'tanpa_id' ? 'jumlah' : 'per_id';

    await executeQuery(
      `UPDATE tipe SET sumber_id = ?, mode_stok = ?, prefix_id = ?, pola_id = ? WHERE id = ?`,
      [input.sumber_id, modeStok, input.prefix_id || null, input.pola_id || null, tipeId]
    );

    await ActivityLogService.recordActivity({
      aksi: 'koreksi_aturan_id',
      pelaku_id: userId,
      catatan: `Koreksi Aturan ID pada tipe "${existing.nama_tipe}": ${input.alasan} (Sumber: ${existing.sumber_id} -> ${input.sumber_id})`
    });

    const updated = await this.getTipeById(tipeId);
    return updated!;
  }

  /**
   * Data Batch Labeling & Cetak Presisi A4 (Tahap 7)
   */
  static async getLabelData(filters?: { jenis_id?: number }) {
    const jenisList = await this.listJenis();
    const result: Array<{
      id: string;
      nama: string;
      p: Array<[string, string]>;
    }> = [];

    for (const j of jenisList) {
      if (filters?.jenis_id && j.id !== filters.jenis_id) continue;
      const prods = await this.listProduk({ jenis_id: j.id });
      const pItems: Array<[string, string]> = [];

      for (const p of prods) {
        const tipes = await this.listTipeByProduk(p.id);
        for (const t of tipes) {
          pItems.push([p.nama, t.nama_tipe]);
        }
      }

      if (pItems.length > 0) {
        result.push({
          id: `jenis-${j.id}`,
          nama: j.nama,
          p: pItems
        });
      }
    }

    return result;
  }
}

