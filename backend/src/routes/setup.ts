/**
 * System Setup & Connection Diagnostics Router
 * FieldOps IT Inventory
 * Strictly restricted to 'developer' and 'admin' roles
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth, requireFeature, requireRole } from '../middleware/authMiddleware';
import { SystemSetupService } from '../services/systemSetupService';
import { getErrorMessage } from '../utils/errorUtils';

const router = Router();

// Seluruh endpoint /api/setup/* wajib terautentikasi
router.use(requireAuth);

/**
 * GET /api/setup/status
 * Membaca pengaturan .env tersamar, daftar command CLI setup, dan ringkasan diagnostik koneksi
 */
router.get('/status', requireFeature('setup_check'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = SystemSetupService.getMaskedSettings();
    const report = await SystemSetupService.runSystemCheck();
    const cliScripts = SystemSetupService.getCliScriptCatalog();

    res.json({
      success: true,
      settings,
      report,
      cliScripts
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      message: getErrorMessage(err, 'Gagal membaca status konfigurasi sistem.')
    });
  }
});

/**
 * POST /api/setup/check
 * Menjalankan pemeriksaan ulang menyeluruh atas DB, WA, Tunnel, .env, dan Akun Admin
 */
router.post('/check', requireFeature('setup_check'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicUrl = typeof req.body?.publicUrl === 'string' ? req.body.publicUrl.trim() : undefined;
    const report = await SystemSetupService.runSystemCheck({ publicUrl });
    const settings = SystemSetupService.getMaskedSettings();

    res.json({
      success: true,
      settings,
      report
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      message: getErrorMessage(err, 'Gagal menjalankan pemeriksaan koneksi sistem.')
    });
  }
});

/**
 * POST /api/setup/database
 * Menyimpan konfigurasi MariaDB ke .env lokal, menjalankan uji koneksi langsung, & memuat ulang pool
 */
router.post('/database', requireFeature('setup_database'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { host, port, name, user, password, rootPassword, reloadPool } = req.body || {};
    const result = await SystemSetupService.saveAndTestDatabase({
      host,
      port,
      name,
      user,
      password,
      rootPassword,
      reloadPool
    });

    const settings = SystemSetupService.getMaskedSettings();
    res.json({
      success: result.testResult.connected,
      message: result.testResult.connected
        ? `Konfigurasi tersimpan ke .env & berhasil terhubung ke MariaDB (${result.testResult.latencyMs} ms).`
        : `Konfigurasi tersimpan ke .env, namun koneksi ke MariaDB gagal: ${result.testResult.error || 'tidak terjangkau'}.`,
      result,
      settings
    });
  } catch (err: unknown) {
    res.status(400).json({
      success: false,
      message: getErrorMessage(err, 'Gagal menyimpan konfigurasi database.')
    });
  }
});

/**
 * POST /api/setup/tunnel
 * Menyimpan token & URL Cloudflare Tunnel ke .env lokal, memvalidasi format token, & menguji URL publik opsional
 */
router.post('/tunnel', requireFeature('setup_tunnel'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { token, publicUrl, clearToken, testPublicUrl } = req.body || {};
    const result = await SystemSetupService.saveAndTestTunnel({
      token,
      publicUrl,
      clearToken: Boolean(clearToken),
      testPublicUrl: Boolean(testPublicUrl)
    });

    const settings = SystemSetupService.getMaskedSettings();
    res.json({
      success: true,
      message: clearToken
        ? 'Token Cloudflare Tunnel dihapus dari .env.'
        : result.inspection.validFormat
        ? 'Konfigurasi Cloudflare Tunnel valid & tersimpan ke .env.'
        : result.inspection.reason,
      result,
      settings
    });
  } catch (err: unknown) {
    res.status(400).json({
      success: false,
      message: getErrorMessage(err, 'Gagal menyimpan konfigurasi Cloudflare Tunnel.')
    });
  }
});

/**
 * POST /api/setup/whatsapp
 * Khusus Developer: menyimpan konfigurasi gateway WA ke .env + tabel wa_config
 */
router.post('/whatsapp', requireRole(['developer']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { apiUrl, apiToken, targetPhones, isEnabled, cooldownMinutes, runTest } = req.body || {};
    const operator = { id: req.user!.id, name: req.user!.name };
    const result = await SystemSetupService.saveAndTestWhatsapp(
      {
        apiUrl,
        apiToken,
        targetPhones,
        isEnabled,
        cooldownMinutes,
        runTest: Boolean(runTest)
      },
      operator
    );

    const settings = SystemSetupService.getMaskedSettings();
    res.json({
      success: true,
      message: 'Pengaturan WhatsApp Gateway tersimpan ke .env dan database.',
      result,
      settings
    });
  } catch (err: unknown) {
    res.status(400).json({
      success: false,
      message: getErrorMessage(err, 'Gagal menyimpan konfigurasi WhatsApp.')
    });
  }
});

/**
 * POST /api/setup/test-login
 * Menguji diagnostik login bertahap (lookup user, status ACTIVE, verifikasi PBKDF2, probe tulis tabel sessions & sesi)
 */
router.post('/test-login', requireFeature('setup_check'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : undefined;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username wajib diisi untuk menjalankan diagnostik login.'
      });
    }

    const diagnostic = await SystemSetupService.runLoginDiagnostic({
      username,
      password,
      testSessionWrite: true
    });

    res.json({
      success: true,
      diagnostic
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      message: getErrorMessage(err, 'Gagal menjalankan diagnostik login akun.')
    });
  }
});

export default router;
