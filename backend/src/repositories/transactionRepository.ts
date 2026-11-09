/**
 * Transaction Repository
 * FieldOps IT Inventory Rebuild - MariaDB 11.x
 */

import { executeQuery } from '../db/database';

export interface TransactionRecord {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  tipe_mutasi?: 'MASUK' | 'KELUAR';
  item_id: string;
  tipe_id?: number;
  nama_barang?: string;
  sku?: string;
  satuan?: string;
  quantity: number;
  previous_qty: number;
  new_qty: number;
  reference_type: string;
  reference_number: string;
  recipient_destination: string;
  user_id: string;
  performed_by: string;
  notes?: string;
  created_at?: string;
  item_name?: string;
  item_sku?: string;
  item_unit?: string;
}

export class TransactionRepository {
  static async findAll(limit: number = 100): Promise<TransactionRecord[]> {
    const sql = `
      SELECT t.*,
        COALESCE(t.nama_barang, i.name, '-') as item_name,
        COALESCE(t.sku, i.sku, '-') as item_sku,
        COALESCE(t.satuan, i.unit, 'pcs') as item_unit,
        COALESCE(t.tipe_mutasi, CASE WHEN t.type = 'IN' THEN 'MASUK' ELSE 'KELUAR' END) as tipe_mutasi
      FROM transactions t
      LEFT JOIN items i ON t.item_id = i.id
      ORDER BY t.created_at DESC
      LIMIT ?
    `;
    return executeQuery<TransactionRecord>(sql, [limit]);
  }

  static async findByItemId(itemId: string, limit: number = 50): Promise<TransactionRecord[]> {
    const sql = `
      SELECT t.*,
        COALESCE(t.nama_barang, i.name, '-') as item_name,
        COALESCE(t.sku, i.sku, '-') as item_sku,
        COALESCE(t.satuan, i.unit, 'pcs') as item_unit,
        COALESCE(t.tipe_mutasi, CASE WHEN t.type = 'IN' THEN 'MASUK' ELSE 'KELUAR' END) as tipe_mutasi
      FROM transactions t
      LEFT JOIN items i ON t.item_id = i.id
      WHERE t.item_id = ? OR t.tipe_id = ?
      ORDER BY t.created_at DESC
      LIMIT ?
    `;
    return executeQuery<TransactionRecord>(sql, [itemId, itemId, limit]);
  }
}
