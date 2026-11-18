/**
 * Field Trip Checklist Router
 * FieldOps IT Inventory Rebuild - MariaDB 11.x
 */

import express from 'express';
import { executeQuery } from '../db/database';
import { AuthenticatedRequest, requireAuth } from '../middleware/authMiddleware';
import { BagService } from '../services/bagService';

const router = express.Router();

// ============================================================================
// OFFICE FIELD TOOL BAGS (MULTI-TAS LAPANGAN)
// ============================================================================

// GET /api/checklists/bags
router.get('/bags', requireAuth, async (_req: AuthenticatedRequest, res) => {
  try {
    const bags = await BagService.listBags();
    res.json({ success: true, bags });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/checklists/bags
router.post('/bags', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { nama_tas, keterangan, items } = req.body;
    const bag = await BagService.createBag({
      namaTas: String(nama_tas || ''),
      keterangan: keterangan ? String(keterangan) : '',
      items,
      userId: req.user!.id,
      userName: req.user!.name
    });
    res.status(201).json({ success: true, bag, message: `Tas "${bag.nama_tas}" berhasil dibuat.` });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/checklists/bags/:id
router.put('/bags/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const bagId = String(req.params.id);
    const { nama_tas, keterangan, items } = req.body;
    const bag = await BagService.updateBag(bagId, {
      namaTas: String(nama_tas || ''),
      keterangan: keterangan ? String(keterangan) : '',
      items,
      userId: req.user!.id,
      userName: req.user!.name
    });
    res.json({ success: true, bag, message: `Tas "${bag.nama_tas}" berhasil diperbarui.` });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/checklists/bags/:id
router.delete('/bags/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const bagId = String(req.params.id);
    const result = await BagService.deleteBag(bagId, req.user!.id, req.user!.name);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/checklists
router.get('/', async (_req, res) => {
  try {
    const rows = await executeQuery<any>(
      "SELECT * FROM checklists WHERE inspection_type != 'BAG_TEMPLATE' ORDER BY created_at DESC LIMIT 50"
    );
    const checklists = rows.map(r => ({
      ...r,
      items: typeof r.items_json === 'string' ? JSON.parse(r.items_json) : r.items_json
    }));
    res.json({ success: true, checklists });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/checklists
router.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { inspectionType, vehicleOrKitName, items, notes } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Daftar item checklist tidak boleh kosong.' });
    }

    const id = `chk-${Date.now()}`;
    const user = req.user!;

    await executeQuery(
      `INSERT INTO checklists (id, technician_id, technician_name, inspection_type, vehicle_or_kit_name, notes, items_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        user.id,
        user.name,
        inspectionType || 'TOOLKIT_CHECK',
        vehicleOrKitName || 'Tas Utama Teknisi',
        notes || '',
        JSON.stringify(items)
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Checklist perlengkapan teknisi berhasil disimpan.',
      checklistId: id
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
