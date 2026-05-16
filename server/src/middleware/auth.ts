import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';
import { User } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: User;
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

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
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
