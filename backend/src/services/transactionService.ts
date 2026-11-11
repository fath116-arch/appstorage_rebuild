/**
 * Transaction Service (Atomic Stock Mutation Engine)
 * FieldOps IT Inventory Rebuild - MariaDB 11.x & Catalog v2 Unification
 * Single Source of Truth & Snapshot Integrity
 */

import { runTransaction, executeQuery } from '../db/database';
import { TransactionRecord, TransactionRepository } from '../repositories/transactionRepository';
import { ItemRecord } from '../repositories/inventoryRepository';
import { StockService } from './stockService';
import { LegacyMigrationService } from './legacyMigrationService';

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
   * Helper menyelesaikan metadata item & tipe v2
   */
  private static async resolveItemMeta(itemIdOrSku: string, conn?: { query: (sql: string, params?: any[]) => Promise<any> }) {
    const q = conn ? conn.query.bind(conn) : executeQuery;
    const tipeId = await LegacyMigrationService.resolveTipeId(itemIdOrSku);

    // Cek di tabel items legacy
    const items = await q('SELECT * FROM items WHERE (id = ? OR UPPER(sku) = UPPER(?)) AND is_deleted = FALSE', [itemIdOrSku, itemIdOrSku]);
    const legacyItem = items && items.length > 0 ? items[0] : null;

    let itemName = legacyItem ? legacyItem.name : '';
    let itemSku = legacyItem ? legacyItem.sku : String(itemIdOrSku);
    let itemUnit = legacyItem ? legacyItem.unit : 'pcs';

    if (tipeId) {
      const tipes = await q(
        `SELECT t.*, p.nama as produk_nama, p.tipe_stok
         FROM tipe t
         JOIN produk p ON t.produk_id = p.id
         WHERE t.id = ?`,
        [tipeId]
      );
      if (tipes && tipes.length > 0) {
        const t = tipes[0];
        if (!itemName) itemName = `${t.produk_nama} - ${t.nama_tipe}`;
        if ((!itemSku || itemSku === String(itemIdOrSku)) && t.prefix_id) itemSku = t.prefix_id;
        if (t.tipe_stok && (!legacyItem || !legacyItem.unit)) itemUnit = t.tipe_stok;
      }
    }

    if (!tipeId && !legacyItem) {
      throw new Error(`Barang dengan ID "${itemIdOrSku}" tidak ditemukan.`);
    }

    if (!itemName) itemName = `Barang [${itemSku}]`;

    return {
      tipeId,
      legacyItem,
      itemName,
      itemSku,
      itemUnit
    };
  }

  /**
   * Single Unified Function untuk Mencatat Transaksi Mutasi dengan Snapshot Lengkap
   * Mengisi semua kolom: nama_barang, sku, satuan, tipe_id, tipe_mutasi, quantity, dll.
   */
  static async recordStockTransaction(params: {
    id?: string;
    type: 'IN' | 'OUT';
    tipe_mutasi?: 'MASUK' | 'KELUAR';
    itemId?: string | null;
    tipeId?: number | null;
    namaBarang?: string;
    sku?: string;
    satuan?: string;
    quantity: number;
    previousQty?: number;
    newQty?: number;
    referenceType?: string;
    referenceNumber?: string;
    recipientOrDestination?: string;
    userId?: string;
    performedBy?: string;
    notes?: string;
  }, conn?: { query: (sql: string, params?: any[]) => Promise<any> }): Promise<string> {
    const q = conn ? conn.query.bind(conn) : executeQuery;
    const txId = params.id || `tx-${params.type === 'IN' ? 'in' : 'out'}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    let namaBarang = params.namaBarang;
    let sku = params.sku;
    let satuan = params.satuan;
    let tipeId = params.tipeId || null;
    const itemId = params.itemId ? String(params.itemId) : (tipeId ? String(tipeId) : null);

    // Jika snapshot belum lengkap, coba selesaikan dari database
    if ((!namaBarang || !sku || !satuan) && (tipeId || itemId)) {
      try {
        const meta = await this.resolveItemMeta(String(tipeId || itemId), conn);
        if (!namaBarang) namaBarang = meta.itemName;
        if (!sku) sku = meta.itemSku;
        if (!satuan) satuan = meta.itemUnit;
        if (!tipeId && meta.tipeId) tipeId = meta.tipeId;
      } catch {
        // Fallback
      }
    }

    if (!namaBarang) namaBarang = 'Barang IT';
    if (!sku) sku = itemId ? `SKU-${itemId}` : 'SKU';
    if (!satuan) satuan = 'unit';

    const tipeMutasi: 'MASUK' | 'KELUAR' = params.tipe_mutasi || (params.type === 'IN' ? 'MASUK' : 'KELUAR');

    await q(
      `INSERT INTO transactions (
        id, type, tipe_mutasi, item_id, tipe_id, nama_barang, sku, satuan,
        quantity, previous_qty, new_qty, reference_type, reference_number,
        recipient_destination, user_id, performed_by, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        txId,
        params.type,
        tipeMutasi,
        itemId,
        tipeId,
        namaBarang,
        sku,
        satuan,
        params.quantity,
        params.previousQty ?? 0,
        params.newQty ?? 0,
        params.referenceType || (params.type === 'IN' ? 'STOCK_IN' : 'STOCK_OUT'),
        params.referenceNumber || '',
        params.recipientOrDestination || (params.type === 'IN' ? 'Vendor Gudang' : 'Teknisi Lapangan'),
        params.userId || 'system',
        params.performedBy || 'Operator IT',
        params.notes || ''
      ]
    );

    return txId;
  }

  /**
   * Mutasi Stok Masuk (Stock In) - Transaksi Atomik dengan Snapshot Lengkap
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
      const meta = await this.resolveItemMeta(payload.itemId, conn);

      // Hitung stok sebelumnya dari Single Source of Truth
      let previousQty = 0;
      if (meta.tipeId) {
        previousQty = await StockService.getStock(meta.tipeId);
      } else if (meta.legacyItem) {
        previousQty = Number(meta.legacyItem.quantity || 0);
      }

      const newQty = previousQty + qty;

      // 1. Update stok di v2 (stok_jumlah pada box default box-1)
      if (meta.tipeId) {
        const existingBoxes = await conn.query('SELECT id FROM box WHERE kode = "BOX-A-01"');
        const boxId = existingBoxes && existingBoxes.length > 0 ? existingBoxes[0].id : 'box-1';

        const existingSj = await conn.query(
          'SELECT jumlah FROM stok_jumlah WHERE tipe_id = ? AND box_id = ?',
          [meta.tipeId, boxId]
        );
        if (existingSj && existingSj.length > 0) {
          await conn.query(
            'UPDATE stok_jumlah SET jumlah = jumlah + ? WHERE tipe_id = ? AND box_id = ?',
            [qty, meta.tipeId, boxId]
          );
        } else {
          await conn.query(
            'INSERT INTO stok_jumlah (tipe_id, box_id, jumlah) VALUES (?, ?, ?)',
            [meta.tipeId, boxId, qty]
          );
        }
      }

      // 2. Sinkronkan ke tabel legacy items jika ada
      let updatedItem: ItemRecord | undefined;
      if (meta.legacyItem) {
        let newStatus: 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'NORMAL';
        if (newQty === 0) newStatus = 'OUT_OF_STOCK';
        else if (newQty <= meta.legacyItem.min_stock_alert) newStatus = 'LOW_STOCK';

        await conn.query(
          'UPDATE items SET quantity = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newQty, newStatus, meta.legacyItem.id]
        );

        updatedItem = {
          ...meta.legacyItem,
          quantity: newQty,
          status: newStatus
        };
      }

      // 3. Catat transaksi mutasi lengkap dengan snapshot via recordStockTransaction
      const txId = await this.recordStockTransaction({
        type: 'IN',
        tipe_mutasi: 'MASUK',
        itemId: meta.legacyItem ? meta.legacyItem.id : String(meta.tipeId || payload.itemId),
        tipeId: meta.tipeId || null,
        namaBarang: meta.itemName,
        sku: meta.itemSku,
        satuan: meta.itemUnit,
        quantity: qty,
        previousQty,
        newQty,
        referenceType: payload.referenceType || 'PURCHASE_ORDER',
        referenceNumber: payload.referenceNumber || '',
        recipientOrDestination: payload.sourceOrVendor || 'Vendor Gudang',
        userId: operatorUser.id,
        performedBy: operatorUser.name,
        notes: payload.notes || ''
      }, conn);

      // 4. Audit Trail
      await conn.query(
        'INSERT INTO audit_logs (user_id, action, table_name, record_id, before_state, after_state) VALUES (?, ?, ?, ?, ?, ?)',
        [
          operatorUser.id,
          'STOCK_IN',
          'items',
          meta.legacyItem ? meta.legacyItem.id : String(meta.tipeId || payload.itemId),
          JSON.stringify({ quantity: previousQty }),
          JSON.stringify({ quantity: newQty, txId })
        ]
      );

      return {
        success: true,
        message: `Stok masuk berhasil dicatat. Sisa stok ${meta.itemName}: ${newQty} ${meta.itemUnit}.`,
        transactionId: txId,
        item: updatedItem,
        lowStockAlertTriggered: false,
        lowStockItems: []
      };
    });
  }

  /**
   * Mutasi Stok Keluar (Stock Out) - Transaksi Atomik dengan Proteksi Non-Negatif & Snapshot
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
      const meta = await this.resolveItemMeta(payload.itemId, conn);

      // Hitung stok saat ini dari Single Source of Truth
      let previousQty = 0;
      if (meta.tipeId) {
        previousQty = await StockService.getStock(meta.tipeId);
      } else if (meta.legacyItem) {
        previousQty = Number(meta.legacyItem.quantity || 0);
      }

      // Proteksi anti-stok negatif
      if (previousQty < qty) {
        throw new Error(
          `Stok "${meta.itemName}" tidak mencukupi! Tersedia: ${previousQty} ${meta.itemUnit}, diminta: ${qty} ${meta.itemUnit}.`
        );
      }

      const newQty = previousQty - qty;

      // 1. Kurangi stok di v2 (stok_jumlah pada box yang memiliki stok)
      if (meta.tipeId) {
        const sjRows = await conn.query(
          'SELECT box_id, jumlah FROM stok_jumlah WHERE tipe_id = ? AND jumlah > 0 ORDER BY jumlah DESC',
          [meta.tipeId]
        );
        let remainingToDeduct = qty;
        for (const row of (sjRows || [])) {
          if (remainingToDeduct <= 0) break;
          const deduct = Math.min(row.jumlah, remainingToDeduct);
          await conn.query(
            'UPDATE stok_jumlah SET jumlah = jumlah - ? WHERE tipe_id = ? AND box_id = ?',
            [deduct, meta.tipeId, row.box_id]
          );
          remainingToDeduct -= deduct;
        }
      }

      // 2. Sinkronkan ke tabel legacy items jika ada
      let updatedItem: ItemRecord | undefined;
      if (meta.legacyItem) {
        let newStatus: 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'NORMAL';
        if (newQty === 0) newStatus = 'OUT_OF_STOCK';
        else if (newQty <= meta.legacyItem.min_stock_alert) newStatus = 'LOW_STOCK';

        await conn.query(
          'UPDATE items SET quantity = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newQty, newStatus, meta.legacyItem.id]
        );

        updatedItem = {
          ...meta.legacyItem,
          quantity: newQty,
          status: newStatus
        };
      }

      // 3. Catat transaksi mutasi lengkap dengan snapshot via recordStockTransaction
      const txId = await this.recordStockTransaction({
        type: 'OUT',
        tipe_mutasi: 'KELUAR',
        itemId: meta.legacyItem ? meta.legacyItem.id : String(meta.tipeId || payload.itemId),
        tipeId: meta.tipeId || null,
        namaBarang: meta.itemName,
        sku: meta.itemSku,
        satuan: meta.itemUnit,
        quantity: qty,
        previousQty,
        newQty,
        referenceType: payload.referenceType || 'FIELD_DISPATCH',
        referenceNumber: payload.referenceNumber || '',
        recipientOrDestination: payload.recipientOrDestination || 'Teknisi Lapangan',
        userId: operatorUser.id,
        performedBy: operatorUser.name,
        notes: payload.notes || ''
      }, conn);

      // 4. Audit Trail
      await conn.query(
        'INSERT INTO audit_logs (user_id, action, table_name, record_id, before_state, after_state) VALUES (?, ?, ?, ?, ?, ?)',
        [
          operatorUser.id,
          'STOCK_OUT',
          'items',
          meta.legacyItem ? meta.legacyItem.id : String(meta.tipeId || payload.itemId),
          JSON.stringify({ quantity: previousQty }),
          JSON.stringify({ quantity: newQty, txId })
        ]
      );

      const minAlert = meta.legacyItem ? meta.legacyItem.min_stock_alert : 2;
      const isAlert = newQty <= minAlert;

      return {
        success: true,
        message: `Stok keluar berhasil dicatat. Sisa stok ${meta.itemName}: ${newQty} ${meta.itemUnit}.`,
        transactionId: txId,
        item: updatedItem,
        lowStockAlertTriggered: isAlert,
        lowStockItems: (isAlert && updatedItem) ? [updatedItem] : []
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

        const meta = await this.resolveItemMeta(req.itemId, conn);
        let currentStock = 0;
        if (meta.tipeId) {
          currentStock = await StockService.getStock(meta.tipeId);
        } else if (meta.legacyItem) {
          currentStock = Number(meta.legacyItem.quantity || 0);
        }

        if (currentStock < qty) {
          throw new Error(
            `Stok "${meta.itemName}" tidak mencukupi! Tersedia: ${currentStock} ${meta.itemUnit}, Diminta: ${qty} ${meta.itemUnit}.`
          );
        }
      }

      // Eksekusi update mutasi jika semua stok aman
      for (const req of payload.items) {
        const qty = parseInt(String(req.quantity), 10);
        const meta = await this.resolveItemMeta(req.itemId, conn);

        let prev = 0;
        if (meta.tipeId) {
          prev = await StockService.getStock(meta.tipeId);
        } else if (meta.legacyItem) {
          prev = Number(meta.legacyItem.quantity || 0);
        }

        const next = prev - qty;

        // 1. Kurangi stok di v2
        if (meta.tipeId) {
          const sjRows = await conn.query(
            'SELECT box_id, jumlah FROM stok_jumlah WHERE tipe_id = ? AND jumlah > 0 ORDER BY jumlah DESC',
            [meta.tipeId]
          );
          let remainingToDeduct = qty;
          for (const row of (sjRows || [])) {
            if (remainingToDeduct <= 0) break;
            const deduct = Math.min(row.jumlah, remainingToDeduct);
            await conn.query(
              'UPDATE stok_jumlah SET jumlah = jumlah - ? WHERE tipe_id = ? AND box_id = ?',
              [deduct, meta.tipeId, row.box_id]
            );
            remainingToDeduct -= deduct;
          }
        }

        // 2. Sinkronkan ke tabel items jika ada
        let updated: ItemRecord | undefined;
        if (meta.legacyItem) {
          let status: 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'NORMAL';
          if (next === 0) status = 'OUT_OF_STOCK';
          else if (next <= meta.legacyItem.min_stock_alert) status = 'LOW_STOCK';

          await conn.query('UPDATE items SET quantity = ?, status = ? WHERE id = ?', [next, status, meta.legacyItem.id]);
          updated = { ...meta.legacyItem, quantity: next, status };
          if (updated) {
            processed.push(updated);
            if (next <= meta.legacyItem.min_stock_alert) {
              lowStockAlerts.push(updated);
            }
          }
        }

        // 3. Catat transaksi mutasi lengkap dengan snapshot via recordStockTransaction
        const txId = await this.recordStockTransaction({
          type: 'OUT',
          tipe_mutasi: 'KELUAR',
          itemId: meta.legacyItem ? meta.legacyItem.id : String(meta.tipeId || req.itemId),
          tipeId: meta.tipeId || null,
          namaBarang: meta.itemName,
          sku: meta.itemSku,
          satuan: meta.itemUnit,
          quantity: qty,
          previousQty: prev,
          newQty: next,
          referenceType: payload.referenceType || 'BATCH_DISPATCH',
          referenceNumber: payload.referenceNumber || '',
          recipientOrDestination: payload.recipientOrDestination || 'Teknisi Lapangan',
          userId: operatorUser.id,
          performedBy: operatorUser.name,
          notes: payload.notes || ''
        }, conn);
        txIds.push(txId);
      }

      return {
        success: true,
        message: `Berhasil memproses pengeluaran ${payload.items.length} jenis barang secara atomik.`,
        transactionIds: txIds,
        processedItems: processed,
        lowStockAlertTriggered: lowStockAlerts.length > 0,
        lowStockItems: lowStockAlerts
      };
    });
  }
}
