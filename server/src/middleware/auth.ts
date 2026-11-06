import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';
import { User } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: User;
}

// ── Tiny user cache to avoid a DB hit on every request ───────────────────────
// Entries expire after 60 s; cache is bounded to 500 entries.
const USER_CACHE_TTL_MS = 60_000;
const USER_CACHE_MAX = 500;
const userCache = new Map<string, { user: User; expiresAt: number }>();

function getCachedUser(id: string): User | null {
  const entry = userCache.get(id);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { userCache.delete(id); return null; }
  return entry.user;
}

function setCachedUser(user: User): void {
  if (userCache.size >= USER_CACHE_MAX) {
    // Evict the oldest key
    const firstKey = userCache.keys().next().value;
    if (firstKey) userCache.delete(firstKey);
  }
  userCache.set(user.id, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
}

/** Call this whenever a user's role/status changes so the cache is immediately consistent. */
export function invalidateUserCache(userId: string): void {
  userCache.delete(userId);
}

/**
 * Verifies Telegram Web App initData HMAC and attaches req.user
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing authorization header' });
      return;
    }

    const token = authHeader.slice(7);
    const secret = process.env.JWT_SECRET!;
    const payload = jwt.verify(token, secret) as { userId: string };

    // Try cache first to avoid a DB round-trip on every request
    let user = getCachedUser(payload.userId);
    if (!user) {
      user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (user) setCachedUser(user);
    }

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    if (user.status !== 'ACTIVE') {
      res.status(403).json({ error: user.status === 'PENDING' ? 'pending_approval' : 'rejected' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Require admin or manager role
 */
export function requireManager(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER')) {
    res.status(403).json({ error: 'Manager or Admin access required' });
    return;
  }
  next();
}

/**
 * Require admin role
 */
export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

/**
 * Verify Telegram initData HMAC signature
 */
export function verifyTelegramInitData(initData: string): Record<string, string> | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.TELEGRAM_BOT_TOKEN!)
      .digest();

    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computedHash !== hash) return null;

    // Check that the data is not older than 24 hours
    const authDate = Number(params.get('auth_date'));
    if (Date.now() / 1000 - authDate > 86400) return null;

    const result: Record<string, string> = {};
    params.forEach((v, k) => { result[k] = v; });
    return result;
  } catch {
    return null;
  }
}
