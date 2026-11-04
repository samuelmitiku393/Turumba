import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { logActivity } from '../services/activityService';
import {
  getActiveManagers,
  getDutyManagerForDate,
  getNextCyclicalManager,
  determineManagerForAd,
} from '../services/dutyService';

const router = Router();
router.use(authenticate);

// GET /api/duty
// Fetch duty schedules for a month or range
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, start, end } = req.query as Record<string, string>;

    const where: Record<string, unknown> = {};
    if (month) {
      where['date'] = { startsWith: month }; // e.g. "2026-11"
    } else if (start && end) {
      where['date'] = { gte: start, lte: end };
    }

    const duties = await prisma.managerDuty.findMany({
      where,
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    res.json(duties);
  } catch (err) {
    console.error('Failed to fetch duties:', err);
    res.status(500).json({ error: 'Failed to fetch duty assignments' });
  }
});

// GET /api/duty/today
// Get today's duty manager and cyclical rotation status
router.get('/today', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const dutyManager = await getDutyManagerForDate(todayStr);
    const activeManagers = await getActiveManagers();
    const effectiveManager = dutyManager || (await determineManagerForAd(new Date()));

    res.json({
      todayDate: todayStr,
      isOverridden: !!dutyManager,
      dutyManager,
      effectiveManager,
      activeManagers: activeManagers.map((m) => ({
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        username: m.username,
        avatarUrl: m.avatarUrl,
        role: m.role,
      })),
    });
  } catch (err) {
    console.error('Failed to fetch today duty:', err);
    res.status(500).json({ error: 'Failed to fetch today duty' });
  }
});

// POST /api/duty
// Admin assigns a specific manager to a specific date (YYYY-MM-DD)
const dutySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  managerId: z.string().cuid(),
});

router.post('/', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = dutySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { date, managerId } = parsed.data;

    const manager = await prisma.user.findUnique({
      where: { id: managerId },
    });

    if (!manager || !manager.isActive) {
      res.status(404).json({ error: 'Manager not found or inactive' });
      return;
    }

    const duty = await prisma.managerDuty.upsert({
      where: { date },
      update: { managerId },
      create: { date, managerId },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    await logActivity(req.user!.id, 'assigned_duty', undefined, {
      date,
      managerId,
      managerName: `${manager.firstName} ${manager.lastName || ''}`.trim(),
    });

    // Also update any SCHEDULED ads on that date that don't have an explicit manager or are pending
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    await prisma.ad.updateMany({
      where: {
        scheduledAt: { gte: dayStart, lte: dayEnd },
        status: 'SCHEDULED',
      },
      data: {
        assignedToId: managerId,
        lastAssignedAt: new Date(),
      },
    });

    res.json(duty);
  } catch (err) {
    console.error('Failed to assign duty:', err);
    res.status(500).json({ error: 'Failed to assign duty' });
  }
});

// DELETE /api/duty/:date
// Admin removes a specific date assignment, reverting to cyclical default
router.delete('/:date', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Invalid date format (must be YYYY-MM-DD)' });
      return;
    }

    await prisma.managerDuty.deleteMany({
      where: { date },
    });

    await logActivity(req.user!.id, 'removed_duty_override', undefined, { date });
    res.json({ message: `Duty override for ${date} removed. Reverted to cyclical rotation.` });
  } catch (err) {
    console.error('Failed to remove duty:', err);
    res.status(500).json({ error: 'Failed to remove duty' });
  }
});

export default router;

