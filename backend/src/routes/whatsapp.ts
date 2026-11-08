/**
 * WhatsApp Gateway Express Router
 * FieldOps IT Inventory - Backend Route
 */

import { Router, Request, Response } from 'express';
import { FonnteProvider } from '../integrations/whatsapp/fonnte';
import { formatLowStockAlertMessage, formatTestConnectionMessage } from '../integrations/whatsapp/templates';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/authMiddleware';

const router = Router();

// In-memory or database-backed WhatsApp Gateway Configuration
let waConfig = {
  gatewayType: 'fonnte',
  apiUrl: process.env.WHATSAPP_API_URL || 'https://api.fonnte.com/send',
  apiToken: process.env.WHATSAPP_API_TOKEN || '',
  targetPhones: process.env.WHATSAPP_TARGET_PHONES || '081290008888',
  autoAlertEnabled: true,
};

interface WaLog {
  id: string;
  timestamp: string;
  target: string;
  messageSnippet: string;
  itemsCount: number;
  status: 'SUCCESS' | 'FAILED' | 'SIMULATED';
  details: string;
}

const waLogs: WaLog[] = [
  {
    id: `walog_init_${Date.now()}`,
    timestamp: new Date().toLocaleString('id-ID'),
    target: waConfig.targetPhones,
    messageSnippet: '⚠️ [ALERT STOK FIELD-OPS IT] Inisialisasi Consolidated WhatsApp Gateway Provider Active',
    itemsCount: 0,
    status: 'SIMULATED',
    details: 'Sistem notifikasi backend siap digunakan dengan provider Fonnte.'
  }
];

// GET /api/whatsapp/config (All roles allowed to view)
router.get('/config', requireAuth, (_req: Request, res: Response) => {
  res.json({
    success: true,
    config: {
      ...waConfig,
      maskedToken: waConfig.apiToken ? waConfig.apiToken.slice(0, 4) + '••••••••' : 'Belum diisi'
    }
  });
});

// POST /api/whatsapp/config (Ubah Pengaturan: developer, admin, warehouse_admin; technician 403)
router.post('/config', requireAuth, requireRole(['developer', 'admin', 'warehouse_admin']), (req: AuthenticatedRequest, res: Response) => {
  const { gatewayType, apiUrl, apiToken, targetPhones, autoAlertEnabled } = req.body;
  if (gatewayType) waConfig.gatewayType = gatewayType;
  if (apiUrl) waConfig.apiUrl = apiUrl;
  if (apiToken !== undefined) waConfig.apiToken = apiToken;
  if (targetPhones !== undefined) waConfig.targetPhones = targetPhones;
  if (autoAlertEnabled !== undefined) waConfig.autoAlertEnabled = autoAlertEnabled;

  res.json({
    success: true,
    message: 'Konfigurasi WhatsApp Gateway backend berhasil diperbarui!',
    config: {
      ...waConfig,
      maskedToken: waConfig.apiToken ? waConfig.apiToken.slice(0, 4) + '••••••••' : 'Belum diisi'
    }
  });
});

// POST /api/whatsapp/send (Kirim Alert: developer, admin, warehouse_admin; technician 403)
router.post('/send', requireAuth, requireRole(['developer', 'admin', 'warehouse_admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetPhone, items, customMessage, triggerSource } = req.body;
    const target = targetPhone || waConfig.targetPhones || '081290008888';

    let message = '';
    if (customMessage) {
      message = customMessage;
    } else if (items && Array.isArray(items) && items.length > 0) {
      message = formatLowStockAlertMessage(items, triggerSource);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Pesan tidak valid. Berikan daftar item stok atau customMessage.'
      });
    }

    const provider = new FonnteProvider(waConfig.apiUrl, waConfig.apiToken);
    const sendResult = await provider.sendMessage(target, message);

    const newLog: WaLog = {
      id: `walog_${Date.now()}`,
      timestamp: new Date().toLocaleString('id-ID'),
      target,
      messageSnippet: message.slice(0, 120) + (message.length > 120 ? '...' : ''),
      itemsCount: items && Array.isArray(items) ? items.length : 1,
      status: sendResult.success ? 'SUCCESS' : (waConfig.apiToken ? 'FAILED' : 'SIMULATED'),
      details: sendResult.details
    };
    waLogs.unshift(newLog);

    return res.json({
      success: true,
      message: sendResult.success 
        ? 'Notifikasi WhatsApp berhasil dikirim!' 
        : 'Sinyal notifikasi WhatsApp diproses oleh backend (periksa rincian gateway).',
      targetPhone: target,
      itemsCount: items && Array.isArray(items) ? items.length : 1,
      formattedMessage: message,
      gatewayDetails: sendResult.details,
      log: newLog
    });

  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'Gagal memproses pengiriman notifikasi WhatsApp',
      error: String(err)
    });
  }
});

// POST /api/whatsapp/test (Kirim Pesan Uji: developer, admin, warehouse_admin; technician 403)
router.post('/test', requireAuth, requireRole(['developer', 'admin', 'warehouse_admin']), async (req: AuthenticatedRequest, res: Response) => {
  const { targetPhone } = req.body;
  const target = targetPhone || waConfig.targetPhones || '081290008888';
  const testMsg = formatTestConnectionMessage(target);

  try {
    const provider = new FonnteProvider(waConfig.apiUrl, waConfig.apiToken);
    const sendResult = await provider.sendMessage(target, testMsg);

    const newLog: WaLog = {
      id: `walog_test_${Date.now()}`,
      timestamp: new Date().toLocaleString('id-ID'),
      target,
      messageSnippet: testMsg.slice(0, 100),
      itemsCount: 0,
      status: sendResult.success ? 'SUCCESS' : (waConfig.apiToken ? 'FAILED' : 'SIMULATED'),
      details: sendResult.details
    };
    waLogs.unshift(newLog);

    return res.json({
      success: true,
      message: 'Uji koneksi WhatsApp Gateway berhasil dikirim!',
      targetPhone: target,
      log: newLog,
      details: sendResult.details
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'Gagal melakukan tes koneksi WhatsApp Gateway',
      error: String(err)
    });
  }
});

// GET /api/whatsapp/logs (Riwayat WhatsApp Alert: Semua Role)
router.get('/logs', requireAuth, (_req: Request, res: Response) => {
  res.json({
    success: true,
    logs: waLogs
  });
});

export default router;
