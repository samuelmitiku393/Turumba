import { Router, Response } from 'express';
import { z } from 'zod';
import { AdStatus } from '@prisma/client';
import prisma from '../prisma/client';
import { authenticate, requireManager, AuthRequest } from '../middleware/auth';
import { logActivity } from '../services/activityService';
import { createNotification } from '../services/notificationService';

const router = Router();
router.use(authenticate);

const adSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  mediaUrls: z.array(z.string().url()).optional().default([]),
  advertiserName: z.string().min(1).max(200),
  advertiserContact: z.string().optional(),
  advertiserEmail: z.string().email().optional().or(z.literal('')),
  channelId: z.string().cuid(),
  durationDays: z.number().int().min(1).max(365),
  startDate: z.string().optional(),
  scheduledAt: z.string().optional(),
  assignedToId: z.string().cuid().optional(),
  templateId: z.string().cuid().optional(),
  revenue: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
});

// GET /api/ads
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, channelId, assignedToId, search, page = '1', limit = '20', sortBy = 'createdAt', sortOrder = 'desc' } = req.query as Record<string, string>;

    const where: Record<string, unknown> = {};
    if (status) where['status'] = status as AdStatus;
    if (channelId) where['channelId'] = channelId;
    if (assignedToId) where['assignedToId'] = assignedToId;
    if (search) {
      where['OR'] = [
        { title: { contains: search, mode: 'insensitive' } },
        { advertiserName: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [ads, total] = await prisma.$transaction([
      prisma.ad.findMany({
        where,
        include: {
          channel: { select: { id: true, name: true, username: true, color: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { chatMessages: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limitNum,
      }),
      prisma.ad.count({ where }),
    ]);

    res.json({ ads, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch ads' });
  }
});

// GET /api/ads/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ad = await prisma.ad.findUnique({
      where: { id: req.params['id'] },
      include: {
        channel: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true, role: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        template: { select: { id: true, name: true } },
        chatMessages: {
          include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
        activities: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!ad) { res.status(404).json({ error: 'Ad not found' }); return; }
    res.json(ad);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch ad' });
  }
});

// POST /api/ads
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = adSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() }); return; }

    const data = parsed.data;
    const expiresAt = data.startDate && data.durationDays
      ? new Date(new Date(data.startDate).getTime() + data.durationDays * 86400000)
      : undefined;

    const ad = await prisma.ad.create({
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        expiresAt,
        createdById: req.user!.id,
        revenue: data.revenue ? data.revenue : undefined,
        currency: 'ETB',
        mediaUrls: data.mediaUrls ?? [],
      },
      include: {
        channel: { select: { id: true, name: true, username: true, color: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await logActivity(req.user!.id, 'created_ad', ad.id, { title: ad.title });

    // Notify assigned user if different from creator
    if (ad.assignedToId && ad.assignedToId !== req.user!.id) {
      await createNotification({
        userId: ad.assignedToId,
        type: 'ASSIGNMENT',
        title: 'New Ad Assigned',
        body: `You have been assigned to manage "${ad.title}"`,
        adId: ad.id,
      });
    }

    res.status(201).json(ad);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create ad' });
  }
});

// PATCH /api/ads/:id
router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.ad.findUnique({ where: { id: req.params['id'] } });
    if (!existing) { res.status(404).json({ error: 'Ad not found' }); return; }

    const parsed = adSchema.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() }); return; }

    const data = parsed.data;
    const expiresAt = (data.startDate || existing.startDate) && (data.durationDays || existing.durationDays)
      ? new Date(new Date(data.startDate ?? existing.startDate!).getTime() + (data.durationDays ?? existing.durationDays) * 86400000)
      : existing.expiresAt;

    const ad = await prisma.ad.update({
      where: { id: req.params['id'] },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        expiresAt,
        revenue: data.revenue ? data.revenue : undefined,
      },
      include: {
        channel: { select: { id: true, name: true, username: true, color: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await logActivity(req.user!.id, 'updated_ad', ad.id, { fields: Object.keys(data) });

    // Notify new assignee
    if (data.assignedToId && data.assignedToId !== existing.assignedToId && data.assignedToId !== req.user!.id) {
      await createNotification({
        userId: data.assignedToId,
        type: 'ASSIGNMENT',
        title: 'Ad Assigned to You',
        body: `You have been assigned to "${ad.title}"`,
        adId: ad.id,
      });
    }

    res.json(ad);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update ad' });
  }
});

// PATCH /api/ads/:id/status
router.patch('/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, rejectionReason } = req.body as { status: AdStatus; rejectionReason?: string };
    const validStatuses = Object.values(AdStatus);
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    const existing = await prisma.ad.findUnique({ where: { id: req.params['id'] } });
    if (!existing) { res.status(404).json({ error: 'Ad not found' }); return; }

    // Permission checks
    if (status === 'PENDING_APPROVAL' && req.user!.role !== 'POSTER' && req.user!.role !== 'MANAGER' && req.user!.role !== 'ADMIN') {
      res.status(403).json({ error: 'Insufficient permissions' }); return;
    }
    if ((status === 'SCHEDULED' || status === 'CANCELLED') && req.user!.role === 'POSTER') {
      res.status(403).json({ error: 'Manager or Admin required to approve/cancel' }); return;
    }

    const updateData: Record<string, unknown> = { status, rejectionReason: rejectionReason ?? null };
    if (status === 'ACTIVE') updateData['postedAt'] = new Date();
    if (status === 'SCHEDULED' || status === 'PENDING_APPROVAL') {
      updateData['approvedById'] = req.user!.id;
      updateData['approvedAt'] = new Date();
    }

    const ad = await prisma.ad.update({
      where: { id: req.params['id'] },
      data: updateData,
    });

    await logActivity(req.user!.id, 'status_changed', ad.id, undefined, existing.status, status);

    // Notify creator of status change
    if (existing.createdById !== req.user!.id) {
      await createNotification({
        userId: existing.createdById,
        type: 'STATUS_CHANGE',
        title: `Ad Status Updated`,
        body: `"${ad.title}" status changed to ${status}${rejectionReason ? `: ${rejectionReason}` : ''}`,
        adId: ad.id,
      });
    }

    res.json(ad);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// POST /api/ads/:id/chat
router.post('/:id/chat', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { content } = req.body as { content: string };
    if (!content?.trim()) { res.status(400).json({ error: 'Message content required' }); return; }

    const msg = await prisma.chatMessage.create({
      data: { adId: req.params['id'], userId: req.user!.id, content: content.trim() },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });
    res.status(201).json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// POST /api/ads/bulk-approve
router.post('/bulk-approve', requireManager, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { adIds } = req.body as { adIds: string[] };
    if (!Array.isArray(adIds) || adIds.length === 0) {
      res.status(400).json({ error: 'adIds array is required' }); return;
    }

    const updated = await prisma.ad.updateMany({
      where: { id: { in: adIds }, status: 'PENDING_APPROVAL' },
      data: { status: 'SCHEDULED', approvedById: req.user!.id, approvedAt: new Date() },
    });

    await logActivity(req.user!.id, 'bulk_approved', undefined, { count: updated.count, adIds });
    res.json({ message: 'Bulk approval successful', count: updated.count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to bulk approve' });
  }
});

// DELETE /api/ads/:id
router.delete('/:id', requireManager, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.chatMessage.deleteMany({ where: { adId: req.params['id'] } });
    await prisma.activityLog.deleteMany({ where: { adId: req.params['id'] } });
    await prisma.notification.deleteMany({ where: { adId: req.params['id'] } });
    await prisma.ad.delete({ where: { id: req.params['id'] } });
    await logActivity(req.user!.id, 'deleted_ad', undefined, { adId: req.params['id'] });
    res.json({ message: 'Ad deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete ad' });
  }
});

export default router;
