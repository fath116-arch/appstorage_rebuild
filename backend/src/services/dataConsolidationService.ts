/**
 * Data Consolidation & Historical Timestamp Audit Service
 * Migrates legacy items/transactions once with backup snapshot into the single canonical model
 * (jenis -> produk -> tipe -> item / stok_jumlah -> transaksi / transaksi_detail).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { executeQuery, memoryStore } from '../db/database';
import { toMysqlUtcDatetime } from '../utils/timezone';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ConsolidationSummary {
  alreadyConsolidated: boolean;
  totalSuccess: number;
  totalFailed: number;
  backupCreated?: string;
}

export class DataConsolidationService {
  private static categoryToJenisMap: Record<string, { nama: string; prefix: string; sumber: 'tanpa_id' | 'otomatis' | 'scan_sn' | 'manual' }> = {
    'cat-cables': { nama: 'Kabel & Konektor', prefix: 'CAB', sumber: 'tanpa_id' },
    'cat-network': { nama: 'Perangkat Jaringan', prefix: 'NET', sumber: 'scan_sn' },
    'cat-hardware': { nama: 'Hardware & Komponen PC', prefix: 'HW', sumber: 'otomatis' },
    'cat-cctv': { nama: 'CCTV & Keamanan', prefix: 'SEC', sumber: 'scan_sn' },
    'cat-tools': { nama: 'Alat Kerja & Consumable', prefix: 'TLS', sumber: 'tanpa_id' },
    'cat-peripheral': { nama: 'Periferal & Aksesori', prefix: 'PER', sumber: 'tanpa_id' }
  };

  /**
   * Backs up legacy tables if present and consolidates everything into canonical tables.
   */
  static async consolidateAll(): Promise<ConsolidationSummary> {
    const summary: ConsolidationSummary = {
      alreadyConsolidated: false,
      totalSuccess: 0,
      totalFailed: 0
    };

    try {
      const checkSettings = await executeQuery<any>(
        'SELECT nilai FROM pengaturan WHERE kunci = ?',
        ['SINGLE_MODEL_CONSOLIDATION_DONE']
      );
      if (checkSettings && checkSettings.length > 0 && checkSettings[0].nilai === 'true') {
        const prodCount = await executeQuery<any>('SELECT COUNT(*) as count FROM produk WHERE aktif = 1');
        if (Number(prodCount[0]?.count || 0) > 0) {
          summary.alreadyConsolidated = true;
          return summary;
        }
      }

      // 1. Ensure default boxes exist
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

      // 2. Audit & backup any legacy rows if table exists in SQL (non-fatal if already clean)
      let legacyItems: any[] = [];
      let legacyTxs: any[] = [];
      try {
        legacyItems = await executeQuery<any>('SELECT * FROM items WHERE is_deleted = FALSE');
        legacyTxs = await executeQuery<any>('SELECT * FROM transactions ORDER BY created_at ASC');
        if (legacyItems.length > 0 || legacyTxs.length > 0) {
          const { PROJECT_ROOT_DIR } = await import('../db/database');
          const backupsDir = path.resolve(PROJECT_ROOT_DIR, 'backups');
          if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
          const backupPath = path.join(backupsDir, `pre_unification_snapshot_${Date.now()}.json`);
          fs.writeFileSync(
            backupPath,
            JSON.stringify({ exportedAt: new Date().toISOString(), items: legacyItems, transactions: legacyTxs }, null, 2),
            'utf-8'
          );
          summary.backupCreated = backupPath;
        }
      } catch {
        // Legacy tables may not exist in fresh installations
      }

      // Fallback seed from items_seed.json if neither SQL legacy items nor produk exist yet
      if (legacyItems.length === 0) {
        const seedsDir = path.join(__dirname, '..', 'db', 'seeds');
        const itemsSeedPath = path.join(seedsDir, 'items_seed.json');
        if (fs.existsSync(itemsSeedPath)) {
          const raw = JSON.parse(fs.readFileSync(itemsSeedPath, 'utf-8'));
          legacyItems = raw.items || [];
        }
      }

      const skuToTipeMap: Record<string, number> = {};

      for (const item of legacyItems) {
        try {
          const sku = String(item.sku).trim().toUpperCase();
          const itemName = String(item.name).trim();
          const unit = (item.unit || 'pcs').trim().toLowerCase();
          const initialStock = Math.max(0, Number(item.quantity || 0));
          const categoryId = item.category_id || 'cat-cables';
          const jenisMeta = this.categoryToJenisMap[categoryId] || { nama: 'Kabel & Konektor', prefix: 'CAB', sumber: 'tanpa_id' };

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
               VALUES (?, ?, ?, ?, ?, ?, 1, 'system')`,
              [jenisId, itemName, 'fast_moving', kategoriBarang, unit, item.specs || null]
            );
            produkId = Number(pRes.insertId || pRes.id || memoryStore.produk.size);
          }

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

          const existingSj = await executeQuery<any>(
            'SELECT jumlah FROM stok_jumlah WHERE tipe_id = ? AND box_id = ?',
            [tipeId, defaultBoxId]
          );
          if (!existingSj || existingSj.length === 0) {
            await executeQuery(
              'INSERT INTO stok_jumlah (tipe_id, box_id, jumlah) VALUES (?, ?, ?)',
              [tipeId, defaultBoxId, initialStock]
            );
          }

          // Record SALDO_AWAL directly into canonical transaksi + transaksi_detail
          const txId = `tx-init-${tipeId}`;
          const existingCanonical = await executeQuery<any>('SELECT id FROM transaksi WHERE id = ?', [txId]);
          if (!existingCanonical || existingCanonical.length === 0) {
            const nowUtc = toMysqlUtcDatetime(new Date());
            const aktId = `AKT-INIT-${String(tipeId).padStart(4, '0')}`;
            await executeQuery(
              `INSERT INTO transaksi (
                id, id_aktivitas, aksi, pelaku_id, actor_id, actor_nama,
                recorded_by_id, recorded_by_nama, is_on_behalf, on_behalf_reason,
                penyetuju_id, request_id, box_asal, box_tujuan, catatan,
                waktu, occurred_at, recorded_at, correction_of_id,
                reference_type, reference_number, recipient_destination, qty_total, tipe_mutasi
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
              [
                txId,
                aktId,
                'saldo_awal',
                'system',
                'system',
                'Sistem Inventori',
                'system',
                'Sistem Inventori',
                'BOX-A-01',
                `Saldo awal katalog (${initialStock} ${unit})`,
                nowUtc,
                nowUtc,
                nowUtc,
                'SALDO_AWAL',
                `SALDO-AWAL-${sku}`,
                item.location || 'BOX-A-01',
                initialStock,
                'MASUK'
              ]
            );

            await executeQuery(
              `INSERT INTO transaksi_detail (transaksi_id, tipe_id, item_id, kode_id, nama_snapshot, jumlah, status_sebelum, status_sesudah)
               VALUES (?, ?, NULL, ?, ?, ?, NULL, 'aktif')`,
              [txId, tipeId, sku, `${itemName} - ${sku}`, initialStock]
            );
          }

          summary.totalSuccess++;
        } catch {
          summary.totalFailed++;
        }
      }

      // 3. Migrate any custom historical transactions from legacy table into canonical transaksi
      for (const ltx of legacyTxs) {
        if (ltx.reference_type === 'SALDO_AWAL') continue;
        const canonicalId = `tx-leg-${ltx.id}`;
        const dup = await executeQuery<any>('SELECT id FROM transaksi WHERE id = ?', [canonicalId]);
        if (dup && dup.length > 0) continue;

        const tipeId = ltx.tipe_id || skuToTipeMap[String(ltx.sku || '').toUpperCase()] || skuToTipeMap[ltx.item_id] || null;
        const isOut = ltx.type === 'OUT' || ltx.tipe_mutasi === 'KELUAR';
        const ts = toMysqlUtcDatetime(ltx.created_at || new Date());
        const aktId = `AKT-HIS-${crypto.createHash('md5').update(String(ltx.id)).digest('hex').slice(0, 8).toUpperCase()}`;

        await executeQuery(
          `INSERT INTO transaksi (
            id, id_aktivitas, aksi, pelaku_id, actor_id, actor_nama,
            recorded_by_id, recorded_by_nama, is_on_behalf, on_behalf_reason,
            penyetuju_id, request_id, box_asal, box_tujuan, catatan,
            waktu, occurred_at, recorded_at, correction_of_id,
            reference_type, reference_number, recipient_destination, qty_total, tipe_mutasi
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
          [
            canonicalId,
            aktId,
            isOut ? 'barang_keluar_jumlah' : 'tambah_stok_jumlah',
            ltx.user_id || 'system',
            ltx.user_id || 'system',
            ltx.performed_by || 'Admin',
            ltx.user_id || 'system',
            ltx.performed_by || 'Admin',
            isOut ? (ltx.recipient_destination || 'Gudang') : null,
            !isOut ? (ltx.recipient_destination || 'BOX-A-01') : null,
            ltx.notes || `${ltx.reference_type || 'MUTASI'} ${ltx.reference_number || ''}`.trim(),
            ts,
            ts,
            ts,
            ltx.reference_type || 'MANUAL',
            ltx.reference_number || '',
            ltx.recipient_destination || '',
            Number(ltx.quantity || 1),
            isOut ? 'KELUAR' : 'MASUK'
          ]
        );

        await executeQuery(
          `INSERT INTO transaksi_detail (transaksi_id, tipe_id, item_id, kode_id, nama_snapshot, jumlah, status_sebelum, status_sesudah)
           VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
          [
            canonicalId,
            tipeId,
            ltx.sku || null,
            ltx.nama_barang || ltx.item_name || 'Barang IT',
            Number(ltx.quantity || 1),
            isOut ? 'aktif' : null,
            isOut ? 'keluar' : 'aktif'
          ]
        );
      }

      await executeQuery(
        `INSERT INTO pengaturan (kunci, nilai, keterangan) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`,
        ['SINGLE_MODEL_CONSOLIDATION_DONE', 'true', 'Penanda konsolidasi ke model data tunggal selesai']
      );

      await executeQuery(
        `INSERT INTO pengaturan (kunci, nilai, keterangan) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`,
        ['V2_LEGACY_MIGRATION_DONE', 'true', 'Backward-compat flag']
      );

      return summary;
    } catch (err) {
      console.error('[DataConsolidationService Error]:', err);
      return summary;
    }
  }
}
