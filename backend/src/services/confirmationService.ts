/**
 * Multi-Tier Sensitive Action Confirmation Service
 * FieldOps Inventory v2 - Tahap 1: Fondasi (SECURITY_GUIDE.md Bagian 2)
 * Menegakkan konfirmasi bertingkat di sisi server dengan token sekali pakai (TTL 120s)
 */

import crypto from 'crypto';
import { executeQuery, runTransaction } from '../db/database';
import { SettingService } from './settingService';
import { AuthService } from './authService';
import { parseToDate, toMysqlUtcSeconds } from '../utils/timezone';

export interface ConfirmationRequestInput {
  userId: string;
  actionType: string;
  targetId: string;
  targetName?: string;
  objectNameTyped?: string;
  reauthPassword?: string;
  lastLoginTime?: number;
}

export class ConfirmationService {
  /**
   * Menentukan tingkat konfirmasi untuk aksi tertentu
   */
  static async getActionTier(actionType: string): Promise<number> {
    const tiers = await SettingService.getJSON<Record<string, number>>('CONFIRMATION_TIERS');
    if (tiers && typeof tiers[actionType] === 'number') {
      return tiers[actionType];
    }
    // Default tier jika tidak terdaftar: aksi penghapusan default ke Tier 3, lainnya ke Tier 1
    if (actionType.startsWith('delete') || actionType.includes('permanent')) {
      return 3;
    }
    return 1;
  }

  /**
   * Menerbitkan token konfirmasi bertingkat sekali pakai (Tier 2 & 3)
   */
  static async requestConfirmationToken(input: ConfirmationRequestInput): Promise<{
    success: boolean;
    tier: number;
    token?: string;
    expiresInSeconds?: number;
    message: string;
    requiresReauth?: boolean;
  }> {
    const tier = await this.getActionTier(input.actionType);

    // Tier 0 & 1 tidak memerlukan token server terpisah
    if (tier < 2) {
      return {
        success: true,
        tier,
        message: 'Aksi ini tidak memerlukan token konfirmasi server.'
      };
    }

    // Validasi Tier 2: Pengguna harus mengetik "approve"
    if (tier === 2) {
      if (input.objectNameTyped?.toLowerCase().trim() !== 'approve') {
        return {
          success: false,
          tier,
          message: 'Konfirmasi Tingkat 2 gagal: Anda harus mengetik kata "approve" secara persis.'
        };
      }
    }

    // Validasi Tier 3: Aksi penghapusan wajib mengetik "delete"; aksi Tier 3 lainnya mengetik nama objek persis + cek re-autentikasi password jika > REAUTH_MENIT
    if (tier === 3) {
      const isDeleteAction =
        input.actionType.startsWith('delete') || input.actionType === 'permanent_delete';

      if (isDeleteAction) {
        if (input.objectNameTyped?.trim().toLowerCase() !== 'delete') {
          return {
            success: false,
            tier,
            message: 'Konfirmasi Tingkat 3 gagal: Ketik kata "delete" untuk melanjutkan penghapusan.'
          };
        }
      } else if (!input.targetName || input.objectNameTyped?.trim() !== input.targetName.trim()) {
        return {
          success: false,
          tier,
          message: `Konfirmasi Tingkat 3 gagal: Teks yang Anda ketik tidak cocok dengan nama objek "${input.targetName}".`
        };
      }

      // Cek apakah perlu verifikasi password ulang (REAUTH_MENIT)
      const reauthMenit = await SettingService.getInt('REAUTH_MENIT');
      const timeSinceLoginMs = Date.now() - (input.lastLoginTime || 0);
      const isReauthRequired = timeSinceLoginMs > reauthMenit * 60 * 1000;

      if (isReauthRequired) {
        if (!input.reauthPassword) {
          return {
            success: false,
            tier,
            requiresReauth: true,
            message: `Sesi login Anda sudah melewati ${reauthMenit} menit. Masukkan kembali kata sandi akun Anda untuk melanjutkan aksi tingkat 3.`
          };
        }

        // Verifikasi kata sandi pengguna
        const users = await executeQuery<any>('SELECT password_hash, salt FROM users WHERE id = ?', [input.userId]);
        if (!users || users.length === 0) {
          return { success: false, tier, message: 'Pengguna tidak ditemukan.' };
        }

        const isPasswordValid = AuthService.verifyPassword(input.reauthPassword, users[0].salt, users[0].password_hash);
        if (!isPasswordValid) {
          return { success: false, tier, requiresReauth: true, message: 'Kata sandi akun yang Anda masukkan salah.' };
        }
      }
    }

    // Buat token konfirmasi sekali pakai (TTL 120 detik)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenId = `cf-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const ttlSeconds = await SettingService.getInt('CONFIRMATION_TOKEN_TTL_DETIK');
    const expiresAtSql = toMysqlUtcSeconds(new Date(Date.now() + ttlSeconds * 1000));

    await executeQuery(
      `INSERT INTO token_konfirmasi (id, token_hash, user_id, action_type, target_id, tier, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tokenId, tokenHash, input.userId, input.actionType, input.targetId, tier, expiresAtSql]
    );

    return {
      success: true,
      tier,
      token: rawToken,
      expiresInSeconds: ttlSeconds,
      message: 'Token konfirmasi berhasil diterbitkan.'
    };
  }

  /**
   * Menegakkan dan mengonsumsi token konfirmasi (Single-Use Server Enforcement)
   */
  static async consumeConfirmationToken(rawToken: string | undefined, userId: string, actionType: string, targetId: string): Promise<{
    valid: boolean;
    message: string;
  }> {
    const tier = await this.getActionTier(actionType);

    // Tier 0 dan 1 tidak memerlukan token
    if (tier < 2) {
      return { valid: true, message: 'Aksi diizinkan.' };
    }

    if (!rawToken || typeof rawToken !== 'string') {
      return {
        valid: false,
        message: `Aksi ini memerlukan konfirmasi Tingkat ${tier}. Token konfirmasi tidak ditemukan.`
      };
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

    // Konsumsi token secara atomik (hanya baris yang belum pernah digunakan dan belum kedaluwarsa)
    const result = await runTransaction(async (conn) => {
      const rows = await conn.query(
        `SELECT id, user_id, action_type, target_id, expires_at, used_at
         FROM token_konfirmasi
         WHERE token_hash = ?`,
        [tokenHash]
      );

      const items = Array.isArray(rows) ? rows : (rows as any).rows || [];
      if (!items || items.length === 0) {
        return { valid: false, message: 'Token konfirmasi tidak sah atau tidak ditemukan.' };
      }

      const tokenRecord = items[0];

      if (tokenRecord.used_at) {
        return { valid: false, message: 'Token konfirmasi ini sudah pernah digunakan (anti-replay).' };
      }

      const expiresDate = parseToDate(tokenRecord.expires_at);
      if (!expiresDate || expiresDate.getTime() < Date.now()) {
        return { valid: false, message: 'Token konfirmasi sudah kedaluwarsa (batas waktu 120 detik).' };
      }

      if (tokenRecord.user_id !== userId) {
        return { valid: false, message: 'Token konfirmasi tidak cocok dengan akun yang sedang aktif.' };
      }

      if (tokenRecord.action_type !== actionType || tokenRecord.target_id !== targetId) {
        return { valid: false, message: 'Token konfirmasi tidak sesuai dengan jenis aksi atau objek target.' };
      }

      // Tandai token telah digunakan
      await conn.query('UPDATE token_konfirmasi SET used_at = NOW() WHERE id = ?', [tokenRecord.id]);

      return { valid: true, message: 'Token konfirmasi berhasil divalidasi dan dikonsumsi.' };
    });

    return result;
  }
}
