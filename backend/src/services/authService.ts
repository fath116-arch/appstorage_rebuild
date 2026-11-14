/**
 * Authentication Service (Server-Authoritative)
 * FieldOps IT Inventory Rebuild
 */

import crypto from 'crypto';
import { executeQuery } from '../db/database';

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'technician' | 'warehouse_admin' | 'admin' | 'developer' | 'supervisor' | 'superadmin';
  department: string;
  phone: string;
  status: string;
}

interface UserRecordRow {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserProfile['role'];
  department: string;
  phone?: string | null;
  status: string;
  password_hash?: string | null;
  salt?: string | null;
}

interface LegacySessionRow {
  session_id: string;
  user_id: string;
  expires_at: string;
}

function normalizeUserRole(rawRole: UserRecordRow['role']): UserProfile['role'] {
  if (rawRole === 'superadmin') return 'developer';
  if (rawRole === 'supervisor') return 'admin';
  return rawRole;
}

export class AuthService {
  /**
   * Menghasilkan hash PBKDF2 SHA-256 100.000 iterasi + 16-byte random salt
   */
  static hashPassword(password: string, customSalt?: string): { hash: string; salt: string } {
    const salt = customSalt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
    return { hash, salt };
  }

  /**
   * Verifikasi kata sandi dengan dukungan Plain-Text dan PBKDF2 (100.000 iterasi)
   * Memastikan akun yang dibuat langsung di database MariaDB atau tanpa salt dapat langsung masuk
   */
  static verifyPassword(passwordAttempt: string, salt: string | null | undefined, storedHash: string | null | undefined): boolean {
    if (!storedHash) return false;
    const cleanStored = String(storedHash).trim();
    const cleanAttempt = String(passwordAttempt).trim();

    // 1. Kecocokan langsung plain-text (jika akun diisi manual di MariaDB/SQL)
    if (cleanStored === cleanAttempt || storedHash === passwordAttempt) {
      return true;
    }

    // 2. Jika tidak ada salt di database, cocokkan langsung
    if (!salt) {
      return cleanStored === cleanAttempt;
    }

    // 3. Verifikasi PBKDF2 SHA-256 (100.000 iterasi) jika disimpan dalam format hash
    try {
      const attemptHash = crypto.pbkdf2Sync(cleanAttempt, salt, 100000, 32, 'sha256').toString('hex');
      if (attemptHash.toLowerCase() === cleanStored.toLowerCase()) {
        return true;
      }
      if (Buffer.from(attemptHash, 'hex').length === Buffer.from(cleanStored, 'hex').length) {
        if (crypto.timingSafeEqual(Buffer.from(attemptHash, 'hex'), Buffer.from(cleanStored, 'hex'))) {
          return true;
        }
      }
    } catch {
      // Abaikan jika cleanStored bukan hex valid
    }

    // 4. Fallback toleransi
    return cleanStored === cleanAttempt;
  }

  /**
   * Login user dengan otentikasi ramah sistem internal
   */
  static async login(username: string, passwordAttempt: string, clientIp: string, userAgent: string): Promise<{ success: boolean; message: string; sessionToken?: string; user?: UserProfile }> {
    const cleanUsername = String(username).trim();
    const cleanPassword = String(passwordAttempt).trim();

    // Ambil data user dari database (toleran huruf besar/kecil)
    let users = await executeQuery<UserRecordRow>('SELECT * FROM users WHERE LOWER(TRIM(username)) = LOWER(?)', [cleanUsername]);
    if (!users || users.length === 0) {
      users = await executeQuery<UserRecordRow>('SELECT * FROM users WHERE username = ?', [cleanUsername]);
    }
    const user = users && users[0];

    if (!user) {
      return { success: false, message: 'Username atau kata sandi tidak cocok.' };
    }

    // Periksa status akun (Persetujuan Admin, Suspended, Ditolak)
    if (user.status === 'PENDING_APPROVAL') {
      return { 
        success: false, 
        message: 'Akun Anda sedang menunggu persetujuan dari Admin sebelum dapat masuk.' 
      };
    }

    if (user.status === 'REJECTED') {
      return { 
        success: false, 
        message: 'Pendaftaran akun Anda ditolak oleh Admin. Hubungi tim IT.' 
      };
    }

    if (user.status === 'SUSPENDED') {
      return { 
        success: false, 
        message: 'Akun Anda dinonaktifkan (SUSPENDED). Hubungi Admin.' 
      };
    }

    if (user.status && user.status !== 'ACTIVE') {
      return { 
        success: false, 
        message: 'Akun belum aktif. Hubungi Admin.' 
      };
    }

    // Verifikasi kata sandi di server
    const isValid = this.verifyPassword(cleanPassword, user.salt, user.password_hash);
    if (!isValid) {
      return { success: false, message: 'Username atau kata sandi tidak cocok.' };
    }

    // Buat session ID 32-byte acak
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 hari

    await executeQuery(
      'INSERT INTO sessions (session_id, user_id, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)',
      [sessionId, user.id, clientIp, userAgent, expiresAt.toISOString()]
    );

    const profile: UserProfile = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: normalizeUserRole(user.role),
      department: user.department,
      phone: user.phone || '',
      status: user.status
    };

    return {
      success: true,
      message: 'Login berhasil.',
      sessionToken: sessionId,
      user: profile
    };
  }

  /**
   * Validasi token sesi dari cookie HTTP
   */
  static async validateSession(sessionId: string): Promise<UserProfile | null> {
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 32) return null;

    const sessions = await executeQuery<LegacySessionRow>('SELECT * FROM sessions WHERE session_id = ?', [sessionId]);
    const session = sessions[0];
    if (!session) return null;

    if (new Date(session.expires_at).getTime() < Date.now()) {
      await executeQuery('DELETE FROM sessions WHERE session_id = ?', [sessionId]);
      return null;
    }

    const users = await executeQuery<UserRecordRow>('SELECT * FROM users WHERE id = ?', [session.user_id]);
    const user = users[0];
    if (!user || user.status !== 'ACTIVE') return null;

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: normalizeUserRole(user.role),
      department: user.department,
      phone: user.phone || '',
      status: user.status
    };
  }

  /**
   * Logout user dan hapus sesi dari database
   */
  static async logout(sessionId: string): Promise<void> {
    if (sessionId) {
      await executeQuery('DELETE FROM sessions WHERE session_id = ?', [sessionId]);
    }
  }
}
