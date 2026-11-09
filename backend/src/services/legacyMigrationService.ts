/**
 * Legacy to Catalog v2 Idempotent Migration Service
 * FieldOps Inventory v2 - Fix Stock I/O & Catalog Unification
 * Migrates the 12 legacy items to v2 Jenis, Produk, Tipe, and records initial SALDO_AWAL transactions.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeQuery, memoryStore } from '../db/database';
import { StockService } from './stockService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MigrationSummary {
  alreadyMigrated: boolean;
  totalSuccess: number;
  totalFailed: number;
  migratedItems: Array<{ sku: string; name: string; tipeId: number; initialStock: number; unit: string }>;
  failedItems: Array<{ sku: string; reason: string }>;
}

export class LegacyMigrationService {
  /**
   * Peta legacy category ID ke nama Jenis v2
   */
  private static categoryToJenisMap: Record<string, { nama: string; prefix: string; sumber: 'tanpa_id' | 'otomatis' | 'scan_sn' | 'manual' }> = {
    'cat-cables': { nama: 'Kabel & Konektor', prefix: 'CAB', sumber: 'tanpa_id' },
    'cat-network': { nama: 'Perangkat Jaringan', prefix: 'NET', sumber: 'scan_sn' },
    'cat-hardware': { nama: 'Hardware & Komponen PC', prefix: 'HW', sumber: 'otomatis' },
    'cat-cctv': { nama: 'CCTV & Keamanan', prefix: 'SEC', sumber: 'scan_sn' },
    'cat-tools': { nama: 'Alat Kerja & Consumable', prefix: 'TLS', sumber: 'tanpa_id' },
    'cat-peripheral': { nama: 'Periferal & Aksesori', prefix: 'PER', sumber: 'tanpa_id' }
  };

  /**
   * Menjalankan migrasi 12 item legacy ke v2 secara idempotent
   */
  static async runMigration(): Promise<MigrationSummary> {
    const summary: MigrationSummary = {
      alreadyMigrated: false,
      totalSuccess: 0,
      totalFailed: 0,
      migratedItems: [],
      failedItems: []
    };

    try {
      // 1. Cek penanda migrasi di pengaturan
      const checkSettings = await executeQuery<any>(
        'SELECT nilai FROM pengaturan WHERE kunci = ?',
        ['V2_LEGACY_MIGRATION_DONE']
      );
      if (checkSettings && checkSettings.length > 0 && checkSettings[0].nilai === 'true') {
        // Cek apakah produk v2 benar-benar ada di database
        const prodCount = await executeQuery<any>('SELECT COUNT(*) as count FROM produk WHERE aktif = 1');
        const count = Number(prodCount[0]?.count || 0);
        if (count >= 12) {
          summary.alreadyMigrated = true;
          return summary;
        }
      }

      // 2. Baca file seeds/items_seed.json
      const seedsDir = path.join(__dirname, '..', 'db', 'seeds');
      const itemsSeedPath = path.join(seedsDir, 'items_seed.json');

      if (!fs.existsSync(itemsSeedPath)) {
        console.warn('[LegacyMigration] File items_seed.json tidak ditemukan.');
        return summary;
      }

      const raw = JSON.parse(fs.readFileSync(itemsSeedPath, 'utf-8'));
      const legacyItems: any[] = raw.items || [];

      // Pastikan ada box default (BOX-A-01)
      const existingBoxes = await executeQuery<any>('SELECT * FROM box WHERE kode = "BOX-A-01"');
      let defaultBoxId = 'box-1';
      if (!existingBoxes || existingBoxes.length === 0) {
        await executeQuery(
          'INSERT INTO box (id, kode, keterangan, aktif) VALUES (?, ?, ?, 1)',
          ['box-1', 'BOX-A-01', 'Gudang Utama - Rak A-01']
        );
      } else {
        defaultBoxId = existingBoxes[0].id;
      }

      // Ambil pemetaan yang tersimpan jika pernah ada migrasi parsial
      const mapRow = await executeQuery<any>('SELECT nilai FROM pengaturan WHERE kunci = ?', ['V2_LEGACY_SKU_MAP']);
      let skuToTipeMap: Record<string, number> = {};
      if (mapRow && mapRow.length > 0 && mapRow[0].nilai) {
        try {
          const parsed = JSON.parse(mapRow[0].nilai);
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            skuToTipeMap = parsed;
          }
        } catch {}
      }

      // 3. Proses migrasi untuk setiap item legacy
      for (const item of legacyItems) {
        try {
          const sku = String(item.sku).trim().toUpperCase();
          const itemName = String(item.name).trim();
          const unit = (item.unit || 'pcs').trim().toLowerCase();
          const initialStock = Number(item.quantity || 0);
          const categoryId = item.category_id || 'cat-cables';
          const jenisMeta = this.categoryToJenisMap[categoryId] || { nama: 'Kabel & Konektor', prefix: 'CAB', sumber: 'tanpa_id' };

          // a. Cari atau buat Jenis
          let jenisId: number;
          const existingJenis = await executeQuery<any>('SELECT id FROM jenis WHERE LOWER(nama) = LOWER(?)', [jenisMeta.nama]);
          if (existingJenis && existingJenis.length > 0) {
            jenisId = Number(existingJenis[0].id);
          } else {
            const jRes: any = await executeQuery(
              'INSERT INTO jenis (nama, sumber_id_bawaan, prefix_id_bawaan, aktif) VALUES (?, ?, ?, 1)',
              [jenisMeta.nama, jenisMeta.sumber, jenisMeta.prefix]
            );
            jenisId = Number(jRes.insertId || jRes.id || memoryStore.jenis.size);
          }

          // b. Cari atau buat Produk
          let produkId: number;
          const existingProd = await executeQuery<any>(
            'SELECT id FROM produk WHERE LOWER(nama) = LOWER(?) AND jenis_id = ?',
            [itemName, jenisId]
          );
          if (existingProd && existingProd.length > 0) {
            produkId = Number(existingProd[0].id);
          } else {
            const kategoriBarang = categoryId === 'cat-tools' ? 'Alat' : 'Barang Habis Pakai';
            const pRes: any = await executeQuery(
              `INSERT INTO produk (jenis_id, nama, kategori, kategori_barang, tipe_stok, catatan, aktif, dibuat_oleh)
               VALUES (?, ?, ?, ?, ?, ?, 1, 'migration')`,
              [jenisId, itemName, 'fast_moving', kategoriBarang, unit, item.specs || null]
            );
            produkId = Number(pRes.insertId || pRes.id || memoryStore.produk.size);
          }

          // c. Cari atau buat Tipe
          let tipeId: number;
          const existingTipe = await executeQuery<any>(
            'SELECT id FROM tipe WHERE produk_id = ? AND (LOWER(nama_tipe) = LOWER(?) OR prefix_id = ?)',
            [produkId, sku, sku]
          );
          if (existingTipe && existingTipe.length > 0) {
            tipeId = Number(existingTipe[0].id);
          } else {
            const tRes: any = await executeQuery(
              `INSERT INTO tipe (produk_id, nama_tipe, catatan, sumber_id, mode_stok, prefix_id, pola_id, id_dikunci, aktif)
               VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)`,
              [produkId, sku, item.specs || null, 'tanpa_id', 'jumlah', sku, null]
            );
            tipeId = Number(tRes.insertId || tRes.id || memoryStore.tipe.size);
          }

          skuToTipeMap[sku] = tipeId;
          skuToTipeMap[item.id] = tipeId;

          // d. Cek apakah sudah ada transaksi SALDO_AWAL untuk tipe ini
          const existingTx = await executeQuery<any>(
            'SELECT id FROM transactions WHERE tipe_id = ? AND reference_type = "SALDO_AWAL"',
            [tipeId]
          );

          if (!existingTx || existingTx.length === 0) {
            const txId = `tx-init-${tipeId}-${Date.now()}`;
            await executeQuery(
              `INSERT INTO transactions (
                id, type, tipe_mutasi, item_id, tipe_id, nama_barang, sku, satuan,
                quantity, previous_qty, new_qty, reference_type, reference_number,
                recipient_destination, user_id, performed_by, notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                txId,
                'IN',
                'MASUK',
                String(tipeId),
                tipeId,
                itemName,
                sku,
                unit,
                initialStock,
                0,
                initialStock,
                'SALDO_AWAL',
                `SALDO-AWAL-${sku}`,
                item.location || 'Gudang Utama - Rak A-01',
                'system',
                'Sistem (Migrasi v2)',
                `Saldo awal migrasi data legacy (${initialStock} ${unit})`
              ]
            );

            // Tambahkan stok jumlah ke box default
            const existingSj = await executeQuery<any>(
              'SELECT jumlah FROM stok_jumlah WHERE tipe_id = ? AND box_id = ?',
              [tipeId, defaultBoxId]
            );
            if (existingSj && existingSj.length > 0) {
              await executeQuery(
                'UPDATE stok_jumlah SET jumlah = ? WHERE tipe_id = ? AND box_id = ?',
                [initialStock, tipeId, defaultBoxId]
              );
            } else {
              await executeQuery(
                'INSERT INTO stok_jumlah (tipe_id, box_id, jumlah) VALUES (?, ?, ?)',
                [tipeId, defaultBoxId, initialStock]
              );
            }
          }

          summary.totalSuccess++;
          summary.migratedItems.push({
            sku,
            name: itemName,
            tipeId,
            initialStock,
            unit
          });
        } catch (itemErr: any) {
          console.error('[Migration Item Error]', item.sku, itemErr.message || itemErr);
          summary.totalFailed++;
          summary.failedItems.push({
            sku: item.sku,
            reason: itemErr.message || 'Error tidak diketahui'
          });
        }
      }

      // 4. Simpan penanda keberhasilan migrasi
      await executeQuery(
        `INSERT INTO pengaturan (kunci, nilai, keterangan) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`,
        ['V2_LEGACY_MIGRATION_DONE', 'true', 'Penanda keberhasilan migrasi katalog v2']
      );

      await executeQuery(
        `INSERT INTO pengaturan (kunci, nilai, keterangan) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`,
        ['V2_LEGACY_SKU_MAP', JSON.stringify(skuToTipeMap), 'Pemetaan SKU legacy ke ID Tipe v2']
      );

      console.log(`[LegacyMigration] Selesai: ${summary.totalSuccess} berhasil, ${summary.totalFailed} gagal.`);
      return summary;
    } catch (err: any) {
      console.error('[LegacyMigration Error]:', err);
      return summary;
    }
  }

  /**
   * Helper mencari ID Tipe v2 dari SKU atau ID Legacy
   */
  static async resolveTipeId(itemIdOrSku: string | number): Promise<number | null> {
    if (typeof itemIdOrSku === 'number') return itemIdOrSku;
    const str = String(itemIdOrSku).trim();

    // Jika string berisi angka murni, mis. "1", "4"
    if (/^\d+$/.test(str)) {
      return parseInt(str, 10);
    }

    // Cek pemetaan SKU
    const mapRow = await executeQuery<any>('SELECT nilai FROM pengaturan WHERE kunci = ?', ['V2_LEGACY_SKU_MAP']);
    if (mapRow && mapRow.length > 0 && mapRow[0].nilai) {
      try {
        const map = JSON.parse(mapRow[0].nilai);
        if (typeof map === 'object' && map !== null) {
          if (map[str.toUpperCase()]) return map[str.toUpperCase()];
          if (map[str]) return map[str];
        }
      } catch {}
    }

    // Cek di tabel tipe
    const tipes = await executeQuery<any>(
      'SELECT id FROM tipe WHERE prefix_id = ? OR UPPER(nama_tipe) = UPPER(?)',
      [str, str]
    );
    if (tipes && tipes.length > 0) {
      return Number(tipes[0].id);
    }

    // Cek di tabel items legacy
    const items = await executeQuery<any>(
      'SELECT sku FROM items WHERE id = ? OR UPPER(sku) = UPPER(?)',
      [str, str.toUpperCase()]
    );
    if (items && items.length > 0) {
      const legacySku = items[0].sku;
      return this.resolveTipeId(legacySku);
    }

    return null;
  }
}
