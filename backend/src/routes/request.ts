/**
 * Request Router (Alur Request Teknisi, Reservasi, Pickup, Pengembalian Alat, & Timeline)
 * FieldOps IT — Single Canonical Model
 */

import express from 'express';
import { AuthenticatedRequest, requireAuth, requireFeature } from '../middleware/authMiddleware';
import { RequestService } from '../services/requestService';
import { isFeatureEnabled, isWarehouseManager } from '../utils/permissions';

const router = express.Router();

router.post('/', requireAuth, requireFeature('requests_create'), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const {
      tipe_id,
      box_id,
      kode_id,
      jumlah,
      alasan,
      actor_id,
      on_behalf_reason,
      request_type,
      origin_request_id,
      return_condition,
      return_box_id,
      return_notes,
      purchase_item_name,
      purchase_estimated_price
    } = req.body;

    const reqType = request_type === 'kembalikan' ? 'kembalikan' : request_type === 'beli' ? 'beli' : 'ambil';
    if (reqType === 'ambil' && (!tipe_id || !alasan)) {
      return res.status(400).json({ success: false, message: 'tipe_id dan alasan permohonan wajib diisi.' });
    }
    if (reqType === 'kembalikan' && (!origin_request_id || !return_condition)) {
      return res.status(400).json({
        success: false,
        message: 'Pilih barang yang dibawa dan kondisi barang yang akan dikembalikan.'
      });
    }
    if (reqType === 'beli' && (!alasan || (!tipe_id && !purchase_item_name))) {
      return res.status(400).json({
        success: false,
        message: 'Pilih barang dari katalog atau ketik nama barang baru serta isi alasan pengajuan pembelian.'
      });
    }

    const requestObj = await RequestService.createRequest({
      pemohonId: req.user!.id,
      actorId: actor_id ? String(actor_id) : undefined,
      actorRole: req.user!.role,
      recordedByRole: req.user!.role,
      onBehalfReason: on_behalf_reason ? String(on_behalf_reason) : undefined,
      requestType: reqType,
      originRequestId: origin_request_id ? String(origin_request_id) : undefined,
      returnCondition: return_condition ? String(return_condition) as 'Baru' | 'Baik' | 'Perlu Perbaikan' | 'Rusak' : undefined,
      returnBoxId: return_box_id ? String(return_box_id) : undefined,
      returnNotes: return_notes ? String(return_notes) : undefined,
      tipeId: tipe_id ? Number(tipe_id) : undefined,
      boxId: box_id ? String(box_id) : undefined,
      kodeId: kode_id ? String(kode_id) : undefined,
      jumlah: jumlah ? Number(jumlah) : undefined,
      alasan: alasan ? String(alasan) : undefined,
      purchaseItemName: purchase_item_name ? String(purchase_item_name) : undefined,
      purchaseEstimatedPrice:
        purchase_estimated_price !== undefined && purchase_estimated_price !== null && String(purchase_estimated_price).trim() !== ''
          ? Number(purchase_estimated_price)
          : undefined
    });

    return res.status(201).json({ success: true, data: requestObj });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/bag', requireAuth, requireFeature('requests_create'), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { bag_id, alasan, actor_id, on_behalf_reason } = req.body;
    if (!bag_id || !alasan) {
      return res.status(400).json({ success: false, message: 'Pilih Tas dan isi alasan permohonan.' });
    }
    const result = await RequestService.createBagRequest({
      bagId: String(bag_id),
      pemohonId: req.user!.id,
      actorId: actor_id ? String(actor_id) : undefined,
      actorRole: req.user!.role,
      recordedByRole: req.user!.role,
      onBehalfReason: on_behalf_reason ? String(on_behalf_reason) : undefined,
      alasan: String(alasan)
    });
    return res.status(201).json({
      success: true,
      bag: result.bag,
      requests: result.requests,
      message: `Permohonan paket Tas "${result.bag.nama_tas}" (${result.requests.length} item) berhasil diajukan.`
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/', requireAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const status = req.query.status as any;
    const requestedPemohonId = req.query.pemohon_id ? String(req.query.pemohon_id) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;

    // Teknisi hanya melihat request miliknya sendiri kecuali pengelola gudang / diberi akses requests_manage
    const canManage = isWarehouseManager(req.user!.role) || isFeatureEnabled(req.user, 'requests_manage');
    const pemohonId = canManage ? requestedPemohonId : req.user!.id;

    const list = await RequestService.listRequests({
      pemohonId,
      status,
      search
    });

    return res.json({ success: true, requests: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/held', requireAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const actorIdParam = req.query.actor_id ? String(req.query.actor_id) : undefined;
    const canManage = isWarehouseManager(req.user!.role) || isFeatureEnabled(req.user, 'requests_manage');
    const actorId = canManage ? actorIdParam : req.user!.id;
    const held = await RequestService.listHeldByTechnicians({ actorId });
    return res.json({ success: true, items: held });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get(
  '/open-for-actor/:actorId',
  requireAuth,
  requireFeature('requests_manage'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const actorId = String(req.params.actorId);
      const list = await RequestService.listOpenRequestsForActor(actorId);
      return res.json({ success: true, requests: list });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const reqObj = await RequestService.getRequestById(String(req.params.id));
    if (!reqObj) {
      return res.status(404).json({ success: false, message: 'Permohonan tidak ditemukan.' });
    }
    const canManage = isWarehouseManager(req.user!.role) || isFeatureEnabled(req.user, 'requests_manage');
    if (!canManage && reqObj.pemohon_id !== req.user!.id && reqObj.actor_id !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses melihat permohonan ini.' });
    }
    return res.json({ success: true, data: reqObj });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id/timeline', requireAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const reqObj = await RequestService.getRequestById(String(req.params.id));
    if (!reqObj) {
      return res.status(404).json({ success: false, message: 'Permohonan tidak ditemukan.' });
    }
    const canManage = isWarehouseManager(req.user!.role) || isFeatureEnabled(req.user, 'requests_manage');
    if (!canManage && reqObj.pemohon_id !== req.user!.id && reqObj.actor_id !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke timeline permohonan ini.' });
    }
    const timeline = await RequestService.getRequestTimeline(reqObj.id);
    return res.json({ success: true, timeline });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post(
  '/:id/approve',
  requireAuth,
  requireFeature('requests_manage'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const requestId = String(req.params.id);
      const { confirmation_token, target_box_id } = req.body;

      const result = await RequestService.approveRequest({
        requestId,
        penyetujuId: req.user!.id,
        penyetujuRole: req.user!.role,
        confirmationToken: confirmation_token ? String(confirmation_token) : undefined,
        targetBoxId: target_box_id ? String(target_box_id) : undefined
      });

      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/:id/pickup',
  requireAuth,
  requireFeature('requests_manage'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const requestId = String(req.params.id);
      const { occurred_at, catatan } = req.body;
      const result = await RequestService.pickupRequest({
        requestId,
        recordedById: req.user!.id,
        recordedByName: req.user!.name,
        recordedByRole: req.user!.role,
        occurredAt: occurred_at ? String(occurred_at) : undefined,
        catatan: catatan ? String(catatan) : undefined
      });
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/:id/return',
  requireAuth,
  requireFeature('requests_manage'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const requestId = String(req.params.id);
      const { return_condition, return_notes, return_box_id, occurred_at } = req.body;
      if (!return_box_id || !return_condition) {
        return res.status(400).json({ success: false, message: 'Box tujuan pengembalian dan kondisi barang wajib diisi.' });
      }
      if (!['Baru', 'Baik', 'Perlu Perbaikan', 'Rusak'].includes(return_condition)) {
        return res.status(400).json({ success: false, message: 'Kondisi pengembalian tidak valid.' });
      }

      const result = await RequestService.returnRequest({
        requestId,
        recordedById: req.user!.id,
        recordedByName: req.user!.name,
        recordedByRole: req.user!.role,
        returnCondition: return_condition,
        returnNotes: return_notes ? String(return_notes) : undefined,
        returnBoxId: String(return_box_id),
        occurredAt: occurred_at ? String(occurred_at) : undefined
      });
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/:id/complete',
  requireAuth,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const requestId = String(req.params.id);
      const { customer_name, usage_notes, occurred_at } = req.body;

      const existing = await RequestService.getRequestById(requestId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Permohonan tidak ditemukan.' });
      }
      if (existing.request_type !== 'beli' && (!customer_name || !usage_notes)) {
        return res.status(400).json({
          success: false,
          message: 'Nama / ID Pelanggan dan catatan pemasangan wajib diisi.'
        });
      }

      const result = await RequestService.completeRequest({
        requestId,
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        customerName: customer_name ? String(customer_name) : undefined,
        usageNotes: usage_notes ? String(usage_notes) : undefined,
        occurredAt: occurred_at ? String(occurred_at) : undefined
      });
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/:id/reject',
  requireAuth,
  requireFeature('requests_manage'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const requestId = String(req.params.id);
      const { catatan_penolakan, confirmation_token } = req.body;

      const result = await RequestService.rejectRequest({
        requestId,
        penyetujuId: req.user!.id,
        catatanPenolakan: catatan_penolakan ? String(catatan_penolakan) : undefined,
        confirmationToken: confirmation_token ? String(confirmation_token) : undefined
      });

      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/:id/cancel',
  requireAuth,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const requestId = String(req.params.id);
      const { catatan } = req.body;
      const result = await RequestService.cancelRequest({
        requestId,
        userId: req.user!.id,
        userRole: req.user!.role,
        catatan: catatan ? String(catatan) : undefined
      });
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

export default router;
