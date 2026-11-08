/**
 * Inventory Repository (Database Query Layer)
 * FieldOps IT Inventory Rebuild - MariaDB 11.x
 */

import { executeQuery, runTransaction } from '../db/database';

export interface CategoryRecord {
  id: string;
  code: string;
  name: string;
  description?: string;
  created_at?: string;
}

export interface ItemRecord {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  category_id: string;
  quantity: number;
  min_stock_alert: number;
  unit: string;
  location?: string;
  specs?: string;
  unit_cost: number;
  status: 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  is_deleted: boolean;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export class InventoryRepository {
  // --- KATEGORI ---
  static async findAllCategories(): Promise<CategoryRecord[]> {
    return executeQuery<CategoryRecord>('SELECT * FROM categories ORDER BY name ASC');
  }

  static async findCategoryById(id: string): Promise<CategoryRecord | null> {
    const rows = await executeQuery<CategoryRecord>('SELECT * FROM categories WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async createCategory(cat: { id: string; code: string; name: string; description?: string }): Promise<void> {
    await executeQuery(
      'INSERT INTO categories (id, code, name, description) VALUES (?, ?, ?, ?)',
      [cat.id, cat.code.toUpperCase(), cat.name, cat.description || '']
    );
  }

  // --- BARANG (ITEMS) ---
  static async findAllItems(includeDeleted: boolean = false): Promise<ItemRecord[]> {
    if (includeDeleted) {
      return executeQuery<ItemRecord>('SELECT * FROM items ORDER BY sku ASC');
    }
    return executeQuery<ItemRecord>('SELECT * FROM items WHERE is_deleted = FALSE ORDER BY sku ASC');
  }

  static async findItemById(id: string): Promise<ItemRecord | null> {
    const rows = await executeQuery<ItemRecord>('SELECT * FROM items WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findItemBySku(sku: string): Promise<ItemRecord | null> {
    const rows = await executeQuery<ItemRecord>('SELECT * FROM items WHERE sku = ?', [sku.trim()]);
    return rows[0] || null;
  }

  static async findItemByBarcode(barcode: string): Promise<ItemRecord | null> {
    const rows = await executeQuery<ItemRecord>('SELECT * FROM items WHERE barcode = ? AND is_deleted = FALSE', [barcode.trim()]);
    return rows[0] || null;
  }

  static async findItemByCode(code: string): Promise<ItemRecord | null> {
    const clean = code.trim();
    if (!clean) return null;

    // 1. Cek ID langsung
    const byId = await this.findItemById(clean);
    if (byId && !byId.is_deleted) return byId;

    // 2. Cek SKU
    const bySku = await this.findItemBySku(clean);
    if (bySku && !bySku.is_deleted) return bySku;

    // 3. Cek Barcode
    const byBarcode = await this.findItemByBarcode(clean);
    if (byBarcode && !byBarcode.is_deleted) return byBarcode;

    // 4. Cek apakah ada di item_v2 (berdasarkan kode_id)
    try {
      const v2Rows = await executeQuery<any>('SELECT * FROM item_v2 WHERE kode_id = ? AND status != "dihapus"', [clean]);
      if (v2Rows.length > 0) {
        const v2 = v2Rows[0];
        const tipes = await executeQuery<any>('SELECT * FROM tipe WHERE id = ?', [v2.tipe_id]);
        if (tipes.length > 0) {
          const prods = await executeQuery<any>('SELECT * FROM produk WHERE id = ?', [tipes[0].produk_id]);
          const prodName = prods[0]?.nama || tipes[0]?.nama_tipe;
          const allItems = await this.findAllItems(false);
          const matchItem = allItems.find(it =>
            it.name.toLowerCase().includes(prodName.toLowerCase()) ||
            prodName.toLowerCase().includes(it.name.toLowerCase())
          );
          if (matchItem) return matchItem;
        }
      }
    } catch {
      // Abaikan jika tabel v2 belum tersedia
    }

    return null;
  }

  static async createItem(item: ItemRecord, operatorUserId: string): Promise<void> {
    await runTransaction(async (conn) => {
      await conn.query(
        `INSERT INTO items (id, sku, barcode, name, category_id, quantity, min_stock_alert, unit, location, specs, unit_cost, status, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
        [
          item.id,
          item.sku,
          item.barcode || null,
          item.name,
          item.category_id,
          item.quantity,
          item.min_stock_alert,
          item.unit,
          item.location || '',
          item.specs || '',
          item.unit_cost,
          item.status
        ]
      );

      // Audit Trail
      await conn.query(
        'INSERT INTO audit_logs (user_id, action, table_name, record_id, after_state) VALUES (?, ?, ?, ?, ?)',
        [operatorUserId, 'CREATE_ITEM', 'items', item.id, JSON.stringify(item)]
      );
    });
  }

  static async updateItem(id: string, updates: Partial<ItemRecord>, operatorUserId: string): Promise<ItemRecord> {
    const existing = await this.findItemById(id);
    if (!existing) {
      throw new Error(`Barang dengan ID "${id}" tidak ditemukan.`);
    }

    const updated: ItemRecord = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString()
    };

    // Tentukan status stok otomatis
    if (updated.quantity === 0) {
      updated.status = 'OUT_OF_STOCK';
    } else if (updated.quantity <= updated.min_stock_alert) {
      updated.status = 'LOW_STOCK';
    } else {
      updated.status = 'NORMAL';
    }

    await runTransaction(async (conn) => {
      await conn.query(
        `UPDATE items 
         SET name = ?, category_id = ?, quantity = ?, min_stock_alert = ?, unit = ?, location = ?, specs = ?, unit_cost = ?, status = ?
         WHERE id = ?`,
        [
          updated.name,
          updated.category_id,
          updated.quantity,
          updated.min_stock_alert,
          updated.unit,
          updated.location || '',
          updated.specs || '',
          updated.unit_cost,
          updated.status,
          id
        ]
      );

      // Audit Trail
      await conn.query(
        'INSERT INTO audit_logs (user_id, action, table_name, record_id, before_state, after_state) VALUES (?, ?, ?, ?, ?, ?)',
        [operatorUserId, 'UPDATE_ITEM', 'items', id, JSON.stringify(existing), JSON.stringify(updated)]
      );
    });

    return updated;
  }

  static async softDeleteItem(id: string, operatorUserId: string): Promise<void> {
    const existing = await this.findItemById(id);
    if (!existing) {
      throw new Error(`Barang dengan ID "${id}" tidak ditemukan.`);
    }

    await runTransaction(async (conn) => {
      await conn.query(
        'UPDATE items SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );

      // Audit Trail
      await conn.query(
        'INSERT INTO audit_logs (user_id, action, table_name, record_id, before_state) VALUES (?, ?, ?, ?, ?)',
        [operatorUserId, 'DELETE_ITEM', 'items', id, JSON.stringify(existing)]
      );
    });
  }

  static async restoreDeletedItem(id: string, operatorUserId: string): Promise<void> {
    await runTransaction(async (conn) => {
      await conn.query(
        'UPDATE items SET is_deleted = FALSE, deleted_at = NULL WHERE id = ?',
        [id]
      );

      await conn.query(
        'INSERT INTO audit_logs (user_id, action, table_name, record_id) VALUES (?, ?, ?, ?)',
        [operatorUserId, 'RESTORE_ITEM', 'items', id]
      );
    });
  }

  static async permanentDeleteItem(id: string, operatorUserId: string): Promise<void> {
    const existing = await this.findItemById(id);
    await runTransaction(async (conn) => {
      await conn.query('DELETE FROM items WHERE id = ?', [id]);
      await conn.query(
        'INSERT INTO audit_logs (user_id, action, table_name, record_id, before_state) VALUES (?, ?, ?, ?, ?)',
        [operatorUserId, 'PERMANENT_DELETE_ITEM', 'items', id, existing ? JSON.stringify(existing) : '']
      );
    });
  }
}
