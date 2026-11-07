/**
 * Request Router (Tahap 6: Alur Request Teknisi & Persetujuan Cepat)
 * FieldOps Inventory v2
 */

import express from 'express';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/authMiddleware';
import { RequestService } from '../services/requestService';

const router = express.Router();

router.post('/', requireAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { tipe_id, box_id, kode_id, jumlah, alasan } = req.body;
    if (!tipe_id || !alasan) {
      return res.status(400).json({ success: false, message: 'tipe_id dan alasan permohonan wajib diisi.' });
    }

    const requestObj = await RequestService.createRequest({
      pemohonId: req.user!.id,
      tipeId: Number(tipe_id),
      boxId: box_id ? String(box_id) : undefined,
      kodeId: kode_id ? String(kode_id) : undefined,
      jumlah: jumlah ? Number(jumlah) : undefined,
      alasan: String(alasan)
    });

    return res.status(201).json({ success: true, data: requestObj });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/', requireAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const status = req.query.status as any;
    const pemohonId = req.query.pemohon_id ? String(req.query.pemohon_id) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;

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

router.get('/:id', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const reqObj = await RequestService.getRequestById(String(req.params.id));
    if (!reqObj) {
      return res.status(404).json({ success: false, message: 'Permohonan tidak ditemukan.' });
    }
    return res.json({ success: true, data: reqObj });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post(
  '/:id/approve',
  requireAuth,
  requireRole(['developer', 'admin', 'warehouse_admin']),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const requestId = String(req.params.id);
      const { confirmation_token, target_box_id } = req.body;

      const result = await RequestService.approveRequest({
        requestId,
        penyetujuId: req.user!.id,
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
  '/:id/reject',
  requireAuth,
  requireRole(['developer', 'admin', 'warehouse_admin']),
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

export default router;
