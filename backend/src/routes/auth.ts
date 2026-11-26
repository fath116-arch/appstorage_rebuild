/**
 * Auth Router (Server-Authoritative Endpoints)
 * FieldOps IT Inventory Rebuild
 */

import express from 'express';
import { AuthService, normalizeUserRole, sanitizeClientIp } from '../services/authService';
import { AuthenticatedRequest, requireAuth, requireFeature, requireRole, parseCookies } from '../middleware/authMiddleware';
import { SessionService } from '../services/sessionService';
import { ConfirmationService } from '../services/confirmationService';
import { SettingService } from '../services/settingService';
import { ActivityLogService, UserActivityCategory } from '../services/activityLogService';
import { TrashService } from '../services/trashService';
import { executeQuery } from '../db/database';
import { createRateLimiter } from '../middleware/rateLimitMiddleware';
import { getErrorMessage } from '../utils/errorUtils';
import {
  FEATURE_CATALOG,
  FeaturePermissionsMap,
  isDeveloperRole,
  normalizeRole,
  parseFeaturePermissions
} from '../utils/permissions';

interface AuthUserRow {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  department: string;
  phone?: string | null;
  status: string;
  feature_permissions?: string | FeaturePermissionsMap | null;
  created_at?: string;
}

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

function isHttpsRequest(req: express.Request): boolean {
  if (req.secure) return true;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return forwardedProto === 'https';
}

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

    const clientIp = sanitizeClientIp((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1');
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

    const secureFlag = isHttpsRequest(req) ? '; Secure' : '';

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
  } catch (err: unknown) {
    console.error('[Auth Login Error]:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem saat proses autentikasi.' });
  }
});

/**
 * POST /api/auth/register
 * Pendaftaran mandiri dari halaman login dinonaktifkan (v1.2.8).
 * Akun baru hanya dapat dibuat dari dalam sistem oleh Developer/Admin atau via terminal server (npm run setup:admin).
 */
router.post('/register', async (_req: express.Request, res: express.Response) => {
  return res.status(403).json({
    success: false,
    message: 'Pendaftaran akun mandiri dari halaman login telah ditutup. Akun hanya dapat dibuat dari dalam sistem oleh Developer/Admin atau melalui terminal server (npm run setup:admin).'
  });
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
    const clientIp = sanitizeClientIp((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1');
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

    const secureFlag = isHttpsRequest(req) ? '; Secure' : '';

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
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: getErrorMessage(err) });
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
 * GET /api/auth/actors
 * Daftar pengguna aktif untuk pilihan "Atas Nama" pada pencatatan mutasi (Developer & Admin)
 */
router.get('/actors', requireAuth, requireRole(['developer', 'admin']), async (_req, res) => {
  try {
    const users = await executeQuery<Pick<AuthUserRow, 'id' | 'username' | 'name' | 'role' | 'department' | 'status'>>(
      'SELECT id, username, name, role, department, status FROM users ORDER BY name ASC'
    );
    const active = (users || [])
      .filter(u => u.status === 'ACTIVE')
      .map(u => ({
        ...u,
        role: normalizeUserRole(u.role)
      }));
    return res.json({ success: true, actors: active });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

/**
 * GET /api/auth/users
 * Mendapatkan daftar seluruh pengguna (Akses: Developer & pengguna dengan izin users_manage)
 */
router.get('/users', requireAuth, requireFeature('users_manage'), async (_req, res) => {
  try {
    const users = await executeQuery<AuthUserRow>(
      'SELECT id, username, name, email, role, department, phone, status, feature_permissions, created_at FROM users ORDER BY created_at DESC'
    );
    const normalized = (users || []).map((u) => ({
      ...u,
      role: normalizeUserRole(u.role),
      feature_permissions: parseFeaturePermissions(u.feature_permissions)
    }));
    return res.json({ success: true, users: normalized });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

/**
 * POST /api/auth/users/:id/approve
 * Menyetujui akun baru (Admin terbatas hanya untuk akun role admin & technician)
 */
router.post('/users/:id/approve', requireAuth, requireFeature('users_manage'), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const userId = String(req.params.id);
    const users = await executeQuery<Pick<AuthUserRow, 'id' | 'username' | 'name' | 'role' | 'status'>>(
      'SELECT id, username, name, role, status FROM users WHERE id = ?',
      [userId]
    );
    const targetUser = users && users[0];

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    const targetRole = normalizeUserRole(targetUser.role);
    if (isDeveloperRole(targetRole) && !isDeveloperRole(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Admin hanya dapat menyetujui akun Admin dan Teknisi.'
      });
    }

    const requestedRoleRaw = req.body?.role ? String(req.body.role).trim().toLowerCase() : null;
    let finalRole = targetRole;
    if (requestedRoleRaw) {
      if ((requestedRoleRaw === 'developer' || requestedRoleRaw === 'superadmin') && !isDeveloperRole(req.user?.role)) {
        return res.status(403).json({
          success: false,
          message: 'Akses Ditolak: Admin tidak dapat menaikkan peran akun menjadi Developer.'
        });
      }
      const nextRole = normalizeRole(requestedRoleRaw);
      finalRole = nextRole;
      await executeQuery('UPDATE users SET status = ?, role = ? WHERE id = ?', ['ACTIVE', nextRole, userId]);
    } else {
      await executeQuery('UPDATE users SET status = ? WHERE id = ?', ['ACTIVE', userId]);
    }

    try {
      await ActivityLogService.recordActivity({
        aksi: 'setujui_akun',
        pelaku_id: req.user!.id,
        catatan: `Menyetujui akun "@${targetUser.username}" (${targetUser.name}) menjadi AKTIF dengan peran ${finalRole}`
      });
    } catch {
      // Non-blocking audit log
    }

    return res.json({
      success: true,
      message: `Akun "${targetUser.username}" (${targetUser.name}) berhasil disetujui dan kini AKTIF.`
    });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

/**
 * POST /api/auth/users/:id/reject
 * Menolak pendaftaran akun (Admin terbatas hanya untuk role admin & technician)
 */
router.post('/users/:id/reject', requireAuth, requireFeature('users_manage'), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const userId = String(req.params.id);
    const users = await executeQuery<Pick<AuthUserRow, 'id' | 'username' | 'name' | 'role'>>(
      'SELECT id, username, name, role FROM users WHERE id = ?',
      [userId]
    );
    const targetUser = users && users[0];

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    if (isDeveloperRole(targetUser.role) && !isDeveloperRole(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Hanya peran Developer yang dapat mengelola akun Developer.'
      });
    }

    await executeQuery('UPDATE users SET status = ? WHERE id = ?', ['REJECTED', userId]);

    try {
      await ActivityLogService.recordActivity({
        aksi: 'tolak_akun',
        pelaku_id: req.user!.id,
        catatan: `Menolak pendaftaran akun "@${targetUser.username}" (${targetUser.name})`
      });
    } catch {
      // Non-blocking audit log
    }

    return res.json({
      success: true,
      message: `Pendaftaran akun "${targetUser.username}" telah ditolak.`
    });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

/**
 * POST /api/auth/users/:id/status
 * Memperbarui status akun (ACTIVE, SUSPENDED, PENDING_APPROVAL, REJECTED)
 */
router.post('/users/:id/status', requireAuth, requireFeature('users_manage'), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const userId = String(req.params.id);
    const { status } = req.body;

    if (!['ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status tidak valid.' });
    }

    if (req.user?.id === userId && status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Dilarang menonaktifkan status akun Anda sendiri.' });
    }

    const users = await executeQuery<Pick<AuthUserRow, 'id' | 'username' | 'role'>>(
      'SELECT id, username, role FROM users WHERE id = ?',
      [userId]
    );
    const target = users && users[0];
    if (!target) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    if (isDeveloperRole(target.role) && !isDeveloperRole(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Hanya peran Developer yang dapat mengubah status akun Developer.'
      });
    }

    await executeQuery('UPDATE users SET status = ? WHERE id = ?', [status, userId]);

    try {
      await ActivityLogService.recordActivity({
        aksi: 'ubah_status_akun',
        pelaku_id: req.user!.id,
        catatan: `Mengubah status akun "@${target.username}" menjadi ${status}`
      });
    } catch {
      // Non-blocking audit log
    }

    return res.json({
      success: true,
      message: `Status pengguna berhasil diperbarui menjadi ${status}.`
    });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

/**
 * PUT /api/auth/users/:id/features
 * Mengatur akses fitur per akun menggunakan saklar ON/OFF (KHUSUS PERAN DEVELOPER!)
 */
router.put('/users/:id/features', requireAuth, requireRole(['developer']), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    if (!isDeveloperRole(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Fitur pengaturan akses per akun hanya dapat diakses oleh peran Developer.'
      });
    }

    const userId = String(req.params.id);
    const { featurePermissions, feature_permissions, resetToDefault } = req.body || {};
    const requestedMap = featurePermissions ?? feature_permissions;
    const isReset = Boolean(resetToDefault) || requestedMap === null;

    const users = await executeQuery<Pick<AuthUserRow, 'id' | 'username' | 'name' | 'role'>>(
      'SELECT id, username, name, role FROM users WHERE id = ?',
      [userId]
    );
    const target = users && users[0];
    if (!target) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    if (isDeveloperRole(target.role)) {
      return res.status(400).json({
        success: false,
        message: 'Akun dengan peran Developer selalu memiliki akses penuh sistem dan tidak dibatasi per fitur.'
      });
    }

    let nextMap: FeaturePermissionsMap = {};
    if (!isReset && requestedMap && typeof requestedMap === 'object') {
      for (const def of FEATURE_CATALOG) {
        if (typeof (requestedMap as Record<string, unknown>)[def.key] === 'boolean') {
          nextMap[def.key] = Boolean((requestedMap as Record<string, boolean>)[def.key]);
        }
      }
    }

    const serialized = Object.keys(nextMap).length > 0 ? JSON.stringify(nextMap) : null;
    await executeQuery('UPDATE users SET feature_permissions = ? WHERE id = ?', [serialized, userId]);

    await ActivityLogService.recordActivity({
      aksi: 'ubah_akses_fitur',
      pelaku_id: req.user!.id,
      catatan: isReset
        ? `Reset akses fitur akun "@${target.username}" ke bawaan peran (${normalizeUserRole(target.role)})`
        : `Memperbarui saklar akses fitur akun "@${target.username}" (${Object.keys(nextMap).length} penyesuaian)`
    });

    return res.json({
      success: true,
      message: isReset
        ? `Akses fitur akun "@${target.username}" berhasil direset ke bawaan peran.`
        : `Akses fitur akun "@${target.username}" berhasil disimpan.`,
      feature_permissions: nextMap
    });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

/**
 * DELETE /api/auth/users/:id
 * Menghapus akun pengguna (Developer: semua non-self; Admin: hanya admin & technician)
 */
router.delete('/users/:id', requireAuth, requireFeature('users_manage'), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const userId = String(req.params.id);

    if (req.user?.id === userId) {
      return res.status(400).json({ success: false, message: 'Dilarang menghapus akun Anda sendiri saat sedang login.' });
    }

    const users = await executeQuery<Pick<AuthUserRow, 'id' | 'username' | 'role'>>(
      'SELECT id, username, role FROM users WHERE id = ?',
      [userId]
    );
    const target = users && users[0];
    if (!target) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    if (isDeveloperRole(target.role) && !isDeveloperRole(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Hanya peran Developer yang dapat mengelola akun Developer.' });
    }

    await executeQuery('DELETE FROM users WHERE id = ?', [userId]);

    try {
      await ActivityLogService.recordActivity({
        aksi: 'hapus_akun',
        pelaku_id: req.user!.id,
        catatan: `Menghapus permanen akun "@${target.username}" (peran: ${normalizeUserRole(target.role)})`
      });
    } catch {
      // Non-blocking audit log
    }

    return res.json({
      success: true,
      message: `Akun "${target.username}" berhasil dihapus secara permanen.`
    });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

/**
 * POST /api/auth/users
 * Membuat akun pengguna baru dari dalam sistem (Admin terbatas membuat role admin & technician)
 */
router.post('/users', requireAuth, requireFeature('users_manage'), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { username, name, email, role, department, phone, password, status, feature_permissions } = req.body;

    if (!username || !name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, nama, email, dan kata sandi wajib diisi.'
      });
    }

    const cleanUsername = String(username).trim();
    const cleanEmail = String(email).trim();
    const rawRequestedRole = String(role || 'technician').trim().toLowerCase();

    if ((rawRequestedRole === 'developer' || rawRequestedRole === 'superadmin') && !isDeveloperRole(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Admin hanya dapat membuat akun dengan peran Admin atau Teknisi.'
      });
    }

    const targetRole = normalizeRole(rawRequestedRole);

    const existing = await executeQuery<{ id: string }>('SELECT id FROM users WHERE username = ? OR email = ?', [cleanUsername, cleanEmail]);
    if (existing && existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Username "${cleanUsername}" atau email "${cleanEmail}" sudah digunakan.`
      });
    }

    const userId = `usr-${Date.now()}`;
    const { hash, salt } = AuthService.hashPassword(password);
    const initialStatus = ['ACTIVE', 'PENDING_APPROVAL'].includes(status) ? status : 'ACTIVE';
    const parsedFeatures = isDeveloperRole(req.user?.role) && targetRole !== 'developer'
      ? parseFeaturePermissions(feature_permissions)
      : {};

    await executeQuery(
      `INSERT INTO users (id, username, name, email, role, department, phone, password_hash, salt, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, cleanUsername, name.trim(), cleanEmail, targetRole, department || 'IT Operations', phone || '', hash, salt, initialStatus]
    );

    if (Object.keys(parsedFeatures).length > 0) {
      await executeQuery('UPDATE users SET feature_permissions = ? WHERE id = ?', [JSON.stringify(parsedFeatures), userId]);
    }

    try {
      await ActivityLogService.recordActivity({
        aksi: 'buat_akun',
        pelaku_id: req.user!.id,
        catatan: `Membuat akun baru "@${cleanUsername}" (${name.trim()}) dengan peran ${targetRole} dan status ${initialStatus}`
      });
    } catch {
      // Non-blocking audit log
    }

    return res.json({
      success: true,
      message: `Akun "${cleanUsername}" (${targetRole}) berhasil dibuat.`,
      user: {
        id: userId,
        username: cleanUsername,
        name: name.trim(),
        email: cleanEmail,
        role: targetRole,
        department,
        phone,
        status: initialStatus,
        feature_permissions: parsedFeatures
      }
    });
  } catch (err: unknown) {
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
    const users = await executeQuery<Pick<AuthUserRow, 'id' | 'username' | 'email' | 'status'>>(
      'SELECT * FROM users WHERE LOWER(TRIM(username)) = LOWER(?)',
      [cleanUsername]
    );
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

    try {
      await ActivityLogService.recordActivity({
        aksi: 'reset_sandi',
        pelaku_id: targetUser.id,
        catatan: `Kata sandi akun "@${targetUser.username}" direset`
      });
    } catch {
      // Non-blocking audit log
    }

    return res.json({
      success: true,
      message: `Kata sandi akun "@${targetUser.username}" berhasil diperbarui! Silakan masuk menggunakan kata sandi baru Anda.`
    });
  } catch (err: unknown) {
    console.error('[Reset Password Error]:', err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui kata sandi akun.' });
  }
});

/**
 * POST /api/auth/users/:id/reset-password
 * Reset kata sandi pengguna oleh Admin atau Developer dari Panel Manajemen Akun
 */
router.post('/users/:id/reset-password', requireAuth, requireFeature('users_manage'), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const userId = String(req.params.id);
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Kata sandi baru wajib diisi.' });
    }

    const users = await executeQuery<Pick<AuthUserRow, 'id' | 'username' | 'name' | 'role'>>(
      'SELECT id, username, name, role FROM users WHERE id = ?',
      [userId]
    );
    const target = users && users[0];

    if (!target) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    // Admin tidak boleh mereset password akun Developer
    if (isDeveloperRole(target.role) && !isDeveloperRole(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Hanya peran Developer yang dapat mereset kata sandi akun Developer.' });
    }

    const { hash, salt } = AuthService.hashPassword(String(newPassword).trim());

    await executeQuery('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?', [hash, salt, userId]);

    // Hapus sesi aktif pengguna agar wajib login ulang
    await executeQuery('DELETE FROM sessions WHERE user_id = ?', [userId]);
    await SessionService.revokeAllUserSessions(String(userId), req.user?.id || 'admin');

    try {
      await ActivityLogService.recordActivity({
        aksi: 'reset_sandi',
        pelaku_id: req.user!.id,
        catatan: `Mereset kata sandi akun "@${target.username}" (${target.name}) melalui panel Kelola User`
      });
    } catch {
      // Non-blocking audit log
    }

    return res.json({
      success: true,
      message: `Kata sandi akun "${target.username}" (${target.name}) berhasil direset!`
    });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: getErrorMessage(err) });
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
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

/**
 * POST /api/auth/users/:id/revoke-sessions
 * Memaksa cabut seluruh sesi akun pengguna lain (Akses: Developer & Admin dengan users_manage)
 */
router.post('/users/:id/revoke-sessions', requireAuth, requireFeature('users_manage'), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const targetUserId = String(req.params.id);
    const users = await executeQuery<Pick<AuthUserRow, 'id' | 'role'>>(
      'SELECT id, role FROM users WHERE id = ?',
      [targetUserId]
    );
    const target = users && users[0];
    if (target && isDeveloperRole(target.role) && !isDeveloperRole(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Hanya peran Developer yang dapat mencabut sesi akun Developer.' });
    }

    const revokedCount = await SessionService.revokeAllUserSessions(targetUserId, req.user!.id);
    return res.json({
      success: true,
      message: `Berhasil mencabut ${revokedCount} sesi aktif untuk pengguna tersebut.`
    });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

/**
 * GET /api/auth/settings
 * Mengambil parameter konfigurasi sistem (pengaturan) - Akses Developer / Audit Keamanan
 */
router.get('/settings', requireAuth, requireFeature('security_audit'), async (_req, res) => {
  try {
    const settings = await SettingService.getAll();
    return res.json({ success: true, settings });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

/**
 * PUT /api/auth/settings/:key
 * Memperbarui nilai parameter konfigurasi sistem
 */
router.put('/settings/:key', requireAuth, requireFeature('security_audit'), async (req: AuthenticatedRequest, res: express.Response) => {
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
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

/**
 * GET /api/auth/user-logs
 * Mengambil log aktivitas pengguna (login, logout, sesi, & manajemen akun)
 * Akses: Admin & Developer yang memiliki izin users_manage
 */
router.get('/user-logs', requireAuth, requireFeature('users_manage'), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const rawCat = String(req.query.category || 'all').toLowerCase();
    const category: 'all' | UserActivityCategory =
      rawCat === 'auth' || rawCat === 'session' || rawCat === 'account' ? rawCat : 'all';
    const actorId = req.query.actorId ? String(req.query.actorId) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const dateFrom = req.query.dateFrom ? String(req.query.dateFrom) : undefined;
    const dateTo = req.query.dateTo ? String(req.query.dateTo) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
    const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;

    const logs = await ActivityLogService.getUserActivityLogs({
      category,
      actorId,
      search,
      dateFrom,
      dateTo,
      limit,
      offset
    });

    return res.json({ success: true, logs });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: getErrorMessage(err) });
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
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: getErrorMessage(err) });
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
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

/**
 * GET /api/auth/trash
 * Mengambil daftar data di tempat sampah (retensi 14 hari)
 */
router.get('/trash', requireAuth, requireFeature('security_audit'), async (_req, res) => {
  try {
    const list = await TrashService.listTrash();
    return res.json({ success: true, trash: list });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

/**
 * POST /api/auth/trash/purge
 * Menjalankan pembersihan sampah yang telah melewati masa retensi 14 hari
 */
router.post('/trash/purge', requireAuth, requireFeature('security_audit'), async (_req, res) => {
  try {
    const result = await TrashService.purgeExpiredTrash();
    return res.json({ success: true, purgedCount: result.purgedCount });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

export default router;
