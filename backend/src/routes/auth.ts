/**
 * Auth Router (Server-Authoritative Endpoints)
 * FieldOps IT Inventory Rebuild
 */

import express from 'express';
import { AuthService } from '../services/authService';
import { AuthenticatedRequest, requireAuth, requireRole, parseCookies } from '../middleware/authMiddleware';
import { SessionService } from '../services/sessionService';
import { ConfirmationService } from '../services/confirmationService';
import { SettingService } from '../services/settingService';
import { ActivityLogService } from '../services/activityLogService';
import { TrashService } from '../services/trashService';
import { executeQuery } from '../db/database';
import { createRateLimiter } from '../middleware/rateLimitMiddleware';

const router = express.Router();

// Rate limiter untuk proteksi DoS pada komputasi berat PBKDF2 (10 percobaan per 5 menit)
const loginRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 10,
  keyPrefix: 'auth_login',
  message: 'Terlalu banyak percobaan masuk dari IP ini. Demi keamanan sistem inventaris, silakan tunggu 5 menit sebelum mencoba kembali.'
});

const resetPasswordRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  keyPrefix: 'auth_reset_pwd',
  message: 'Terlalu banyak permintaan reset kata sandi. Silakan tunggu 15 menit.'
});

/**
 * POST /api/auth/login
 * Memverifikasi username dan password di backend, mengeluarkan cookie httpOnly v2 (access, refresh, device)
 */
router.post('/login', loginRateLimiter, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username dan kata sandi wajib diisi.'
      });
    }

    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown Client';

    const result = await AuthService.login(String(username).trim(), String(password), clientIp, userAgent);

    if (!result.success || !result.user) {
      return res.status(401).json({
        success: false,
        message: result.message
      });
    }

    const cookies = parseCookies(req.headers.cookie);
    const clientDeviceId = cookies['fieldops_device'] || req.body.deviceId;

    // Buat Sesi Server v2 dengan Token Berumur Pendek, Rotasi Refresh Token, & Device ID
    const sessionRes = await SessionService.createSession(
      result.user,
      clientIp,
      userAgent,
      clientDeviceId
    );

    const isProduction = process.env.NODE_ENV === 'production';
    const secureFlag = isProduction ? '; Secure' : '';

    // Pasang cookie HttpOnly terisolasi (30 Hari Persistent Session)
    res.setHeader('Set-Cookie', [
      `fieldops_access=${sessionRes.accessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionRes.expiresInSeconds}${secureFlag}`,
      `fieldops_refresh=${sessionRes.refreshToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secureFlag}`,
      `fieldops_device=${sessionRes.deviceId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${365 * 24 * 3600}${secureFlag}`,
      `fieldops_session=${sessionRes.accessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionRes.expiresInSeconds}${secureFlag}`
    ]);

    return res.json({
      success: true,
      message: 'Login berhasil.',
      user: result.user,
      token: sessionRes.accessToken,
      refreshToken: sessionRes.refreshToken,
      deviceId: sessionRes.deviceId,
      expiresInSeconds: sessionRes.expiresInSeconds
    });
  } catch (err: any) {
    console.error('[Auth Login Error]:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem saat proses autentikasi.' });
  }
});

/**
 * POST /api/auth/register
 * Pendaftaran akun pengguna internal kantor (langsung aktif dan login otomatis)
 */
/**
 * POST /api/auth/register
 * Pendaftaran akun pengguna internal kantor (Role di bawah admin/developer, memerlukan persetujuan)
 */
router.post('/register', async (req: express.Request, res: express.Response) => {
  try {
    const { username, name, email, role, department, phone, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username dan kata sandi wajib diisi.'
      });
    }

    const cleanUsername = String(username).trim();
    const cleanPassword = String(password).trim();
    const cleanName = name ? String(name).trim() : cleanUsername;
    const cleanEmail = email ? String(email).trim() : `${cleanUsername.toLowerCase()}@fieldops.local`;

    const requestedRole = String(role || '').toLowerCase();

    // Invarian: Akun Admin dan Developer HANYA bisa dibuat di sisi server
    if (['admin', 'developer', 'superadmin'].includes(requestedRole)) {
      return res.status(403).json({
        success: false,
        message: 'Akun Admin dan Developer hanya dapat dibuat di sisi server melalui terminal/setup (npm run setup:admin).'
      });
    }

    // Role yang diizinkan untuk registrasi mandiri adalah role di bawah admin & developer
    const validRole = ['warehouse_admin', 'technician'].includes(requestedRole) ? requestedRole : 'technician';

    const existing = await executeQuery<any>(
      'SELECT id FROM users WHERE LOWER(TRIM(username)) = LOWER(?) OR LOWER(TRIM(email)) = LOWER(?)',
      [cleanUsername, cleanEmail]
    );

    if (existing && existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Username "${cleanUsername}" atau email sudah terdaftar.`
      });
    }

    const userId = `usr-${Date.now()}`;
    const { hash, salt } = AuthService.hashPassword(cleanPassword);

    // Akun baru berstatus PENDING_APPROVAL dan memerlukan persetujuan Admin
    await executeQuery(
      `INSERT INTO users (id, username, name, email, role, department, phone, password_hash, salt, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, cleanUsername, cleanName, cleanEmail, validRole, department || 'IT Operations', phone || '', hash, salt, 'PENDING_APPROVAL']
    );

    // Hapus cookie sesi yang mungkin tersisa agar akun pending tidak auto-login
    res.setHeader('Set-Cookie', 'fieldops_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');

    return res.json({
      success: true,
      requiresApproval: true,
      status: 'PENDING_APPROVAL',
      message: `Pendaftaran berhasil! Akun "${cleanUsername}" sedang menunggu persetujuan dari Admin sebelum dapat masuk.`,
      user: { id: userId, username: cleanUsername, name: cleanName, role: validRole, status: 'PENDING_APPROVAL' }
    });
  } catch (err: any) {
    console.error('[Register User Error]:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengajukan pendaftaran akun pengguna baru.' });
  }
});

/**
 * GET /api/auth/me
 * Mengambil profil pengguna aktif dari sesi terverifikasi server
 */
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: express.Response) => {
  return res.json({
    success: true,
    user: req.user
  });
});

/**
 * POST /api/auth/refresh
 * Merotasi refresh token untuk memperpanjang access token (Anti-Replay)
 */
router.post('/refresh', async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const refreshToken = cookies['fieldops_refresh'] || req.body.refreshToken;
    const deviceId = cookies['fieldops_device'] || req.body.deviceId;
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown Client';

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token tidak ditemukan.' });
    }

    const result = await SessionService.rotateRefreshToken(refreshToken, deviceId, clientIp, userAgent);

    if (!result.success || !result.accessToken || !result.newRefreshToken) {
      res.setHeader('Set-Cookie', [
        'fieldops_access=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax',
        'fieldops_refresh=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax',
        'fieldops_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax'
      ]);
      return res.status(401).json({ success: false, message: result.message });
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const secureFlag = isProduction ? '; Secure' : '';

    res.setHeader('Set-Cookie', [
      `fieldops_access=${result.accessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secureFlag}`,
      `fieldops_refresh=${result.newRefreshToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secureFlag}`,
      `fieldops_session=${result.accessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secureFlag}`
    ]);

    return res.json({
      success: true,
      message: 'Token berhasil dirotasi.',
      token: result.accessToken,
      refreshToken: result.newRefreshToken,
      user: result.user
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/auth/logout
 * Menghapus sesi dari database dan mereset seluruh cookie
 */
router.post('/logout', async (req: AuthenticatedRequest, res: express.Response) => {
  if (req.sessionId) {
    await SessionService.revokeSession(req.sessionId, req.user?.id);
    await AuthService.logout(req.sessionId);
  }

  res.setHeader('Set-Cookie', [
    'fieldops_access=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax',
    'fieldops_refresh=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax',
    'fieldops_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax'
  ]);

  return res.json({
    success: true,
    message: 'Logout berhasil. Sesi telah dimusnahkan.'
  });
});

/**
 * GET /api/auth/users
 * Mendapatkan daftar seluruh pengguna (Akses: Developer & Admin)
 */
router.get('/users', requireAuth, requireRole(['developer', 'admin']), async (_req, res) => {
  try {
    const users = await executeQuery<any>(
      'SELECT id, username, name, email, role, department, phone, status, created_at FROM users ORDER BY created_at DESC'
    );
    // Normalisasi role superadmin ke developer jika ada
    const normalized = (users || []).map((u: any) => ({
      ...u,
      role: u.role === 'superadmin' ? 'developer' : u.role
    }));
    return res.json({ success: true, users: normalized });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/auth/users/:id/approve
 * Menyetujui akun baru yang menunggu persetujuan (Akses: Developer & Admin)
 */
router.post('/users/:id/approve', requireAuth, requireRole(['developer', 'admin']), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const userId = req.params.id;
    const users = await executeQuery<any>('SELECT id, username, name, role, status FROM users WHERE id = ?', [userId]);
    const targetUser = users && users[0];

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    await executeQuery('UPDATE users SET status = ? WHERE id = ?', ['ACTIVE', userId]);

    return res.json({
      success: true,
      message: `Akun "${targetUser.username}" (${targetUser.name}) berhasil disetujui dan kini AKTIF.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/auth/users/:id/reject
 * Menolak pendaftaran akun (Akses: Developer & Admin)
 */
router.post('/users/:id/reject', requireAuth, requireRole(['developer', 'admin']), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const userId = req.params.id;
    const users = await executeQuery<any>('SELECT id, username, name FROM users WHERE id = ?', [userId]);
    const targetUser = users && users[0];

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    await executeQuery('UPDATE users SET status = ? WHERE id = ?', ['REJECTED', userId]);

    return res.json({
      success: true,
      message: `Pendaftaran akun "${targetUser.username}" telah ditolak.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/auth/users/:id/status
 * Memperbarui status akun (ACTIVE, SUSPENDED, PENDING_APPROVAL, REJECTED)
 */
router.post('/users/:id/status', requireAuth, requireRole(['developer', 'admin']), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const userId = req.params.id;
    const { status } = req.body;

    if (!['ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status tidak valid.' });
    }

    if (req.user?.id === userId && status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Dilarang menonaktifkan status akun Anda sendiri.' });
    }

    await executeQuery('UPDATE users SET status = ? WHERE id = ?', [status, userId]);

    return res.json({
      success: true,
      message: `Status pengguna berhasil diperbarui menjadi ${status}.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/auth/users/:id
 * Menghapus akun pengguna (Akses: Developer & Admin)
 */
router.delete('/users/:id', requireAuth, requireRole(['developer', 'admin']), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const userId = req.params.id;

    if (req.user?.id === userId) {
      return res.status(400).json({ success: false, message: 'Dilarang menghapus akun Anda sendiri saat sedang login.' });
    }

    const users = await executeQuery<any>('SELECT id, username, role FROM users WHERE id = ?', [userId]);
    const target = users && users[0];
    if (!target) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    // Admin tidak boleh menghapus akun Developer
    if (target.role === 'developer' && req.user?.role !== 'developer') {
      return res.status(403).json({ success: false, message: 'Hanya peran Developer yang dapat mengelola akun Developer.' });
    }

    await executeQuery('DELETE FROM users WHERE id = ?', [userId]);

    return res.json({
      success: true,
      message: `Akun "${target.username}" berhasil dihapus secara permanen.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/auth/users
 * Membuat akun pengguna baru langsung dari dasbor internal (Akses: Developer & Admin)
 */
router.post('/users', requireAuth, requireRole(['developer', 'admin']), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { username, name, email, role, department, phone, password, status } = req.body;

    if (!username || !name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, nama, email, dan kata sandi wajib diisi.'
      });
    }

    const cleanUsername = String(username).trim();
    const cleanEmail = String(email).trim();
    let targetRole = role || 'technician';

    // Pembatasan: Hanya Developer yang bisa membuat akun Developer lain dari UI
    if (targetRole === 'developer' && req.user?.role !== 'developer') {
      return res.status(403).json({
        success: false,
        message: 'Hanya Developer yang dapat membuat akun dengan peran Developer.'
      });
    }

    const validRoles = ['technician', 'warehouse_admin', 'admin', 'developer'];
    if (!validRoles.includes(targetRole)) {
      targetRole = 'technician';
    }

    const existing = await executeQuery<any>('SELECT id FROM users WHERE username = ? OR email = ?', [cleanUsername, cleanEmail]);
    if (existing && existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Username "${cleanUsername}" atau email "${cleanEmail}" sudah digunakan.`
      });
    }

    const userId = `usr-${Date.now()}`;
    const { hash, salt } = AuthService.hashPassword(password);
    const initialStatus = status || 'ACTIVE';

    await executeQuery(
      `INSERT INTO users (id, username, name, email, role, department, phone, password_hash, salt, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, cleanUsername, name.trim(), cleanEmail, targetRole, department || 'IT Operations', phone || '', hash, salt, initialStatus]
    );

    return res.json({
      success: true,
      message: `Akun "${cleanUsername}" (${targetRole}) berhasil dibuat.`,
      user: { id: userId, username: cleanUsername, name: name.trim(), email: cleanEmail, role: targetRole, department, phone, status: initialStatus }
    });
  } catch (err: any) {
    console.error('[Create User Error]:', err);
    return res.status(500).json({ success: false, message: 'Gagal membuat akun pengguna.' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset kata sandi pengguna secara mandiri (Lupa Kata Sandi)
 */
router.post('/reset-password', resetPasswordRateLimiter, async (req: express.Request, res: express.Response) => {
  try {
    const { username, email, newPassword } = req.body;

    if (!username || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Username dan kata sandi baru wajib diisi.'
      });
    }

    const cleanUsername = String(username).trim();
    const cleanEmail = email ? String(email).trim() : '';

    // Cari user berdasarkan username
    let users = await executeQuery<any>('SELECT * FROM users WHERE LOWER(TRIM(username)) = LOWER(?)', [cleanUsername]);
    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Username "${cleanUsername}" tidak ditemukan di database sistem.`
      });
    }

    const targetUser = users[0];

    // Jika email diisi, pastikan cocok
    if (cleanEmail && targetUser.email.toLowerCase().trim() !== cleanEmail.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Email yang dimasukkan tidak cocok dengan email terdaftar pada akun ini.'
      });
    }

    if (targetUser.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        message: 'Akun Anda sedang dinonaktifkan (SUSPENDED). Hubungi Admin.'
      });
    }

    const { hash, salt } = AuthService.hashPassword(String(newPassword).trim());

    await executeQuery(
      'UPDATE users SET password_hash = ?, salt = ? WHERE id = ?',
      [hash, salt, targetUser.id]
    );

    // Hapus sesi aktif pengguna agar wajib login ulang dengan password baru
    await executeQuery('DELETE FROM sessions WHERE user_id = ?', [targetUser.id]);

    return res.json({
      success: true,
      message: `Kata sandi akun "@${targetUser.username}" berhasil diperbarui! Silakan masuk menggunakan kata sandi baru Anda.`
    });
  } catch (err: any) {
    console.error('[Reset Password Error]:', err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui kata sandi akun.' });
  }
});

/**
 * POST /api/auth/users/:id/reset-password
 * Reset kata sandi pengguna oleh Admin atau Developer dari Panel Manajemen Akun
 */
router.post('/users/:id/reset-password', requireAuth, requireRole(['developer', 'admin']), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const userId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Kata sandi baru wajib diisi.' });
    }

    const users = await executeQuery<any>('SELECT id, username, name, role FROM users WHERE id = ?', [userId]);
    const target = users && users[0];

    if (!target) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    // Admin biasa tidak boleh mereset password akun Developer
    if (target.role === 'developer' && req.user?.role !== 'developer') {
      return res.status(403).json({ success: false, message: 'Hanya peran Developer yang dapat mereset kata sandi akun Developer.' });
    }

    const { hash, salt } = AuthService.hashPassword(String(newPassword).trim());

    await executeQuery('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?', [hash, salt, userId]);

    // Hapus sesi aktif pengguna agar wajib login ulang
    await executeQuery('DELETE FROM sessions WHERE user_id = ?', [userId]);
    await SessionService.revokeAllUserSessions(String(userId), req.user?.id || 'admin');

    return res.json({
      success: true,
      message: `Kata sandi akun "${target.username}" (${target.name}) berhasil direset!`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/auth/confirm-token
 * Menerbitkan token konfirmasi bertingkat sekali pakai (Tier 2 & 3 Server Enforcement)
 */
router.post('/confirm-token', requireAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { actionType, targetId, targetName, objectNameTyped, reauthPassword, lastLoginTime } = req.body;

    if (!actionType || !targetId) {
      return res.status(400).json({ success: false, message: 'actionType dan targetId wajib disertakan.' });
    }

    const result = await ConfirmationService.requestConfirmationToken({
      userId: req.user!.id,
      actionType,
      targetId,
      targetName,
      objectNameTyped,
      reauthPassword,
      lastLoginTime
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/auth/users/:id/revoke-sessions
 * Memaksa cabut seluruh sesi akun pengguna lain (Akses: Developer & Admin)
 */
router.post('/users/:id/revoke-sessions', requireAuth, requireRole(['developer', 'admin']), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const targetUserId = String(req.params.id);
    const revokedCount = await SessionService.revokeAllUserSessions(targetUserId, req.user!.id);
    return res.json({
      success: true,
      message: `Berhasil mencabut ${revokedCount} sesi aktif untuk pengguna tersebut.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/auth/settings
 * Mengambil parameter konfigurasi sistem (pengaturan)
 */
router.get('/settings', requireAuth, requireRole(['developer', 'admin']), async (_req, res) => {
  try {
    const settings = await SettingService.getAll();
    return res.json({ success: true, settings });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/auth/settings/:key
 * Memperbarui nilai parameter konfigurasi sistem
 */
router.put('/settings/:key', requireAuth, requireRole(['developer', 'admin']), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const key = String(req.params.key);
    const { value, keterangan } = req.body;

    if (value === undefined || value === null) {
      return res.status(400).json({ success: false, message: 'Nilai pengaturan wajib disertakan.' });
    }

    await SettingService.set(key, String(value), keterangan);
    await ActivityLogService.recordActivity({
      aksi: 'ubah_pengaturan',
      pelaku_id: req.user!.id,
      catatan: `Pengaturan "${key}" diperbarui menjadi "${value}"`
    });

    return res.json({ success: true, message: `Pengaturan "${key}" berhasil diperbarui.` });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/auth/activity-logs
 * Mengambil log transaksi & mutasi dengan ID Aktivitas (AKT-YYYYMMDD-NNNN)
 */
router.get('/activity-logs', requireAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { action, actorId, dateFrom, dateTo, limit, offset } = req.query;

    const logs = await ActivityLogService.getLogs({
      action: action as string,
      actorId: actorId as string,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0
    });

    return res.json({ success: true, logs });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/auth/activity-logs/:id/details
 * Mengambil detail item dalam transaksi log
 */
router.get('/activity-logs/:id/details', requireAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const id = String(req.params.id);
    const details = await ActivityLogService.getActivityDetails(id);
    return res.json({ success: true, details });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/auth/trash
 * Mengambil daftar data di tempat sampah (retensi 14 hari)
 */
router.get('/trash', requireAuth, requireRole(['developer', 'admin']), async (_req, res) => {
  try {
    const list = await TrashService.listTrash();
    return res.json({ success: true, trash: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/auth/trash/purge
 * Menjalankan pembersihan sampah yang telah melewati masa retensi 14 hari
 */
router.post('/trash/purge', requireAuth, requireRole(['developer', 'admin']), async (_req, res) => {
  try {
    const result = await TrashService.purgeExpiredTrash();
    return res.json({ success: true, purgedCount: result.purgedCount });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
