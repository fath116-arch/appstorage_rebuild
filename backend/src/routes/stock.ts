/**
 * Stock Router (Pencarian Item, Input Stok, Output Cart, Arsip, Restore, & Kondisi)
 * FieldOps IT — Single Canonical Model
 */

import express from 'express';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/authMiddleware';
import { StockService } from '../services/stockService';

const router = express.Router();

router.get('/search', requireAuth, async (req, res) => {
  try {
    const q = req.query.q ? String(req.query.q) : '';
    const items = await StockService.searchStockItems(q);
    return res.json({ success: true, items });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/check-id/:kode_id', requireAuth, async (req, res) => {
  try {
    const kodeId = String(req.params.kode_id);
    const result = await StockService.checkDuplicateKodeId(kodeId);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/types/:id/items', requireAuth, async (req, res) => {
  try {
    const tipeId = parseInt(String(req.params.id), 10);
    const excludeRusak = req.query.exclude_rusak === 'true';
    const data = await StockService.getItemsByTipe(tipeId, { excludeRusak });
    return res.json({ success: true, ...data });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post(
  '/single',
  requireAuth,
  requireRole(['developer', 'admin', 'warehouse_admin']),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const {
        tipe_id,
        box_id,
        kode_id,
        catatan,
        kondisi,
        catatan_kondisi,
        actor_id,
        on_behalf_reason,
        occurred_at,
        request_id,
        reference_number,
        recipient_destination
      } = req.body;
      if (!tipe_id || !box_id || !kode_id) {
        return res.status(400).json({ success: false, message: 'tipe_id, box_id, dan kode_id wajib diisi.' });
      }

      const result = await StockService.inputStokItemSingle({
        tipe_id: Number(tipe_id),
        box_id: String(box_id),
        kode_id: String(kode_id),
        user_id: req.user!.id,
        recordedById: req.user!.id,
        recordedByName: req.user!.name,
        recordedByRole: req.user!.role,
        actorId: actor_id ? String(actor_id) : undefined,
        onBehalfReason: on_behalf_reason ? String(on_behalf_reason) : undefined,
        occurredAt: occurred_at ? String(occurred_at) : undefined,
        requestId: request_id ? String(request_id) : undefined,
        referenceNumber: reference_number ? String(reference_number) : undefined,
        recipientDestination: recipient_destination ? String(recipient_destination) : undefined,
        kondisi,
        catatan_kondisi,
        catatan
      });

      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/bulk',
  requireAuth,
  requireRole(['developer', 'admin', 'warehouse_admin']),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const {
        tipe_id,
        box_id,
        kode_ids,
        auto_count,
        catatan,
        confirmation_token,
        actor_id,
        on_behalf_reason,
        occurred_at,
        request_id,
        reference_number,
        recipient_destination
      } = req.body;
      if (!tipe_id || !box_id) {
        return res.status(400).json({ success: false, message: 'tipe_id dan box_id wajib diisi.' });
      }

      const result = await StockService.inputStokItemBulk({
        tipe_id: Number(tipe_id),
        box_id: String(box_id),
        kode_ids,
        auto_count: auto_count ? Number(auto_count) : undefined,
        user_id: req.user!.id,
        recordedById: req.user!.id,
        recordedByName: req.user!.name,
        recordedByRole: req.user!.role,
        actorId: actor_id ? String(actor_id) : undefined,
        onBehalfReason: on_behalf_reason ? String(on_behalf_reason) : undefined,
        occurredAt: occurred_at ? String(occurred_at) : undefined,
        requestId: request_id ? String(request_id) : undefined,
        referenceNumber: reference_number ? String(reference_number) : undefined,
        recipientDestination: recipient_destination ? String(recipient_destination) : undefined,
        catatan,
        confirmation_token
      });

      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/quantity',
  requireAuth,
  requireRole(['developer', 'admin', 'warehouse_admin']),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const {
        tipe_id,
        box_id,
        jumlah,
        catatan,
        actor_id,
        on_behalf_reason,
        occurred_at,
        request_id,
        reference_number,
        recipient_destination
      } = req.body;
      if (!tipe_id || !box_id || !jumlah) {
        return res.status(400).json({ success: false, message: 'tipe_id, box_id, dan jumlah wajib diisi.' });
      }

      const result = await StockService.inputStokJumlah({
        tipe_id: Number(tipe_id),
        box_id: String(box_id),
        jumlah: Number(jumlah),
        user_id: req.user!.id,
        recordedById: req.user!.id,
        recordedByName: req.user!.name,
        recordedByRole: req.user!.role,
        actorId: actor_id ? String(actor_id) : undefined,
        onBehalfReason: on_behalf_reason ? String(on_behalf_reason) : undefined,
        occurredAt: occurred_at ? String(occurred_at) : undefined,
        requestId: request_id ? String(request_id) : undefined,
        referenceNumber: reference_number ? String(reference_number) : undefined,
        recipientDestination: recipient_destination ? String(recipient_destination) : undefined,
        catatan
      });

      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/out',
  requireAuth,
  requireRole(['developer', 'admin', 'warehouse_admin']),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const {
        kode_id,
        item_id,
        tipe_id,
        box_id,
        jumlah,
        catatan,
        confirmation_token,
        actor_id,
        on_behalf_reason,
        occurred_at,
        request_id,
        reference_number,
        recipient_destination
      } = req.body;
      const result = await StockService.barangKeluarSingle({
        kodeId: kode_id ? String(kode_id) : undefined,
        itemId: item_id ? String(item_id) : undefined,
        tipeId: tipe_id ? Number(tipe_id) : undefined,
        boxId: box_id ? String(box_id) : undefined,
        jumlah: jumlah ? Number(jumlah) : undefined,
        userId: req.user!.id,
        recordedById: req.user!.id,
        recordedByName: req.user!.name,
        recordedByRole: req.user!.role,
        actorId: actor_id ? String(actor_id) : undefined,
        onBehalfReason: on_behalf_reason ? String(on_behalf_reason) : undefined,
        occurredAt: occurred_at ? String(occurred_at) : undefined,
        requestId: request_id ? String(request_id) : undefined,
        referenceNumber: reference_number ? String(reference_number) : undefined,
        recipientDestination: recipient_destination ? String(recipient_destination) : undefined,
        catatan: catatan ? String(catatan) : undefined,
        confirmationToken: confirmation_token ? String(confirmation_token) : undefined
      });
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/out/bulk',
  requireAuth,
  requireRole(['developer', 'admin', 'warehouse_admin']),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const {
        items,
        catatan,
        confirmation_token,
        actor_id,
        on_behalf_reason,
        occurred_at,
        request_id,
        reference_number,
        recipient_destination
      } = req.body;
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ success: false, message: 'Array items wajib diisi.' });
      }

      const result = await StockService.barangKeluarBulk({
        items,
        userId: req.user!.id,
        recordedById: req.user!.id,
        recordedByName: req.user!.name,
        recordedByRole: req.user!.role,
        actorId: actor_id ? String(actor_id) : undefined,
        onBehalfReason: on_behalf_reason ? String(on_behalf_reason) : undefined,
        occurredAt: occurred_at ? String(occurred_at) : undefined,
        requestId: request_id ? String(request_id) : undefined,
        referenceNumber: reference_number ? String(reference_number) : undefined,
        recipientDestination: recipient_destination ? String(recipient_destination) : undefined,
        catatan: catatan ? String(catatan) : undefined,
        confirmationToken: confirmation_token ? String(confirmation_token) : undefined
      });
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

router.get(
  '/archive',
  requireAuth,
  async (req: express.Request, res: express.Response) => {
    try {
      const search = req.query.search ? String(req.query.search) : undefined;
      const data = await StockService.listArsip({ search });
      return res.json({ success: true, items: data });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/restore',
  requireAuth,
  requireRole(['developer', 'admin', 'warehouse_admin']),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const {
        kode_id,
        target_box_id,
        confirm_product_matched,
        catatan,
        kondisi,
        catatan_kondisi,
        actor_id,
        on_behalf_reason,
        occurred_at
      } = req.body;
      if (!kode_id || !target_box_id) {
        return res.status(400).json({ success: false, message: 'kode_id dan target_box_id wajib diisi.' });
      }

      const result = await StockService.restoreItemFromArchive({
        kodeId: String(kode_id),
        targetBoxId: String(target_box_id),
        userId: req.user!.id,
        recordedById: req.user!.id,
        recordedByName: req.user!.name,
        recordedByRole: req.user!.role,
        actorId: actor_id ? String(actor_id) : undefined,
        onBehalfReason: on_behalf_reason ? String(on_behalf_reason) : undefined,
        occurredAt: occurred_at ? String(occurred_at) : undefined,
        confirmProductMatched: Boolean(confirm_product_matched),
        catatan: catatan ? String(catatan) : undefined,
        kondisi: kondisi ? String(kondisi) as any : undefined,
        catatanKondisi: catatan_kondisi ? String(catatan_kondisi) : undefined
      });
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

router.put(
  '/items/:id/condition',
  requireAuth,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const itemId = String(req.params.id);
      const { kondisi, catatan_kondisi } = req.body;
      if (!kondisi || !['Baru', 'Baik', 'Perlu Perbaikan', 'Rusak'].includes(kondisi)) {
        return res.status(400).json({ success: false, message: 'Pilihan kondisi item wajib "Baru", "Baik", "Perlu Perbaikan", atau "Rusak".' });
      }

      const result = await StockService.updateKondisiItem({
        itemId,
        kondisi,
        catatanKondisi: catatan_kondisi ? String(catatan_kondisi) : undefined,
        userId: req.user!.id
      });
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

export default router;
