/**
 * Inventory Router (Items & Categories CRUD Endpoints)
 * FieldOps IT Inventory Rebuild
 */

import express from 'express';
import { InventoryService } from '../services/inventoryService';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/authMiddleware';

const router = express.Router();

// GET /api/inventory/categories
router.get('/categories', async (_req, res) => {
  try {
    const categories = await InventoryService.getAllCategories();
    res.json({ success: true, categories });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/inventory/categories
router.post('/categories', requireAuth, requireRole(['admin', 'warehouse_admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const { code, name, description } = req.body;
    const cat = await InventoryService.createCategory(code, name, description);
    res.status(201).json({ success: true, message: 'Kategori berhasil dibuat.', category: cat });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/inventory/items
router.get('/items', async (req, res) => {
  try {
    const includeDeleted = req.query.includeDeleted === 'true';
    const items = await InventoryService.getAllItems(includeDeleted);
    res.json({ success: true, items });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/inventory/items/:id
router.get('/items/:id', async (req, res) => {
  try {
    const item = await InventoryService.getItemById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Barang tidak ditemukan.' });
    }
    res.json({ success: true, item });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/inventory/scan/:code (Scan Barcode / QR / SKU / ID)
router.get('/scan/:code', async (req, res) => {
  try {
    const rawCode = decodeURIComponent(String(req.params.code || '')).trim();
    if (!rawCode) {
      return res.status(400).json({ success: false, found: false, message: 'Kode barcode / SKU tidak boleh kosong.' });
    }
    const item = await InventoryService.getItemByCode(rawCode);
    if (!item) {
      return res.status(404).json({
        success: false,
        found: false,
        message: `Kode "${rawCode}" tidak valid atau barang tidak ditemukan dalam database inventori.`
      });
    }
    res.json({
      success: true,
      found: true,
      message: `Barang "${item.name}" [${item.sku}] berhasil ditemukan.`,
      item
    });
  } catch (err: any) {
    res.status(500).json({ success: false, found: false, message: err.message });
  }
});

// POST /api/inventory/items
router.post('/items', requireAuth, requireRole(['admin', 'warehouse_admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const operatorId = req.user!.id;
    const item = await InventoryService.createItem(req.body, operatorId);
    res.status(201).json({ success: true, message: 'Barang berhasil ditambahkan ke master inventori.', item });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/inventory/items/:id
router.put('/items/:id', requireAuth, requireRole(['admin', 'warehouse_admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const operatorId = req.user!.id;
    const itemId = String(req.params.id);
    const updated = await InventoryService.updateItem(itemId, req.body, operatorId);
    res.json({ success: true, message: 'Data barang berhasil diperbarui.', item: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/inventory/items/:id (Soft Delete)
router.delete('/items/:id', requireAuth, requireRole(['admin', 'warehouse_admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const operatorId = req.user!.id;
    const itemId = String(req.params.id);
    await InventoryService.deleteItem(itemId, operatorId);
    res.json({ success: true, message: 'Barang berhasil dipindahkan ke kotak sampah (soft delete).' });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/inventory/items/:id/restore
router.post('/items/:id/restore', requireAuth, requireRole(['admin', 'warehouse_admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const operatorId = req.user!.id;
    const itemId = String(req.params.id);
    await InventoryService.restoreItem(itemId, operatorId);
    res.json({ success: true, message: 'Barang berhasil dipulihkan dari kotak sampah.' });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/inventory/items/:id/permanent (Hard Delete dari Kotak Sampah)
router.delete('/items/:id/permanent', requireAuth, requireRole(['admin', 'warehouse_admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const operatorId = req.user!.id;
    const itemId = String(req.params.id);
    await InventoryService.permanentDeleteItem(itemId, operatorId);
    res.json({ success: true, message: 'Barang berhasil dihapus permanen dari sistem inventori.' });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
