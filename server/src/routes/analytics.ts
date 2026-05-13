import { Router, Response } from 'express';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/analytics/dashboard  – overview stats
router.get('/dashboard', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const isPoster = req.user?.role === 'POSTER';

    const baseWhere = isPoster 
      ? { OR: [{ createdById: req.user!.id }, { assignedToId: req.user!.id }] } 
      : {};

    const [
      totalAds,
      activeAds,
      pendingToday,
      expiringThisWeek,
      totalChannels,
      activeChannels,
      totalRevenue,
      monthRevenue,
    ] = await prisma.$transaction([
      prisma.ad.count({ where: baseWhere }),
      prisma.ad.count({ where: { ...baseWhere, status: 'ACTIVE' } }),
      prisma.ad.count({
        where: {
          ...baseWhere,
          scheduledAt: {
            gte: new Date(now.setHours(0, 0, 0, 0)),
            lte: new Date(now.setHours(23, 59, 59, 999)),
          },
          status: 'SCHEDULED',
        },
      }),
      prisma.ad.count({
        where: { ...baseWhere, expiresAt: { gte: now, lte: weekFromNow }, status: 'ACTIVE' },
      }),
      prisma.channel.count(),
      prisma.channel.count({ where: { isActive: true } }),
      prisma.ad.aggregate({ 
        _sum: { revenue: true }, 
        where: { ...baseWhere, status: { in: ['POSTED', 'ACTIVE', 'EXPIRED'] } } 
      }),
      prisma.ad.aggregate({
        _sum: { revenue: true },
        where: { ...baseWhere, createdAt: { gte: monthStart }, status: { in: ['POSTED', 'ACTIVE', 'EXPIRED'] } },
      }),
    ]);

    res.json({
      totalAds,
      activeAds,
      pendingToday,
      expiringThisWeek,
      totalChannels: isPoster ? undefined : totalChannels,
      activeChannels: isPoster ? undefined : activeChannels,
      totalRevenue: isPoster ? 0 : (totalRevenue._sum.revenue ?? 0),
      monthRevenue: isPoster ? 0 : (monthRevenue._sum.revenue ?? 0),
      currency: 'ETB',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

import { requireManager } from '../middleware/auth';

// GET /api/analytics/revenue  – revenue by advertiser (restricted)
router.get('/revenue', requireManager, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await prisma.ad.groupBy({
      by: ['advertiserName'],
      _sum: { revenue: true },
      _count: { id: true },
      where: { status: { in: ['POSTED', 'ACTIVE', 'EXPIRED'] }, revenue: { not: null } },
      orderBy: { _sum: { revenue: 'desc' } },
      take: 10,
    });
    res.json(data.map(d => ({
      advertiser: d.advertiserName,
      revenue: d._sum.revenue ?? 0,
      adCount: d._count.id,
      currency: 'ETB',
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch revenue' });
  }
});

// GET /api/analytics/channels  – channel performance (restricted)
router.get('/channels', requireManager, async (_req: AuthRequest, res: Response): Promise<void> => {
// ... (rest of the logic remains the same, just wrapped in requireManager)
  try {
    const channels = await prisma.channel.findMany({
      include: {
        _count: { select: { ads: true } },
        ads: {
          where: { status: { in: ['POSTED', 'ACTIVE', 'EXPIRED'] } },
          select: { revenue: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const result = channels.map(c => ({
      id: c.id,
      name: c.name,
      username: c.username,
      color: c.color,
      subscriberCount: c.subscriberCount,
      totalAds: c._count.ads,
      totalRevenue: c.ads.reduce((sum, a) => sum + Number(a.revenue ?? 0), 0),
      currency: 'ETB',
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch channel analytics' });
  }
});

// GET /api/analytics/team  – team productivity (restricted)
router.get('/team', requireManager, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const members = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            assignedAds: true,
            createdAds: true,
          },
        },
        assignedAds: {
          where: { postedAt: { gte: monthStart } },
          select: { id: true },
        },
      },
    });

    res.json(members.map(m => ({
      id: m.id,
      name: `${m.firstName} ${m.lastName ?? ''}`.trim(),
      username: m.username,
      role: m.role,
      avatarUrl: m.avatarUrl,
      totalAssigned: m._count.assignedAds,
      totalCreated: m._count.createdAds,
      postedThisMonth: m.assignedAds.length,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch team analytics' });
  }
});

// GET /api/analytics/activity  – recent activity feed
router.get('/activity', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isPoster = req.user?.role === 'POSTER';
    const where = isPoster ? { userId: req.user!.id } : {};
    
    const activities = await prisma.activityLog.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true } },
        ad: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(activities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// GET /api/analytics/upcoming  – upcoming 7 days
router.get('/upcoming', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 86400000);
    const isPoster = req.user?.role === 'POSTER';
    const baseWhere = isPoster ? { OR: [{ createdById: req.user!.id }, { assignedToId: req.user!.id }] } : {};

    const ads = await prisma.ad.findMany({
      where: {
        ...baseWhere,
        scheduledAt: { gte: now, lte: weekFromNow },
        status: { in: ['SCHEDULED', 'PENDING_APPROVAL'] },
      },
      include: {
        channel: { select: { id: true, name: true, username: true, color: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    res.json(ads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch upcoming ads' });
  }
});

export default router;
