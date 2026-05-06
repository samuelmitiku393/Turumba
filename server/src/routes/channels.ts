import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { authenticate, requireManager, AuthRequest } from '../middleware/auth';
import { logActivity } from '../services/activityService';

const router = Router();
router.use(authenticate);

const channelSchema = z.object({
  name: z.string().min(1).max(200),
  username: z.string().min(1).max(100).regex(/^@?[a-zA-Z0-9_]+$/).transform(u => u.startsWith('@') ? u : `@${u}`),
  category: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  subscriberCount: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
  maxPostsPerDay: z.number().int().min(1).max(50).optional().default(5),
  preferredSlots: z.array(z.string().regex(/^\d{2}:\d{2}$/)).optional().default([]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#3B82F6'),
});

// GET /api/channels
router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const channels = await prisma.channel.findMany({
      include: {
        _count: { select: { ads: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(channels);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// GET /api/channels/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const channel = await prisma.channel.findUnique({
      where: { id: req.params['id'] },
      include: {
        ads: {
          orderBy: { scheduledAt: 'desc' },
          take: 10,
          include: { assignedTo: { select: { firstName: true, lastName: true } } },
        },
        _count: { select: { ads: true } },
      },
    });
    if (!channel) { res.status(404).json({ error: 'Channel not found' }); return; }
    res.json(channel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch channel' });
  }
});

// POST /api/channels
router.post('/', requireManager, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = channelSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() }); return; }

    const channel = await prisma.channel.create({ data: parsed.data });
    await logActivity(req.user!.id, 'created_channel', undefined, { channelId: channel.id, name: channel.name });
    res.status(201).json(channel);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') { res.status(409).json({ error: 'Channel username already exists' }); return; }
    console.error(err);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// PATCH /api/channels/:id
router.patch('/:id', requireManager, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = channelSchema.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() }); return; }

    const channel = await prisma.channel.update({ where: { id: req.params['id'] }, data: parsed.data });
    await logActivity(req.user!.id, 'updated_channel', undefined, { channelId: channel.id });
    res.json(channel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

// PATCH /api/channels/:id/subscribers
router.patch('/:id/subscribers', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subscriberCount } = req.body as { subscriberCount: number };
    if (typeof subscriberCount !== 'number' || subscriberCount < 0) {
      res.status(400).json({ error: 'Invalid subscriber count' }); return;
    }
    const channel = await prisma.channel.update({
      where: { id: req.params['id'] },
      data: { subscriberCount },
    });
    res.json(channel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update subscribers' });
  }
});

// DELETE /api/channels/:id
router.delete('/:id', requireManager, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const adsCount = await prisma.ad.count({ where: { channelId: req.params['id'] } });
    if (adsCount > 0) {
      res.status(409).json({ error: `Cannot delete channel with ${adsCount} existing ads. Deactivate it instead.` });
      return;
    }
    await prisma.channel.delete({ where: { id: req.params['id'] } });
    res.json({ message: 'Channel deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

export default router;
