/**
 * Transaction Service (Atomic Stock Mutation Engine)
 * FieldOps IT Inventory Rebuild - MariaDB 11.x
 */

import { runTransaction, executeQuery } from '../db/database';
import { TransactionRecord, TransactionRepository } from '../repositories/transactionRepository';
import { ItemRecord } from '../repositories/inventoryRepository';

export interface MutationResult {
  success: boolean;
  message: string;
  transactionId?: string;
  item?: ItemRecord;
  lowStockAlertTriggered: boolean;
  lowStockItems: ItemRecord[];
}

export interface BatchMutationResult {
  success: boolean;
  message: string;
  transactionIds: string[];
  processedItems: ItemRecord[];
  lowStockAlertTriggered: boolean;
  lowStockItems: ItemRecord[];
}

export class TransactionService {
  static async getAllTransactions(limit: number = 100): Promise<TransactionRecord[]> {
    return TransactionRepository.findAll(limit);
  }

  /**
   * Mutasi Stok Masuk (Stock In) - Transaksi Atomik
   */
  static async recordStockIn(payload: {
    itemId: string;
    quantity: number;
    referenceType?: string;
    referenceNumber?: string;
    sourceOrVendor?: string;
    notes?: string;
  }, operatorUser: { id: string; name: string }): Promise<MutationResult> {
    const qty = parseInt(String(payload.quantity), 10);
    if (!qty || qty <= 0) {
      throw new Error('Jumlah barang masuk harus bilangan bulat lebih besar dari 0.');
    }

    return await runTransaction(async (conn) => {
      // 1. Ambil data barang saat ini (FOR UPDATE jika di MariaDB nyata)
      const items = await conn.query('SELECT * FROM items WHERE id = ? AND is_deleted = FALSE', [payload.itemId]);
      const item: ItemRecord = items[0];
      if (!item) {
        throw new Error(`Barang dengan ID "${payload.itemId}" tidak ditemukan.`);
      }

      const previousQty = item.quantity;
      const newQty = previousQty + qty;

      // Status stok baru
      let newStatus: 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'NORMAL';
      if (newQty === 0) newStatus = 'OUT_OF_STOCK';
      else if (newQty <= item.min_stock_alert) newStatus = 'LOW_STOCK';

      // 2. Update stok barang
      await conn.query(
        'UPDATE items SET quantity = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newQty, newStatus, item.id]
      );

      // 3. Catat transaksi mutasi
      const txId = `tx-in-${Date.now()}`;
      await conn.query(
        `INSERT INTO transactions (id, type, item_id, quantity, previous_qty, new_qty, reference_type, reference_number, recipient_destination, user_id, performed_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txId,
          'IN',
          item.id,
          qty,
          previousQty,
          newQty,
          payload.referenceType || 'PURCHASE_ORDER',
          payload.referenceNumber || '',
          payload.sourceOrVendor || 'Vendor Gudang',
          operatorUser.id,
          operatorUser.name,
          payload.notes || ''
        ]
      );

      // 4. Audit Trail
      await conn.query(
        'INSERT INTO audit_logs (user_id, action, table_name, record_id, before_state, after_state) VALUES (?, ?, ?, ?, ?, ?)',
        [
          operatorUser.id,
          'STOCK_IN',
          'items',
          item.id,
          JSON.stringify({ quantity: previousQty }),
          JSON.stringify({ quantity: newQty, txId })
        ]
      );

      const updatedItem: ItemRecord = {
        ...item,
        quantity: newQty,
        status: newStatus
      };

      return {
        success: true,
        message: `Stok masuk berhasil dicatat. Sisa stok ${item.name}: ${newQty} ${item.unit}.`,
        transactionId: txId,
        item: updatedItem,
        lowStockAlertTriggered: false,
        lowStockItems: []
      };
    });
  }

  /**
   * Mutasi Stok Keluar (Stock Out) - Transaksi Atomik dengan Proteksi Non-Negatif
   */
  static async recordStockOut(payload: {
    itemId: string;
    quantity: number;
    referenceType?: string;
    referenceNumber?: string;
    recipientOrDestination?: string;
    notes?: string;
  }, operatorUser: { id: string; name: string }): Promise<MutationResult> {
    const qty = parseInt(String(payload.quantity), 10);
    if (!qty || qty <= 0) {
      throw new Error('Jumlah barang keluar harus bilangan bulat lebih besar dari 0.');
    }

    return await runTransaction(async (conn) => {
      const items = await conn.query('SELECT * FROM items WHERE id = ? AND is_deleted = FALSE', [payload.itemId]);
      const item: ItemRecord = items[0];
      if (!item) {
        throw new Error(`Barang dengan ID "${payload.itemId}" tidak ditemukan.`);
      }

      const previousQty = item.quantity;
      if (previousQty < qty) {
        throw new Error(`Stok "${item.name}" tidak mencukupi! Tersedia: ${previousQty} ${item.unit}, diminta: ${qty} ${item.unit}.`);
      }

      const newQty = previousQty - qty;

      // Status stok baru
      let newStatus: 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'NORMAL';
      if (newQty === 0) newStatus = 'OUT_OF_STOCK';
      else if (newQty <= item.min_stock_alert) newStatus = 'LOW_STOCK';

      // Update stok
      await conn.query(
        'UPDATE items SET quantity = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newQty, newStatus, item.id]
      );

      // Catat mutasi
      const txId = `tx-out-${Date.now()}`;
      await conn.query(
        `INSERT INTO transactions (id, type, item_id, quantity, previous_qty, new_qty, reference_type, reference_number, recipient_destination, user_id, performed_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txId,
          'OUT',
          item.id,
          qty,
          previousQty,
          newQty,
          payload.referenceType || 'FIELD_DISPATCH',
          payload.referenceNumber || '',
          payload.recipientOrDestination || 'Teknisi Lapangan',
          operatorUser.id,
          operatorUser.name,
          payload.notes || ''
        ]
      );

      // Audit Trail
      await conn.query(
        'INSERT INTO audit_logs (user_id, action, table_name, record_id, before_state, after_state) VALUES (?, ?, ?, ?, ?, ?)',
        [
          operatorUser.id,
          'STOCK_OUT',
          'items',
          item.id,
          JSON.stringify({ quantity: previousQty }),
          JSON.stringify({ quantity: newQty, txId })
        ]
      );

      const updatedItem: ItemRecord = {
        ...item,
        quantity: newQty,
        status: newStatus
      };

      const isAlert = newQty <= item.min_stock_alert;

      return {
        success: true,
        message: `Stok keluar berhasil dicatat. Sisa stok ${item.name}: ${newQty} ${item.unit}.`,
        transactionId: txId,
        item: updatedItem,
        lowStockAlertTriggered: isAlert,
        lowStockItems: isAlert ? [updatedItem] : []
      };
    });
  }

  /**
   * Batch Stock Out (Pengambilan Banyak Barang Sekaligus) - Transaksi Atomik
   */
  static async recordBatchStockOut(payload: {
    items: Array<{ itemId: string; quantity: number }>;
    referenceType?: string;
    referenceNumber?: string;
    recipientOrDestination?: string;
    notes?: string;
  }, operatorUser: { id: string; name: string }): Promise<BatchMutationResult> {
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error('Daftar barang mutasi batch tidak boleh kosong.');
    }

    return await runTransaction(async (conn) => {
      const txIds: string[] = [];
      const processed: ItemRecord[] = [];
      const lowStockAlerts: ItemRecord[] = [];

      // Validasi seluruh stok terlebih dahulu sebelum melakukan update
      for (const req of payload.items) {
        const qty = parseInt(String(req.quantity), 10);
        if (!qty || qty <= 0) {
          throw new Error(`Kuantitas barang (${req.itemId}) harus lebih dari 0.`);
        }

        const rows = await conn.query('SELECT * FROM items WHERE id = ? AND is_deleted = FALSE', [req.itemId]);
        const it: ItemRecord = rows[0];
        if (!it) {
          throw new Error(`Barang ID "${req.itemId}" tidak ditemukan di database.`);
        }

        if (it.quantity < qty) {
          throw new Error(`Stok "${it.name}" tidak mencukupi! Tersedia: ${it.quantity} ${it.unit}, Diminta: ${qty} ${it.unit}.`);
        }
      }

      // Eksekusi update mutasi jika semua stok aman
      for (const req of payload.items) {
        const qty = parseInt(String(req.quantity), 10);
        const rows = await conn.query('SELECT * FROM items WHERE id = ?', [req.itemId]);
        const it: ItemRecord = rows[0];

        const prev = it.quantity;
        const next = prev - qty;

        let status: 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'NORMAL';
        if (next === 0) status = 'OUT_OF_STOCK';
        else if (next <= it.min_stock_alert) status = 'LOW_STOCK';

        await conn.query('UPDATE items SET quantity = ?, status = ? WHERE id = ?', [next, status, it.id]);

        const txId = `tx-batch-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        txIds.push(txId);

        await conn.query(
          `INSERT INTO transactions (id, type, item_id, quantity, previous_qty, new_qty, reference_type, reference_number, recipient_destination, user_id, performed_by, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            txId,
            'OUT',
            it.id,
            qty,
            prev,
            next,
            payload.referenceType || 'BATCH_DISPATCH',
            payload.referenceNumber || '',
            payload.recipientOrDestination || 'Teknisi Lapangan',
            operatorUser.id,
            operatorUser.name,
            payload.notes || ''
          ]
        );

        const updated: ItemRecord = { ...it, quantity: next, status };
        processed.push(updated);

        if (next <= it.min_stock_alert) {
          lowStockAlerts.push(updated);
        }
      }

      return {
        success: true,
        message: `Berhasil memproses pengeluaran ${processed.length} jenis barang secara atomik.`,
        transactionIds: txIds,
        processedItems: processed,
        lowStockAlertTriggered: lowStockAlerts.length > 0,
        lowStockItems: lowStockAlerts
      };
    });
  }
}
