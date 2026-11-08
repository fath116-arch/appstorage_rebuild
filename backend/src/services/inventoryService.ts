/**
 * Inventory Service (Business Logic Layer)
 * FieldOps IT Inventory Rebuild
 */

import { InventoryRepository, ItemRecord, CategoryRecord } from '../repositories/inventoryRepository';

export class InventoryService {
  static async getAllItems(includeDeleted: boolean = false): Promise<ItemRecord[]> {
    return InventoryRepository.findAllItems(includeDeleted);
  }

  static async getItemById(id: string): Promise<ItemRecord | null> {
    return InventoryRepository.findItemById(id);
  }

  static async getItemByCode(code: string): Promise<ItemRecord | null> {
    return InventoryRepository.findItemByCode(code);
  }

  static async getAllCategories(): Promise<CategoryRecord[]> {
    return InventoryRepository.findAllCategories();
  }

  static async createCategory(code: string, name: string, description?: string): Promise<CategoryRecord> {
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanCode || cleanCode.length < 2) {
      throw new Error('Kode kategori minimal 2 karakter (contoh: CAB, NET).');
    }
    if (!cleanName) {
      throw new Error('Nama kategori wajib diisi.');
    }

    const id = `cat-${cleanCode.toLowerCase()}`;
    await InventoryRepository.createCategory({ id, code: cleanCode, name: cleanName, description });
    return { id, code: cleanCode, name: cleanName, description };
  }

  static async createItem(payload: {
    sku: string;
    barcode?: string;
    name: string;
    category_id: string;
    quantity: number;
    min_stock_alert?: number;
    unit?: string;
    location?: string;
    specs?: string;
    unit_cost?: number;
  }, operatorUserId: string): Promise<ItemRecord> {
    const cleanSku = payload.sku.trim().toUpperCase();
    const cleanName = payload.name.trim();

    if (!cleanSku) throw new Error('SKU barang wajib diisi.');
    if (!cleanName) throw new Error('Nama barang wajib diisi.');
    if (!payload.category_id) throw new Error('Kategori barang wajib dipilih.');

    const qty = Math.max(0, parseInt(String(payload.quantity || 0), 10));
    const minAlert = Math.max(0, parseInt(String(payload.min_stock_alert || 2), 10));

    // Cek duplikasi SKU
    const existing = await InventoryRepository.findItemBySku(cleanSku);
    if (existing && !existing.is_deleted) {
      throw new Error(`SKU "${cleanSku}" sudah terdaftar pada barang "${existing.name}".`);
    }

    // Tentukan status stok
    let status: 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'NORMAL';
    if (qty === 0) status = 'OUT_OF_STOCK';
    else if (qty <= minAlert) status = 'LOW_STOCK';

    const newItem: ItemRecord = {
      id: `item-${Date.now()}`,
      sku: cleanSku,
      barcode: payload.barcode?.trim() || undefined,
      name: cleanName,
      category_id: payload.category_id,
      quantity: qty,
      min_stock_alert: minAlert,
      unit: payload.unit?.trim().toLowerCase() || 'pcs',
      location: payload.location?.trim() || '',
      specs: payload.specs?.trim() || '',
      unit_cost: parseFloat(String(payload.unit_cost || 0)) || 0,
      status,
      is_deleted: false,
      created_at: new Date().toISOString()
    };

    await InventoryRepository.createItem(newItem, operatorUserId);
    return newItem;
  }

  static async updateItem(id: string, payload: Partial<ItemRecord>, operatorUserId: string): Promise<ItemRecord> {
    if (payload.quantity !== undefined && payload.quantity < 0) {
      throw new Error('Jumlah stok fisik tidak boleh negatif.');
    }
    return InventoryRepository.updateItem(id, payload, operatorUserId);
  }

  static async deleteItem(id: string, operatorUserId: string): Promise<void> {
    return InventoryRepository.softDeleteItem(id, operatorUserId);
  }

  static async restoreItem(id: string, operatorUserId: string): Promise<void> {
    return InventoryRepository.restoreDeletedItem(id, operatorUserId);
  }

  static async permanentDeleteItem(id: string, operatorUserId: string): Promise<void> {
    return InventoryRepository.permanentDeleteItem(id, operatorUserId);
  }
}
