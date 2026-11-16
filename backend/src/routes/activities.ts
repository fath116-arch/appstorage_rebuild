/**
 * Canonical Activities & Transaction Ledger Router
 * Menyajikan feed transaksi terpadu & entri koreksi audit (tanpa edit/hapus transaksi final)
 */

import express from 'express';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/authMiddleware';
import { ActivityLogService } from '../services/activityLogService';
import { isWarehouseManager } from '../utils/permissions';

const router = express.Router();

router.get('/', requireAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const typeParam = req.query.type ? String(req.query.type).toUpperCase() : undefined;
    const type = typeParam && ['IN', 'OUT', 'TRANSFER', 'SYSTEM'].includes(typeParam)
      ? (typeParam as 'IN' | 'OUT' | 'TRANSFER' | 'SYSTEM')
      : undefined;
    const requestedActorId = req.query.actorId ? String(req.query.actorId) : undefined;
    const requestId = req.query.requestId ? String(req.query.requestId) : undefined;
    const dateFrom = req.query.dateFrom ? String(req.query.dateFrom) : undefined;
    const dateTo = req.query.dateTo ? String(req.query.dateTo) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 300;

    // Teknisi melihat mutasi miliknya atau tetap membaca feed operasional jika diperlukan;
    // Namun filter eksplisit actorId aman bagi semua peran operasional
    const actorId = isWarehouseManager(req.user!.role)
      ? requestedActorId
      : (requestedActorId || undefined);

    const transactions = await ActivityLogService.getTransactionsFeed({
      type,
      actorId,
      requestId,
      dateFrom,
      dateTo,
      search,
      limit
    });

    return res.json({ success: true, transactions });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id/details', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const details = await ActivityLogService.getActivityDetails(String(req.params.id));
    return res.json({ success: true, details });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post(
  '/:id/correct',
  requireAuth,
  requireRole(['developer', 'admin', 'warehouse_admin']),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const targetTransactionId = String(req.params.id);
      const { alasan, occurred_at } = req.body;
      if (!alasan || String(alasan).trim().length < 5) {
        return res.status(400).json({ success: false, message: 'Alasan koreksi wajib diisi minimal 5 karakter.' });
      }

      const result = await ActivityLogService.createCorrectionEntry({
        targetTransactionId,
        recordedById: req.user!.id,
        recordedByName: req.user!.name,
        recordedByRole: req.user!.role,
        alasanKoreksi: String(alasan),
        occurredAt: occurred_at ? String(occurred_at) : null
      });

      return res.status(201).json({
        success: true,
        message: `Entri koreksi ${result.idAktivitas} berhasil dicatat.`,
        ...result
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

export default router;
