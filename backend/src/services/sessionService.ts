/**
 * Server-Authoritative Session & Token Service
 * FieldOps Inventory v2 - Tahap 1: Fondasi (SECURITY_GUIDE.md Bagian 1)
 * Menegakkan tabel `sesi`, token access berumur pendek, rotasi refresh token,
 * batas sesi per akun (MAX_SESI_PER_AKUN), dan deteksi anomali token reuse.
 */

import crypto from 'crypto';
import { executeQuery, runTransaction } from '../db/database';
import { SettingService } from './settingService';
import { UserProfile } from './authService';
import { ActivityLogService } from './activityLogService';

export interface SessionRecord {
  id: string;
  user_id: string;
  refresh_hash: string;
  device_id_hash: string;
  user_agent: string;
  ip: string;
  dibuat_pada: string;
  aktivitas_terakhir: string;
  kedaluwarsa_mutlak: string;
  dicabut_pada: string | null;
}

interface SessionWithUserRow extends SessionRecord {
  username: string;
  name: string;
  email: string;
  role: UserProfile['role'];
  department: string;
  phone: string;
  status: string;
}

interface DbUpdateResult {
  affectedRows?: number;
}

export class SessionService {
  /**
   * Helper hash SHA-256 untuk token dan device ID
   */
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Membuat sesi server baru saat login berhasil
   */
  static async createSession(
    user: UserProfile,
    clientIp: string,
    userAgent: string,
    existingDeviceId?: string
  ): Promise<{
    sessionId: string;
    accessToken: string;
    refreshToken: string;
    deviceId: string;
    expiresInSeconds: number;
  }> {
    const maxSesi = await SettingService.getInt('MAX_SESI_PER_AKUN');
    const accessTtl = await SettingService.getInt('ACCESS_TOKEN_TTL_DETIK');
    const absoluteHours = await SettingService.getInt('ABSOLUTE_TIMEOUT_JAM');

    // 1. Cabut sesi lama jika melebihi kuota MAX_SESI_PER_AKUN (Default 1: Login baru mencabut sesi lama)
    const activeSessions = await executeQuery<SessionRecord>(
      `SELECT id FROM sesi WHERE user_id = ? AND dicabut_pada IS NULL ORDER BY dibuat_pada ASC`,
      [user.id]
    );

    if (activeSessions.length >= maxSesi) {
      const sessionsToRevoke = activeSessions.slice(0, activeSessions.length - maxSesi + 1);
      for (const s of sessionsToRevoke) {
        await executeQuery('UPDATE sesi SET dicabut_pada = NOW() WHERE id = ?', [s.id]);
        await ActivityLogService.recordActivity({
          aksi: 'cabut_sesi_otomatis',
          pelaku_id: user.id,
          catatan: `Sesi ${s.id} dicabut otomatis karena batas maksimal ${maxSesi} sesi per akun.`
        });
      }
    }

    // 2. Buat ID Sesi baru, Token Akses, Token Refresh, dan Device ID
    const sessionId = `ses-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const accessToken = `${sessionId}.${crypto.randomBytes(16).toString('hex')}`;
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const deviceId = existingDeviceId && existingDeviceId.length >= 16 ? existingDeviceId : crypto.randomBytes(16).toString('hex');

    const refreshHash = this.hashToken(refreshToken);
    const deviceHash = this.hashToken(deviceId);

    const kedaluwarsaMutlak = new Date(Date.now() + absoluteHours * 3600 * 1000);

    // 3. Simpan ke tabel sesi
    await executeQuery(
      `INSERT INTO sesi (id, user_id, refresh_hash, device_id_hash, user_agent, ip, dibuat_pada, aktivitas_terakhir, kedaluwarsa_mutlak)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)`,
      [sessionId, user.id, refreshHash, deviceHash, userAgent || 'Unknown', clientIp || '127.0.0.1', kedaluwarsaMutlak]
    );

    // 4. Catat aktivitas login
    await ActivityLogService.recordActivity({
      aksi: 'login',
      pelaku_id: user.id,
      catatan: `Login pengguna ${user.username} (Peran: ${user.role}) dari IP ${clientIp}`
    });

    return {
      sessionId,
      accessToken,
      refreshToken,
      deviceId,
      expiresInSeconds: accessTtl
    };
  }

  /**
   * Memvalidasi token sesi yang dibawa setiap request
   */
  static async validateSession(
    tokenOrSessionId: string,
    deviceId?: string
  ): Promise<{
    valid: boolean;
    user?: UserProfile;
    sessionId?: string;
    reason?: string;
  }> {
    if (!tokenOrSessionId || typeof tokenOrSessionId !== 'string') {
      return { valid: false, reason: 'Token tidak disertakan' };
    }

    // Format token: "sessionId.randomSecret" atau langsung "sessionId"
    const sessionId = tokenOrSessionId.split('.')[0].trim();

    const sessions = await executeQuery<SessionWithUserRow>(
      `SELECT s.*, u.username, u.name, u.email, u.role, u.department, u.phone, u.status
       FROM sesi s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ?`,
      [sessionId]
    );

    if (!sessions || sessions.length === 0) {
      return { valid: false, reason: 'Sesi tidak ditemukan di server' };
    }

    const session = sessions[0];

    // Cek apakah sesi sudah dicabut
    if (session.dicabut_pada) {
      return { valid: false, reason: 'Sesi telah dicabut / logout' };
    }

    // Cek status akun pengguna
    if (session.status !== 'ACTIVE') {
      return { valid: false, reason: `Akun berstatus ${session.status}` };
    }

    const now = Date.now();

    // Cek batas kedaluwarsa mutlak (ABSOLUTE_TIMEOUT_JAM)
    if (new Date(session.kedaluwarsa_mutlak).getTime() < now) {
      await executeQuery('UPDATE sesi SET dicabut_pada = NOW() WHERE id = ?', [session.id]);
      return { valid: false, reason: 'Sesi telah melampaui batas kedaluwarsa mutlak (12 jam)' };
    }

    // Cek batas idle timeout (IDLE_TIMEOUT_MENIT)
    const idleMenit = await SettingService.getInt('IDLE_TIMEOUT_MENIT');
    const lastActiveTime = new Date(session.aktivitas_terakhir).getTime();
    if (now - lastActiveTime > idleMenit * 60 * 1000) {
      await executeQuery('UPDATE sesi SET dicabut_pada = NOW() WHERE id = ?', [session.id]);
      return { valid: false, reason: `Sesi telah kedaluwarsa karena tidak ada aktivitas selama ${idleMenit} menit` };
    }

    // Cek kecocokan Device ID jika disertakan
    if (deviceId) {
      const currentDeviceHash = this.hashToken(deviceId);
      if (session.device_id_hash !== currentDeviceHash) {
        return { valid: false, reason: 'Device ID tidak cocok dengan catatan sesi awal' };
      }
    }

    // Perbarui aktivitas_terakhir (throttle per 30 detik untuk efisiensi kueri)
    if (now - lastActiveTime > 30000) {
      await executeQuery('UPDATE sesi SET aktivitas_terakhir = NOW() WHERE id = ?', [session.id]);
    }

    const user: UserProfile = {
      id: session.user_id,
      username: session.username,
      name: session.name,
      email: session.email,
      role: session.role,
      department: session.department,
      phone: session.phone,
      status: session.status
    };

    return {
      valid: true,
      user,
      sessionId: session.id
    };
  }

  /**
   * Merotasi refresh token untuk mendapatkan access token baru
   * Anti-Replay: Jika refresh token lama dicoba kembali, seluruh sesi user dicabut!
   */
  static async rotateRefreshToken(
    refreshToken: string,
    deviceId?: string,
    clientIp?: string,
    userAgent?: string
  ): Promise<{
    success: boolean;
    accessToken?: string;
    newRefreshToken?: string;
    user?: UserProfile;
    message: string;
  }> {
    if (!refreshToken) {
      return { success: false, message: 'Refresh token wajib disertakan.' };
    }

    const refreshHash = this.hashToken(refreshToken);

    return await runTransaction(async (conn) => {
      // Cari sesi berdasarkan refresh_hash aktif
      const rows = await conn.query<SessionWithUserRow[] | { rows?: SessionWithUserRow[] }>(
        `SELECT s.*, u.username, u.name, u.email, u.role, u.department, u.phone, u.status
         FROM sesi s
         JOIN users u ON s.user_id = u.id
         WHERE s.refresh_hash = ?`,
        [refreshHash]
      );

      const sessions = Array.isArray(rows) ? rows : rows.rows || [];

      // Jika tidak ditemukan, cek apakah ini indikasi reuse / token copying
      if (!sessions || sessions.length === 0) {
        return {
          success: false,
          message: 'Refresh token tidak sah atau sudah kedaluwarsa. Silakan login kembali.'
        };
      }

      const session = sessions[0];

      // Jika sesi ternyata sudah dicabut, tandai sebagai potensi penyalinan token
      if (session.dicabut_pada) {
        // Cabut seluruh sesi aktif akun ini demi keamanan!
        await conn.query('UPDATE sesi SET dicabut_pada = NOW() WHERE user_id = ?', [session.user_id]);
        await ActivityLogService.recordActivity({
          aksi: 'deteksi_token_reuse',
          pelaku_id: session.user_id,
          catatan: `PERINGATAN KEAMANAN: Upaya pemakaian ulang refresh token lama terdeteksi dari IP ${clientIp}. Seluruh sesi pengguna telah dicabut.`
        });
        return {
          success: false,
          message: 'Peringatan keamanan: Upaya pemakaian token lama terdeteksi. Seluruh sesi telah dicabut demi keamanan akun Anda.'
        };
      }

      // Validasi Device ID jika ada
      if (deviceId) {
        const deviceHash = this.hashToken(deviceId);
        if (session.device_id_hash !== deviceHash) {
          return { success: false, message: 'Device ID tidak cocok.' };
        }
      }

      // Buat token baru (Rotasi)
      const newRefreshToken = crypto.randomBytes(32).toString('hex');
      const newRefreshHash = this.hashToken(newRefreshToken);
      const newAccessToken = `${session.id}.${crypto.randomBytes(16).toString('hex')}`;

      // Perbarui refresh_hash dan aktivitas_terakhir di sesi
      await conn.query(
        `UPDATE sesi SET refresh_hash = ?, aktivitas_terakhir = NOW(), ip = ?, user_agent = ? WHERE id = ?`,
        [newRefreshHash, clientIp || session.ip, userAgent || session.user_agent, session.id]
      );

      const user: UserProfile = {
        id: session.user_id,
        username: session.username,
        name: session.name,
        email: session.email,
        role: session.role,
        department: session.department,
        phone: session.phone,
        status: session.status
      };

      return {
        success: true,
        accessToken: newAccessToken,
        newRefreshToken,
        user,
        message: 'Token berhasil dirotasi.'
      };
    });
  }

  /**
   * Menutup sesi (Logout)
   */
  static async revokeSession(sessionId: string, userId?: string): Promise<void> {
    await executeQuery('UPDATE sesi SET dicabut_pada = NOW() WHERE id = ?', [sessionId]);
    if (userId) {
      await ActivityLogService.recordActivity({
        aksi: 'logout',
        pelaku_id: userId,
        catatan: `Pengguna logout (Sesi ${sessionId} dicabut)`
      });
    }
  }

  /**
   * Memaksa cabut seluruh sesi akun tertentu (Admin/Developer Force Logout)
   */
  static async revokeAllUserSessions(targetUserId: string, performedBy: string): Promise<number> {
    const result = (await executeQuery<never>(
      'UPDATE sesi SET dicabut_pada = NOW() WHERE user_id = ? AND dicabut_pada IS NULL',
      [targetUserId]
    )) as unknown as DbUpdateResult;

    await ActivityLogService.recordActivity({
      aksi: 'cabut_seluruh_sesi_admin',
      pelaku_id: performedBy,
      catatan: `Administrator mencabut paksa seluruh sesi pengguna ID: ${targetUserId}`
    });

    return result.affectedRows || 0;
  }
}
