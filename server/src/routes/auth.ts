import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';
import { verifyTelegramInitData } from '../middleware/auth';
import { logActivity } from '../services/activityService';

const router = Router();

// POST /api/auth/login
// Verifies Telegram initData, upserts user, returns JWT
router.post('/login', async (req, res: Response): Promise<void> => {
  try {
    const { initData } = req.body;
    if (!initData) {
      res.status(400).json({ error: 'initData is required' });
      return;
    }

    const data = verifyTelegramInitData(initData);
    if (!data) {
      res.status(401).json({ error: 'Invalid Telegram initData' });
      return;
    }

    let telegramUser: { id: number; username?: string; first_name: string; last_name?: string; photo_url?: string };
    try {
      telegramUser = JSON.parse(data['user']);
    } catch {
      res.status(400).json({ error: 'Invalid user data in initData' });
      return;
    }

    // Check if this is the first user — first user becomes auto-admin
    const userCount = await prisma.user.count();
    const defaultRole = userCount === 0 ? 'ADMIN' : 'POSTER';

    // Find or create user (without updating profile yet)
    let user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramUser.id) },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId: BigInt(telegramUser.id),
          username: telegramUser.username,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          avatarUrl: telegramUser.photo_url,
          role: defaultRole,
          status: defaultRole === 'ADMIN' ? 'ACTIVE' : 'PENDING',
        },
      });
    }

    // Gate: block pending / rejected users before any profile write
    if (user.status === 'PENDING') {
      res.status(403).json({ error: 'pending_approval', message: 'Your account is pending approval by an administrator.' });
      return;
    }
    if (user.status === 'REJECTED') {
      res.status(403).json({ error: 'rejected', message: 'Your access to the system has been rejected.' });
      return;
    }

    // User is active — refresh profile info from Telegram and promote first user
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        avatarUrl: telegramUser.photo_url,
        ...(userCount <= 1 ? { role: 'ADMIN', status: 'ACTIVE' } : {}),
      },
    });

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
    );

    await logActivity(user.id, 'login', undefined, undefined);

    res.json({
      token,
      user: {
        id: user.id,
        telegramId: user.telegramId.toString(),
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me - get current user from JWT
router.get('/me', async (req, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({
      id: user.id,
      telegramId: user.telegramId.toString(),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
    });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
