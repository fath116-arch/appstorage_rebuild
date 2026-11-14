/**
 * Activity Log Service (Append-Only)
 * FieldOps Inventory v2 - Tahap 1: Fondasi
 * Mencatat seluruh mutasi dan aksi sensitif dengan ID Aktivitas unik format AKT-YYYYMMDD-NNNN
 */

import crypto from 'crypto';
import { DbTxConnection, executeQuery, runTransaction } from '../db/database';

export interface ActivityDetailInput {
  tipe_id?: number | null;
  item_id?: string | null;
  kode_id?: string | null;
  nama_snapshot: string;
  jumlah?: number;
  status_sebelum?: string | null;
  status_sesudah?: string | null;
}

export interface CreateActivityInput {
  aksi: string;
  pelaku_id: string;
  penyetuju_id?: string | null;
  request_id?: string | null;
  box_asal?: string | null;
  box_tujuan?: string | null;
  catatan?: string | null;
  details?: ActivityDetailInput[];
}

interface ActivityIdRow {
  id_aktivitas: string;
}

export interface ActivityLogRow {
  id: string;
  id_aktivitas: string;
  aksi: string;
  pelaku_id: string;
  nama_pelaku?: string | null;
  role_pelaku?: string | null;
  penyetuju_id?: string | null;
  nama_penyetuju?: string | null;
  request_id?: string | null;
  box_asal?: string | null;
  box_tujuan?: string | null;
  catatan?: string | null;
  waktu: string;
  total_items: number;
}

export interface ActivityDetailRow {
  id: number;
  transaksi_id: string;
  tipe_id?: number | null;
  item_id?: string | null;
  kode_id?: string | null;
  nama_snapshot: string;
  jumlah: number;
  status_sebelum?: string | null;
  status_sesudah?: string | null;
}

export class ActivityLogService {
  /**
   * Menghasilkan ID Aktivitas unik format AKT-YYYYMMDD-NNNN dihitung per hari
   */
  static async generateActivityId(): Promise<string> {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const prefix = `AKT-${year}${month}${day}-`;

    const rows = await executeQuery<ActivityIdRow>(
      `SELECT id_aktivitas FROM transaksi 
       WHERE id_aktivitas LIKE ? 
       ORDER BY id_aktivitas DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let nextSeq = 1;
    if (rows && rows.length > 0 && rows[0].id_aktivitas) {
      const lastId = rows[0].id_aktivitas;
      const parts = lastId.split('-');
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Mencatat aktivitas transaksi secara atomik (Append-Only)
   */
  static async recordActivity(input: CreateActivityInput, conn?: DbTxConnection): Promise<{ transaksiId: string; idAktivitas: string }> {
    const runner = async (c: DbTxConnection) => {
      const idAktivitas = await this.generateActivityId();
      const transaksiId = `tx-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

      await c.query(
        `INSERT INTO transaksi (id, id_aktivitas, aksi, pelaku_id, penyetuju_id, request_id, box_asal, box_tujuan, catatan, waktu)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          transaksiId,
          idAktivitas,
          input.aksi,
          input.pelaku_id,
          input.penyetuju_id || null,
          input.request_id || null,
          input.box_asal || null,
          input.box_tujuan || null,
          input.catatan || null
        ]
      );

      if (input.details && input.details.length > 0) {
        for (const d of input.details) {
          await c.query(
            `INSERT INTO transaksi_detail (transaksi_id, tipe_id, item_id, kode_id, nama_snapshot, jumlah, status_sebelum, status_sesudah)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              transaksiId,
              d.tipe_id || null,
              d.item_id || null,
              d.kode_id || null,
              d.nama_snapshot,
              d.jumlah || 1,
              d.status_sebelum || null,
              d.status_sesudah || null
            ]
          );
        }
      }

      return { transaksiId, idAktivitas };
    };

    if (conn) {
      return await runner(conn);
    }
    return await runTransaction(runner);
  }

  /**
   * Mengambil daftar log aktivitas dengan filter
   */
  static async getLogs(filters: {
    search?: string;
    action?: string;
    actorId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<ActivityLogRow[]> {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    let sql = `
      SELECT t.id, t.id_aktivitas, t.aksi, t.pelaku_id, u.name as nama_pelaku, u.role as role_pelaku,
             t.penyetuju_id, up.name as nama_penyetuju, t.request_id, t.box_asal, t.box_tujuan,
             t.catatan, t.waktu,
             COUNT(td.id) as total_items
      FROM transaksi t
      LEFT JOIN users u ON t.pelaku_id = u.id
      LEFT JOIN users up ON t.penyetuju_id = up.id
      LEFT JOIN transaksi_detail td ON t.id = td.transaksi_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters.action) {
      sql += ' AND t.aksi = ?';
      params.push(filters.action);
    }

    if (filters.actorId) {
      sql += ' AND t.pelaku_id = ?';
      params.push(filters.actorId);
    }

    if (filters.dateFrom) {
      sql += ' AND t.waktu >= ?';
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      sql += ' AND t.waktu <= ?';
      params.push(filters.dateTo);
    }

    sql += ' GROUP BY t.id ORDER BY t.waktu DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return await executeQuery<ActivityLogRow>(sql, params);
  }

  /**
   * Mengambil detail barang dari suatu ID aktivitas
   */
  static async getActivityDetails(transaksiId: string): Promise<ActivityDetailRow[]> {
    return await executeQuery<ActivityDetailRow>(
      `SELECT id, transaksi_id, tipe_id, item_id, kode_id, nama_snapshot, jumlah, status_sebelum, status_sesudah
       FROM transaksi_detail WHERE transaksi_id = ?`,
      [transaksiId]
    );
  }
}
