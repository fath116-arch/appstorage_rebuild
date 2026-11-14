/**
 * Authentication & RBAC Middleware
 * FieldOps IT Inventory Rebuild - v2 Foundation
 */

import { Request, Response, NextFunction } from 'express';
import { UserProfile } from '../services/authService';
import { SessionService } from '../services/sessionService';
import { ConfirmationService } from '../services/confirmationService';
import { isRoleAllowed, UserRole } from '../utils/permissions';

export interface AuthenticatedRequest extends Request {
  user?: UserProfile;
  sessionId?: string;
  deviceId?: string;
}

/**
 * Helper untuk parsing cookie tanpa dependensi tambahan
 */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts[0]?.trim();
    if (name) {
      cookies[name] = decodeURIComponent(parts.slice(1).join('=').trim());
    }
  });

  return cookies;
}

/**
 * Middleware untuk mengekstrak dan memvalidasi sesi server dari Cookie atau Header Bearer
 */
export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  // Dukung cookie access token v2, session legacy, atau bearer
  const token = cookies['fieldops_access'] || cookies['fieldops_session'] || bearerToken;
  const deviceId = cookies['fieldops_device'];

  if (!token) {
    return next();
  }

  try {
    const result = await SessionService.validateSession(token, deviceId);
    if (result.valid && result.user) {
      req.user = result.user;
      req.sessionId = result.sessionId;
      req.deviceId = deviceId;
    }
  } catch (err) {
    console.warn('[Auth Middleware Warning]:', err);
  }

  next();
}

/**
 * Middleware wajib login
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Akses ditolak: Anda harus login terlebih dahulu.'
    });
  }
  next();
}

/**
 * Middleware penegakan hak akses peran (RBAC) di sisi server
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Akses ditolak: Sesi tidak terautentikasi.'
      });
    }

    if (!isRoleAllowed(req.user.role, allowedRoles)) {
      return res.status(403).json({
        success: false,
        message: `Hak akses tidak memadai: Diperlukan peran [${allowedRoles.join('/')}], peran Anda adalah ${req.user.role}.`
      });
    }

    next();
  };
}

/**
 * Middleware penegakan konfirmasi sensitif bertingkat (Tier 2 & 3 Server Enforcement)
 */
export function requireConfirmation(
  actionType: string,
  targetIdExtractor: (req: AuthenticatedRequest) => string
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Harus login terlebih dahulu.' });
    }

    const targetId = targetIdExtractor(req);
    const confirmationToken = (req.headers['x-confirmation-token'] as string) || req.body?.confirmation_token;

    const validation = await ConfirmationService.consumeConfirmationToken(
      confirmationToken,
      req.user.id,
      actionType,
      targetId
    );

    if (!validation.valid) {
      return res.status(403).json({
        success: false,
        message: validation.message,
        requiresConfirmation: true,
        actionType,
        targetId
      });
    }

    next();
  };
}
