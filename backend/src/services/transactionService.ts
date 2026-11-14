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

export interface DbQueryExecutor {
  query: (sql: string, params?: unknown[]) => Promise<any>;
}

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

interface ResolvedItemMeta {
  tipeId: number | null;
  legacyItem: ItemRecord | null;
  itemName: string;
  itemSku: string;
  itemUnit: string;
}

interface TipeProductRow {
  produk_nama?: string;
  nama_tipe?: string;
  prefix_id?: string | null;
  tipe_stok?: string | null;
}

interface BoxRow {
  id: string;
}

interface StokJumlahRow {
  box_id: string;
  jumlah: number;
}

export class TransactionService {
  static async getAllTransactions(limit: number = 100): Promise<TransactionRecord[]> {
    return TransactionRepository.findAll(limit);
  }

  /**
   * Kalkulasi status stok legacy berdasarkan jumlah dan ambang minimal
   */
  static calculateLegacyStockStatus(
    quantity: number,
    minStockAlert: number
  ): 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK' {
    if (quantity === 0) return 'OUT_OF_STOCK';
    if (quantity <= minStockAlert) return 'LOW_STOCK';
    return 'NORMAL';
  }

  /**
   * Sinkronisasi stok dan status pada tabel legacy items di dalam transaksi atomik
   */
  static async syncLegacyItemStock(
    conn: DbQueryExecutor,
    item: ItemRecord,
    newQty: number
  ): Promise<ItemRecord> {
    const newStatus = this.calculateLegacyStockStatus(newQty, item.min_stock_alert);
    await conn.query(
      'UPDATE items SET quantity = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newQty, newStatus, item.id]
    );
    return {
      ...item,
      quantity: newQty,
      status: newStatus
    };
  }

  /**
   * Penyesuaian stok jumlah v2 (penambahan ke box default atau pengurangan proporsional antar box)
   */
  private static async adjustV2StokJumlah(
    conn: DbQueryExecutor,
    tipeId: number,
    deltaQty: number,
    isAddition: boolean
  ): Promise<void> {
    if (isAddition) {
      const existingBoxes = (await conn.query('SELECT id FROM box WHERE kode = "BOX-A-01"')) as BoxRow[];
      const boxId = existingBoxes && existingBoxes.length > 0 ? existingBoxes[0].id : 'box-1';

      const existingSj = (await conn.query(
        'SELECT jumlah FROM stok_jumlah WHERE tipe_id = ? AND box_id = ?',
        [tipeId, boxId]
      )) as StokJumlahRow[];

      if (existingSj && existingSj.length > 0) {
        await conn.query(
          'UPDATE stok_jumlah SET jumlah = jumlah + ? WHERE tipe_id = ? AND box_id = ?',
          [deltaQty, tipeId, boxId]
        );
      } else {
        await conn.query(
          'INSERT INTO stok_jumlah (tipe_id, box_id, jumlah) VALUES (?, ?, ?)',
          [tipeId, boxId, deltaQty]
        );
      }
      return;
    }

    const sjRows = (await conn.query(
      'SELECT box_id, jumlah FROM stok_jumlah WHERE tipe_id = ? AND jumlah > 0 ORDER BY jumlah DESC',
      [tipeId]
    )) as StokJumlahRow[];

    let remainingToDeduct = deltaQty;
    for (const row of sjRows || []) {
      if (remainingToDeduct <= 0) break;
      const deduct = Math.min(row.jumlah, remainingToDeduct);
      await conn.query(
        'UPDATE stok_jumlah SET jumlah = jumlah - ? WHERE tipe_id = ? AND box_id = ?',
        [deduct, tipeId, row.box_id]
      );
      remainingToDeduct -= deduct;
    }
  }

  private static async getCurrentStockForMeta(meta: ResolvedItemMeta): Promise<number> {
    if (meta.tipeId) {
      return StockService.getStock(meta.tipeId);
    }
    if (meta.legacyItem) {
      return Number(meta.legacyItem.quantity || 0);
    }
    return 0;
  }

  /**
   * Helper menyelesaikan metadata item & tipe v2
   */
  private static async resolveItemMeta(itemIdOrSku: string, conn?: DbQueryExecutor): Promise<ResolvedItemMeta> {
    const q = conn ? conn.query.bind(conn) : executeQuery;
    const tipeId = await LegacyMigrationService.resolveTipeId(itemIdOrSku);

    // Cek di tabel items legacy
    const items = (await q(
      'SELECT * FROM items WHERE (id = ? OR UPPER(sku) = UPPER(?)) AND is_deleted = FALSE',
      [itemIdOrSku, itemIdOrSku]
    )) as ItemRecord[];
    const legacyItem = items && items.length > 0 ? items[0] : null;

    let itemName = legacyItem ? legacyItem.name : '';
    let itemSku = legacyItem ? legacyItem.sku : String(itemIdOrSku);
    let itemUnit = legacyItem ? legacyItem.unit : 'pcs';

    if (tipeId) {
      const tipes = (await q(
        `SELECT t.*, p.nama as produk_nama, p.tipe_stok
         FROM tipe t
         JOIN produk p ON t.produk_id = p.id
         WHERE t.id = ?`,
        [tipeId]
      )) as TipeProductRow[];
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
  }, conn?: DbQueryExecutor): Promise<string> {
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
      const previousQty = await this.getCurrentStockForMeta(meta);
      const newQty = previousQty + qty;

      // 1. Update stok di v2
      if (meta.tipeId) {
        await this.adjustV2StokJumlah(conn, meta.tipeId, qty, true);
      }

      // 2. Sinkronkan ke tabel legacy items jika ada
      const updatedItem = meta.legacyItem
        ? await this.syncLegacyItemStock(conn, meta.legacyItem, newQty)
        : undefined;

      // 3. Catat transaksi mutasi lengkap dengan snapshot
      const recordRefId = meta.legacyItem ? meta.legacyItem.id : String(meta.tipeId || payload.itemId);
      const txId = await this.recordStockTransaction({
        type: 'IN',
        tipe_mutasi: 'MASUK',
        itemId: recordRefId,
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
          recordRefId,
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
      const previousQty = await this.getCurrentStockForMeta(meta);

      // Proteksi anti-stok negatif
      if (previousQty < qty) {
        throw new Error(
          `Stok "${meta.itemName}" tidak mencukupi! Tersedia: ${previousQty} ${meta.itemUnit}, diminta: ${qty} ${meta.itemUnit}.`
        );
      }

      const newQty = previousQty - qty;

      // 1. Kurangi stok di v2
      if (meta.tipeId) {
        await this.adjustV2StokJumlah(conn, meta.tipeId, qty, false);
      }

      // 2. Sinkronkan ke tabel legacy items jika ada
      const updatedItem = meta.legacyItem
        ? await this.syncLegacyItemStock(conn, meta.legacyItem, newQty)
        : undefined;

      // 3. Catat transaksi mutasi lengkap dengan snapshot
      const recordRefId = meta.legacyItem ? meta.legacyItem.id : String(meta.tipeId || payload.itemId);
      const txId = await this.recordStockTransaction({
        type: 'OUT',
        tipe_mutasi: 'KELUAR',
        itemId: recordRefId,
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
          recordRefId,
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
      const validatedEntries: Array<{ meta: ResolvedItemMeta; qty: number; currentStock: number }> = [];

      // Validasi seluruh stok terlebih dahulu sebelum melakukan update
      for (const req of payload.items) {
        const qty = parseInt(String(req.quantity), 10);
        if (!qty || qty <= 0) {
          throw new Error(`Kuantitas barang (${req.itemId}) harus lebih dari 0.`);
        }

        const meta = await this.resolveItemMeta(req.itemId, conn);
        const currentStock = await this.getCurrentStockForMeta(meta);

        if (currentStock < qty) {
          throw new Error(
            `Stok "${meta.itemName}" tidak mencukupi! Tersedia: ${currentStock} ${meta.itemUnit}, Diminta: ${qty} ${meta.itemUnit}.`
          );
        }

        validatedEntries.push({ meta, qty, currentStock });
      }

      // Eksekusi update mutasi jika semua stok aman
      for (const { meta, qty, currentStock: prev } of validatedEntries) {
        const next = prev - qty;

        if (meta.tipeId) {
          await this.adjustV2StokJumlah(conn, meta.tipeId, qty, false);
        }

        if (meta.legacyItem) {
          const updated = await this.syncLegacyItemStock(conn, meta.legacyItem, next);
          processed.push(updated);
          if (next <= meta.legacyItem.min_stock_alert) {
            lowStockAlerts.push(updated);
          }
        }

        const txId = await this.recordStockTransaction({
          type: 'OUT',
          tipe_mutasi: 'KELUAR',
          itemId: meta.legacyItem ? meta.legacyItem.id : String(meta.tipeId || ''),
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
