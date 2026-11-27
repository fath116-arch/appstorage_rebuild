/**
 * Stock Router (Pencarian Item, Input Stok, Output Cart, Arsip, Restore, & Kondisi)
 * FieldOps IT — Single Canonical Model
 */

import express from 'express';
import { AuthenticatedRequest, requireAuth, requireFeature } from '../middleware/authMiddleware';
import { ConfirmationService } from '../services/confirmationService';
import { StockService } from '../services/stockService';
import { isFeatureEnabled } from '../utils/permissions';

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
  requireFeature('stock_in_out'),
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
  requireFeature('stock_in_out'),
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
  requireFeature('stock_in_out'),
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
  requireFeature('stock_in_out'),
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
  requireFeature('stock_in_out'),
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
  requireFeature('stock_in_out'),
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

router.delete(
  '/items/bulk',
  requireAuth,
  requireFeature('catalog_manage'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const ids = Array.from(new Set(rawIds.map((x: unknown) => String(x).trim()).filter(Boolean))) as string[];
      const preCheck = await StockService.canDeleteItemsBulk(ids);
      if (!preCheck.canDelete) {
        return res.status(400).json({ success: false, message: preCheck.message || 'Item terpilih tidak dapat dihapus.' });
      }

      const targetId = `bulk:${[...ids].sort().join(',')}`;
      const confirmationToken = (req.headers['x-confirmation-token'] as string) || req.body?.confirmation_token;
      const validation = await ConfirmationService.consumeConfirmationToken(
        confirmationToken,
        req.user!.id,
        'delete_item',
        targetId
      );
      if (!validation.valid) {
        return res.status(403).json({
          success: false,
          message: validation.message,
          requiresConfirmation: true,
          actionType: 'delete_item',
          targetId
        });
      }

      const result = await StockService.deleteItemsBulk(ids, req.user!.id);
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.delete(
  '/items/:id',
  requireAuth,
  requireFeature('catalog_manage'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const itemId = String(req.params.id);
      const preCheck = await StockService.canDeleteItem(itemId);
      if (!preCheck.canDelete) {
        return res.status(400).json({ success: false, message: preCheck.message || 'Item tidak dapat dihapus.' });
      }

      const confirmationToken = (req.headers['x-confirmation-token'] as string) || req.body?.confirmation_token;
      const validation = await ConfirmationService.consumeConfirmationToken(
        confirmationToken,
        req.user!.id,
        'delete_item',
        itemId
      );
      if (!validation.valid) {
        return res.status(403).json({
          success: false,
          message: validation.message,
          requiresConfirmation: true,
          actionType: 'delete_item',
          targetId: itemId
        });
      }

      const result = await StockService.deleteItem(itemId, req.user!.id);
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.delete(
  '/quantity/bulk',
  requireAuth,
  requireFeature('catalog_manage'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const rawEntries = Array.isArray(req.body?.entries) ? req.body.entries : [];
      const entries = rawEntries.map((e: any) => ({
        tipe_id: Number(e.tipe_id),
        box_id: String(e.box_id || '').trim(),
        jumlah: e.jumlah !== undefined ? Number(e.jumlah) : undefined
      }));

      const preCheck = await StockService.canDeleteStokJumlahBulk(entries);
      if (!preCheck.canDelete) {
        return res.status(400).json({ success: false, message: preCheck.message || 'Stok jumlah terpilih tidak dapat dihapus.' });
      }

      const targetKeys = preCheck.validated.map(v => `${v.tipe_id}:${v.box_id}`).sort();
      const targetId = `bulk:${targetKeys.join(',')}`;
      const confirmationToken = (req.headers['x-confirmation-token'] as string) || req.body?.confirmation_token;
      const validation = await ConfirmationService.consumeConfirmationToken(
        confirmationToken,
        req.user!.id,
        'delete_stok_jumlah',
        targetId
      );
      if (!validation.valid) {
        return res.status(403).json({
          success: false,
          message: validation.message,
          requiresConfirmation: true,
          actionType: 'delete_stok_jumlah',
          targetId
        });
      }

      const result = await StockService.deleteStokJumlahBulk(entries, req.user!.id);
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.delete(
  '/quantity',
  requireAuth,
  requireFeature('catalog_manage'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const tipeId = Number(req.body?.tipe_id);
      const boxId = String(req.body?.box_id || '').trim();
      const jumlah = req.body?.jumlah !== undefined ? Number(req.body.jumlah) : undefined;

      const preCheck = await StockService.canDeleteStokJumlah(tipeId, boxId, jumlah);
      if (!preCheck.canDelete) {
        return res.status(400).json({ success: false, message: preCheck.message || 'Stok jumlah tidak dapat dihapus.' });
      }

      const targetId = `${tipeId}:${boxId}`;
      const confirmationToken = (req.headers['x-confirmation-token'] as string) || req.body?.confirmation_token;
      const validation = await ConfirmationService.consumeConfirmationToken(
        confirmationToken,
        req.user!.id,
        'delete_stok_jumlah',
        targetId
      );
      if (!validation.valid) {
        return res.status(403).json({
          success: false,
          message: validation.message,
          requiresConfirmation: true,
          actionType: 'delete_stok_jumlah',
          targetId
        });
      }

      const result = await StockService.deleteStokJumlah(tipeId, boxId, req.user!.id, jumlah);
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/move',
  requireAuth,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      if (!isFeatureEnabled(req.user, 'catalog_manage') && !isFeatureEnabled(req.user, 'stock_in_out')) {
        return res.status(403).json({
          success: false,
          message: 'Akses ditolak: Anda tidak memiliki izin memindahkan stok atau katalog.'
        });
      }

      const {
        item_ids,
        tipe_asal_id,
        box_asal_id,
        jumlah,
        box_tujuan_id,
        tipe_tujuan_id,
        catatan
      } = req.body;

      const result = await StockService.pindahUnit({
        itemIds: Array.isArray(item_ids) ? item_ids.map(String) : undefined,
        tipeAsalId: tipe_asal_id ? Number(tipe_asal_id) : undefined,
        boxAsalId: box_asal_id ? String(box_asal_id) : undefined,
        jumlah: jumlah ? Number(jumlah) : undefined,
        boxTujuanId: box_tujuan_id ? String(box_tujuan_id) : undefined,
        tipeTujuanId: tipe_tujuan_id ? Number(tipe_tujuan_id) : undefined,
        userId: req.user!.id,
        recordedById: req.user!.id,
        recordedByName: req.user!.name,
        recordedByRole: req.user!.role,
        catatan: catatan ? String(catatan) : undefined
      });
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

export default router;
