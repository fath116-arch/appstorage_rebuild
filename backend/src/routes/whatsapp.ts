/**
 * WhatsApp Gateway Express Router (v1.2.8)
 * - Role Access:
 *   * Gateway credentials, URLs, & ON/OFF sliders: HANYA Developer
 *   * 4 Recipient Slots (ON/OFF), thresholds, watchlist, manual dispatch: Developer / Admin (feature 'wa_alert_recipients')
 *   * Read-only view: requireAuth (tanpa informasi URL/token gateway bagi non-Developer)
 */

import { Router, Request, Response } from 'express';
import { AuthenticatedRequest, requireAuth, requireFeature, requireRole } from '../middleware/authMiddleware';
import { WaGatewayId, WhatsappAlertService } from '../services/whatsappAlertService';
import { isDeveloperRole } from '../utils/permissions';
import { getErrorMessage } from '../utils/errorUtils';

const router = Router();

// GET /api/whatsapp/config (Gateway credentials & URLs hanya ditampilkan ke Developer)
router.get('/config', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isDev = isDeveloperRole(req.user?.role);
    const config = await WhatsappAlertService.getConfig({ isDeveloper: isDev });

    res.json({
      success: true,
      config
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// POST /api/whatsapp/config (Penerima & ambang: feature 'wa_alert_recipients'; Gateway 1/2: HANYA Developer)
router.post('/config', requireAuth, requireFeature('wa_alert_recipients'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isDev = isDeveloperRole(req.user!.role);

    const isAttemptingGatewayEdit =
      req.body.gateways !== undefined ||
      req.body.gatewayMode !== undefined ||
      (req.body.apiToken !== undefined && String(req.body.apiToken).trim() !== '') ||
      (req.body.apiUrl !== undefined && String(req.body.apiUrl).trim() !== '');

    if (isAttemptingGatewayEdit && !isDev) {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Pengaturan Gateway WhatsApp (URL, Token API, Saklar Gateway 1 & 2) hanya dapat diakses oleh role Developer.'
      });
    }

    const payload = { ...req.body };
    if (!isDev) {
      delete payload.apiToken;
      delete payload.apiUrl;
      delete payload.gateways;
      delete payload.gatewayMode;
    }

    const operator = { id: req.user!.id, name: req.user!.name };
    const updated = await WhatsappAlertService.updateConfig(payload, operator, {
      allowGatewayEdit: isDev
    });

    res.json({
      success: true,
      message: 'Konfigurasi WhatsApp Alert berhasil diperbarui!',
      config: updated
    });
  } catch (err: unknown) {
    res.status(400).json({
      success: false,
      message: getErrorMessage(err, 'Gagal memperbarui konfigurasi WhatsApp.')
    });
  }
});

// GET /api/whatsapp/thresholds (Lihat Ambang Berjenjang & Sumber)
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

// POST /api/whatsapp/thresholds (Ubah Ambang / Daftar Pantauan)
router.post('/thresholds', requireAuth, requireFeature('wa_alert_recipients'), async (req: AuthenticatedRequest, res: Response) => {
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

// POST /api/whatsapp/evaluate (Evaluasi Stok & Antrean Ringkasan)
router.post('/evaluate', requireAuth, requireFeature('wa_alert_recipients'), async (_req: AuthenticatedRequest, res: Response) => {
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

// POST /api/whatsapp/send (Kirim Alert Ringkasan)
router.post('/send', requireAuth, requireFeature('wa_alert_recipients'), async (req: AuthenticatedRequest, res: Response) => {
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

// POST /api/whatsapp/test (Kirim Pesan Uji via Gateway aktif, kena jeda cooldown)
router.post('/test', requireAuth, requireFeature('wa_alert_recipients'), async (req: AuthenticatedRequest, res: Response) => {
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

// POST /api/whatsapp/test-gateway (Khusus Developer - Uji Gateway 1 atau Gateway 2 secara terpisah)
router.post('/test-gateway', requireAuth, requireRole(['developer']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const gwId = req.body?.gatewayId === 'gateway2' ? 'gateway2' : req.body?.gatewayId === 'gateway1' ? 'gateway1' : null;
    if (!gwId) {
      return res.status(400).json({ success: false, message: 'gatewayId harus berupa "gateway1" atau "gateway2".' });
    }
    const operator = { id: req.user!.id, name: req.user!.name };
    const result = await WhatsappAlertService.sendTestGateway(gwId as WaGatewayId, req.body?.targetPhone, operator);
    res.json(result);
  } catch (err: unknown) {
    res.status(400).json({
      success: false,
      message: getErrorMessage(err, 'Gagal menguji gateway WhatsApp.')
    });
  }
});

// GET /api/whatsapp/logs (Riwayat Pengiriman WA Alert)
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
