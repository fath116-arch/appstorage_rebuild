/**
 * Backup & Restore Service (Canonical Single-Model Snapshots, Separated Business vs Account)
 * FieldOps IT Inventory
 */

import fs from 'fs';
import path from 'path';
import { executeQuery, runTransaction } from '../db/database';

export class BackupService {
  private static backupsDir = path.resolve(process.cwd(), 'backups');

  static ensureBackupDir(): string {
    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }
    return this.backupsDir;
  }

  /**
   * Ekspor Khusus Data Bisnis Inventaris Kanonis (BEBAS AKUN & PASSWORD)
   */
  static async createInventoryBackup(triggeredBy: string = 'system-cron'): Promise<{ filename: string; filePath: string; summary: any }> {
    this.ensureBackupDir();
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_inventory_items_${dateStr}.json`;
    const filePath = path.join(this.backupsDir, filename);

    const jenis = await executeQuery('SELECT * FROM jenis WHERE aktif = 1 ORDER BY id ASC');
    const produk = await executeQuery('SELECT * FROM produk WHERE aktif = 1 ORDER BY id ASC');
    const tipe = await executeQuery('SELECT * FROM tipe WHERE aktif = 1 ORDER BY id ASC');
    const boxes = await executeQuery('SELECT * FROM box WHERE aktif = 1 ORDER BY kode ASC');
    const items = await executeQuery('SELECT * FROM item ORDER BY id ASC');
    const stokJumlah = await executeQuery('SELECT * FROM stok_jumlah');
    const transaksi = await executeQuery('SELECT * FROM transaksi ORDER BY COALESCE(occurred_at, waktu) DESC');
    const transaksiDetail = await executeQuery('SELECT * FROM transaksi_detail ORDER BY id ASC');
    const requests = await executeQuery('SELECT * FROM request ORDER BY dibuat_pada DESC');
    const checklists = await executeQuery('SELECT * FROM checklists ORDER BY created_at DESC');
    const whatsappConfig = await executeQuery('SELECT id, gateway_type, api_url, target_phones, auto_alert_enabled FROM whatsapp_config');
    const whatsappLogs = await executeQuery('SELECT * FROM whatsapp_logs ORDER BY created_at DESC LIMIT 100');

    const payload = {
      system: 'FieldOps IT Inventory',
      dataType: 'BUSINESS_INVENTORY_ONLY',
      version: '2.0.0',
      createdAt: new Date().toISOString(),
      triggeredBy,
      data: {
        jenis,
        produk,
        tipe,
        boxes,
        items,
        stokJumlah,
        transaksi,
        transaksiDetail,
        requests,
        checklists,
        whatsappConfig: whatsappConfig[0] || null,
        whatsappLogs
      }
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');

    return {
      filename,
      filePath,
      summary: {
        jenisCount: jenis.length,
        productsCount: produk.length,
        tipesCount: tipe.length,
        itemsCount: items.length,
        transactionsCount: transaksi.length,
        checklistsCount: checklists.length
      }
    };
  }

  /**
   * Ekspor Khusus Data Akun Pengguna (FILE AKUN TERISOLASI - HANYA SUPERVISOR)
   */
  static async createAccountsBackup(operatorUserId: string): Promise<{ filename: string; filePath: string; count: number }> {
    this.ensureBackupDir();
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_accounts_${dateStr}.json`;
    const filePath = path.join(this.backupsDir, filename);

    const users = await executeQuery('SELECT id, username, name, email, role, department, phone, password_hash, salt, status, created_at FROM users');

    const payload = {
      system: 'FieldOps IT Security Governance',
      dataType: 'ACCOUNTS_CREDENTIALS_BACKUP',
      exportedBy: operatorUserId,
      createdAt: new Date().toISOString(),
      users
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    return { filename, filePath, count: users.length };
  }

  /**
   * Pulihkan Data Bisnis Kanonis dari File Cadangan (Tanpa Menyentuh Akun Pengguna)
   */
  static async restoreInventory(jsonData: any): Promise<{ success: boolean; message: string; counts: any }> {
    if (!jsonData || jsonData.dataType !== 'BUSINESS_INVENTORY_ONLY' || !jsonData.data) {
      throw new Error('Format file backup tidak valid. Hanya file backup khusus data bisnis (BUSINESS_INVENTORY_ONLY) yang diterima.');
    }

    const { produk, boxes, items, stokJumlah } = jsonData.data;

    return await runTransaction(async (conn) => {
      if (Array.isArray(boxes)) {
        for (const b of boxes) {
          await conn.query(
            `INSERT INTO box (id, kode, keterangan, aktif)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE keterangan = VALUES(keterangan), aktif = VALUES(aktif)`,
            [b.id, b.kode, b.keterangan || null, b.aktif !== undefined ? (b.aktif ? 1 : 0) : 1]
          );
        }
      }

      if (Array.isArray(items)) {
        for (const it of items) {
          if (it.kode_id && it.tipe_id && it.box_id) {
            await conn.query(
              `INSERT INTO item (id, kode_id, tipe_id, box_id, status, kondisi, catatan_kondisi)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE status = VALUES(status), box_id = VALUES(box_id), kondisi = VALUES(kondisi)`,
              [it.id, it.kode_id, it.tipe_id, it.box_id, it.status || 'aktif', it.kondisi || 'Baik', it.catatan_kondisi || null]
            );
          }
        }
      }

      if (Array.isArray(stokJumlah)) {
        for (const sj of stokJumlah) {
          await conn.query(
            `INSERT INTO stok_jumlah (tipe_id, box_id, jumlah)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE jumlah = VALUES(jumlah)`,
            [sj.tipe_id, sj.box_id, Number(sj.jumlah || 0)]
          );
        }
      }

      return {
        success: true,
        message: 'Pemulihan data inventori kanonis berhasil diselesaikan.',
        counts: {
          products: Array.isArray(produk) ? produk.length : 0,
          boxes: Array.isArray(boxes) ? boxes.length : 0,
          items: Array.isArray(items) ? items.length : 0,
          stokJumlah: Array.isArray(stokJumlah) ? stokJumlah.length : 0
        }
      };
    });
  }

  /**
   * Inisialisasi backup harian terjadwal (Setiap 24 jam)
   */
  static initDailyBackupCron() {
    setInterval(async () => {
      try {
        const res = await this.createInventoryBackup('scheduled-daily-cron');
        console.log(`[Backup Service] Backup harian inventori berhasil dibuat: ${res.filename}`);
      } catch (err) {
        console.error('[Backup Service Error]:', err);
      }
    }, 24 * 3600 * 1000);
  }
}
