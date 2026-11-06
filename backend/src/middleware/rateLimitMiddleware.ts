/**
 * Rate Limiting Middleware (Zero External Dependency)
 * Melindungi endpoint berat PBKDF2 (Login & Reset Password) dari Brute Force / CPU Exhaustion
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const memoryRateLimitStore = new Map<string, RateLimitRecord>();

// Bersihkan data lama secara berkala setiap 5 menit
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of memoryRateLimitStore.entries()) {
    if (record.resetTime <= now) {
      memoryRateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyPrefix?: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, maxRequests, message = 'Terlalu banyak permintaan. Silakan coba beberapa saat lagi.', keyPrefix = 'rl' } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Ambil IP klien dengan aman
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
    const storeKey = `${keyPrefix}:${clientIp}`;
    const now = Date.now();

    let record = memoryRateLimitStore.get(storeKey);

    if (!record || record.resetTime <= now) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      memoryRateLimitStore.set(storeKey, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > maxRequests) {
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        success: false,
        message,
        retryAfter: retryAfterSec
      });
    }

    next();
  };
}
