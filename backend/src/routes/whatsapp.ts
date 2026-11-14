/**
 * WhatsApp Gateway Express Router
 * FieldOps IT Inventory v1.2.5 Paket 6
 * - Ambang Berjenjang (Tipe > Produk > Global)
 * - Cooldown 15 Menit di Backend & Ringkasan Konsolidasi
 * - Role Access: Teknisi Read-Only (403 untuk Pengaturan/Kirim)
 */

import { Router, Request, Response } from 'express';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/authMiddleware';
import { WhatsappAlertService } from '../services/whatsappAlertService';
import { isAdminOrDev } from '../utils/permissions';
import { getErrorMessage } from '../utils/errorUtils';

const router = Router();

// GET /api/whatsapp/config (Semua Role Boleh Melihat; Token Disembunyikan untuk Non-Admin)
router.get('/config', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const config = await WhatsappAlertService.getConfig();
    const isDevOrAdmin = isAdminOrDev(req.user?.role);

    // Masked/Cleaned config response (Token mentah tidak pernah dikirim ke frontend)
    const sanitizedConfig = {
      ...config,
      apiToken: '',
      maskedToken: isDevOrAdmin ? config.maskedToken : '••••••••'
    };

    res.json({
      success: true,
      config: sanitizedConfig
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// POST /api/whatsapp/config (Ubah Pengaturan: developer, admin, warehouse_admin; technician 403)
router.post('/config', requireAuth, requireRole(['developer', 'admin', 'warehouse_admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isDevOrAdmin = isAdminOrDev(req.user!.role);

    // Cek apakah payload mencoba mengubah kredensial (apiToken / apiUrl) oleh non-admin
    const isAttemptingCredentials =
      (req.body.apiToken !== undefined && req.body.apiToken !== '') ||
      (req.body.apiUrl !== undefined && req.body.apiUrl !== '' && req.body.apiUrl !== 'https://api.fonnte.com/send');

    if (isAttemptingCredentials && !isDevOrAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Admin Gudang tidak diizinkan mengubah Token atau Endpoint Fonnte. Hanya Developer dan Admin yang berhak.'
      });
    }

    // Jika warehouse_admin mengedit config, buang apiToken & apiUrl agar tidak mengubah kredensial di DB
    const payload = { ...req.body };
    if (!isDevOrAdmin) {
      delete payload.apiToken;
      delete payload.apiUrl;
    }

    const operator = { id: req.user!.id, name: req.user!.name };
    const updated = await WhatsappAlertService.updateConfig(payload, operator);

    res.json({
      success: true,
      message: 'Konfigurasi WhatsApp Alert berhasil diperbarui!',
      config: {
        ...updated,
        apiToken: '',
        maskedToken: isDevOrAdmin ? updated.maskedToken : '••••••••'
      }
    });
  } catch (err: unknown) {
    res.status(400).json({
      success: false,
      message: getErrorMessage(err, 'Gagal memperbarui konfigurasi WhatsApp.')
    });
  }
});

// GET /api/whatsapp/thresholds (Lihat Ambang Berjenjang & Sumber: Semua Role Boleh)
router.get('/thresholds', requireAuth, async (_req: Request, res: Response) => {
  try {
    const matrix = await WhatsappAlertService.getDetailedThresholdMatrix();
    res.json({
      success: true,
      thresholds: matrix
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// POST /api/whatsapp/thresholds (Ubah Ambang / Daftar Pantauan: developer, admin, warehouse_admin; technician 403)
router.post('/thresholds', requireAuth, requireRole(['developer', 'admin', 'warehouse_admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const operator = { id: req.user!.id, name: req.user!.name };
    const result = await WhatsappAlertService.setThreshold(req.body, operator);
    res.json({
      success: true,
      message: 'Ambang stok khusus / daftar pantauan berhasil disimpan.',
      threshold: result
    });
  } catch (err: unknown) {
    res.status(400).json({ success: false, message: getErrorMessage(err) });
  }
});

// POST /api/whatsapp/evaluate (Evaluasi Stok & Antrean Ringkasan: developer, admin, warehouse_admin)
router.post('/evaluate', requireAuth, requireRole(['developer', 'admin', 'warehouse_admin']), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = await WhatsappAlertService.evaluateStockAlerts();
    res.json({
      success: true,
      evaluation
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// POST /api/whatsapp/send (Kirim Alert Ringkasan: developer, admin, warehouse_admin; technician 403)
router.post('/send', requireAuth, requireRole(['developer', 'admin', 'warehouse_admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const operator = { id: req.user!.id, name: req.user!.name };
    const result = await WhatsappAlertService.dispatchConsolidatedAlert({
      force: req.body.force === true,
      triggerSource: req.body.triggerSource || 'Manual Operator Dispatch',
      operator
    });

    if (result.inCooldown) {
      return res.status(429).json({
        success: false,
        inCooldown: true,
        remainingSeconds: result.remainingSeconds,
        message: result.message
      });
    }

    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      message: getErrorMessage(err, 'Gagal mengirim alert WhatsApp.')
    });
  }
});

// POST /api/whatsapp/test (Kirim Pesan Uji: developer, admin, warehouse_admin; technician 403, kena jeda 15m)
router.post('/test', requireAuth, requireRole(['developer', 'admin', 'warehouse_admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const operator = { id: req.user!.id, name: req.user!.name };
    const result = await WhatsappAlertService.sendTestMessage(req.body.targetPhone, operator);
    res.json(result);
  } catch (err: unknown) {
    const message = getErrorMessage(err, 'Gagal mengirim pesan uji WhatsApp.');
    const isCooldown = message.includes('masih aktif');
    res.status(isCooldown ? 429 : 400).json({
      success: false,
      message
    });
  }
});

// GET /api/whatsapp/logs (Riwayat Pengiriman WA Alert: Semua Role Boleh Akses)
router.get('/logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit || '50'), 10);
    const logs = await WhatsappAlertService.getLogs(limit);
    res.json({
      success: true,
      logs
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

export default router;
