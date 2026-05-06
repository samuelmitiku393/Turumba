import { Router, Response } from 'express';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/schedule?start=&end=&channelId=
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { start, end, channelId } = req.query as Record<string, string>;

    const where: Record<string, unknown> = {
      scheduledAt: { not: null },
      status: { in: ['SCHEDULED', 'POSTED', 'ACTIVE'] },
    };
    if (start || end) {
      where['scheduledAt'] = {
        ...(start ? { gte: new Date(start) } : {}),
        ...(end ? { lte: new Date(end) } : {}),
      };
    }
    if (channelId) where['channelId'] = channelId;

    const ads = await prisma.ad.findMany({
      where,
      include: {
        channel: { select: { id: true, name: true, username: true, color: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    res.json(ads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// GET /api/schedule/conflicts?channelId=&scheduledAt=&excludeAdId=
router.get('/conflicts', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { channelId, scheduledAt, excludeAdId } = req.query as Record<string, string>;
    if (!channelId || !scheduledAt) {
      res.status(400).json({ error: 'channelId and scheduledAt required' }); return;
    }

    const date = new Date(scheduledAt);
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

    const conflicts = await prisma.ad.findMany({
      where: {
        channelId,
        scheduledAt: { gte: dayStart, lte: dayEnd },
        status: { in: ['SCHEDULED', 'POSTED', 'ACTIVE'] },
        ...(excludeAdId ? { id: { not: excludeAdId } } : {}),
      },
      select: { id: true, title: true, scheduledAt: true, status: true },
    });

    // Also check max posts per day limit
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { maxPostsPerDay: true },
    });

    res.json({
      conflicts,
      hasConflicts: conflicts.length > 0,
      atDayLimit: channel ? conflicts.length >= channel.maxPostsPerDay : false,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check conflicts' });
  }
});

// GET /api/schedule/today
router.get('/today', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    const dayStart = new Date(today); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(today); dayEnd.setHours(23, 59, 59, 999);

    const ads = await prisma.ad.findMany({
      where: {
        scheduledAt: { gte: dayStart, lte: dayEnd },
        ...(req.user!.role === 'POSTER' ? { assignedToId: req.user!.id } : {}),
      },
      include: {
        channel: { select: { id: true, name: true, username: true, color: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    res.json(ads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch today schedule' });
  }
});

export default router;
