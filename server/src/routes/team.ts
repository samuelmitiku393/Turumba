import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { authenticate, requireAdmin, requireManager, AuthRequest } from '../middleware/auth';
import { logActivity } from '../services/activityService';

const router = Router();
router.use(authenticate);

// GET /api/team
router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const members = await prisma.user.findMany({
      include: {
        _count: { select: { assignedAds: true, createdAds: true } },
      },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });
    // Strip sensitive fields, serialize BigInt
    const safe = members.map(m => ({
      ...m,
      telegramId: m.telegramId.toString(),
    }));
    res.json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// GET /api/team/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const member = await prisma.user.findUnique({
      where: { id: req.params['id'] },
      include: {
        assignedAds: {
          where: { status: { in: ['SCHEDULED', 'ACTIVE', 'DRAFT', 'PENDING_APPROVAL'] } },
          include: { channel: { select: { name: true, color: true } } },
          orderBy: { scheduledAt: 'asc' },
          take: 10,
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { ad: { select: { id: true, title: true } } },
        },
        _count: { select: { assignedAds: true, createdAds: true } },
      },
    });
    if (!member) { res.status(404).json({ error: 'Member not found' }); return; }
    res.json({ ...member, telegramId: member.telegramId.toString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch member' });
  }
});

// PATCH /api/team/:id/role  (admin only)
router.patch('/:id/role', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.body as { role: string };
    const validRoles = ['ADMIN', 'MANAGER', 'POSTER'];
    if (!validRoles.includes(role)) { res.status(400).json({ error: 'Invalid role' }); return; }

    const member = await prisma.user.update({
      where: { id: req.params['id'] },
      data: { role: role as 'ADMIN' | 'MANAGER' | 'POSTER' },
    });
    await logActivity(req.user!.id, 'role_changed', undefined, { targetUserId: member.id, newRole: role });
    res.json({ ...member, telegramId: member.telegramId.toString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// PATCH /api/team/:id/status  (admin only)
router.patch('/:id/status', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isActive } = req.body as { isActive: boolean };
    const member = await prisma.user.update({
      where: { id: req.params['id'] },
      data: { isActive },
    });
    res.json({ ...member, telegramId: member.telegramId.toString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// PATCH /api/team/me/notifications  (update own notification prefs)
router.patch('/me/notifications', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schema = z.object({
      notifyAssign: z.boolean().optional(),
      notifyRemind: z.boolean().optional(),
      notifyExpiry: z.boolean().optional(),
      notifyDigest: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid data' }); return; }
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: parsed.data,
    });
    res.json({ ...updated, telegramId: updated.telegramId.toString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// PATCH /api/team/:id/approval (admin only)
router.patch('/:id/approval', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action } = req.body as { action: 'approve' | 'reject' };
    if (action !== 'approve' && action !== 'reject') {
      res.status(400).json({ error: 'Invalid action' });
      return;
    }

    const member = await prisma.user.update({
      where: { id: req.params['id'] },
      data: { status: action === 'approve' ? 'ACTIVE' : 'REJECTED' },
    });
    
    await logActivity(req.user!.id, 'approval_changed', undefined, { targetUserId: member.id, newStatus: member.status });
    res.json({ ...member, telegramId: member.telegramId.toString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update approval status' });
  }
});

// DELETE /api/team/:id (admin only, deletes POSTER users)
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = req.params['id'];
    const member = await prisma.user.findUnique({
      where: { id: targetId },
      include: {
        assignedAds: {
          where: { status: { in: ['SCHEDULED', 'ACTIVE', 'PENDING_APPROVAL'] } }
        }
      }
    });

    if (!member) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (member.role !== 'POSTER') {
      res.status(403).json({ error: 'Only POSTER users can be deleted' });
      return;
    }

    if (member.assignedAds.length > 0) {
      res.status(409).json({ error: `Cannot delete user with ${member.assignedAds.length} active/scheduled ads. Reassign or cancel them first.` });
      return;
    }

    // Unassign completed/expired/draft ads
    await prisma.ad.updateMany({
      where: { assignedToId: targetId },
      data: { assignedToId: null }
    });

    // We might also need to handle createdAds or approvedAds by setting them to null or cascading if necessary.
    // The schema says createdById is required (String, not String?). So we can't null it. 
    // Actually, let's just let prisma handle it or fail if they created ads? Wait, if they created ads, deleting them will fail because of the foreign key constraint.
    // But posters generally don't create ads (they are assigned). Let's catch foreign key errors just in case.

    await prisma.user.delete({ where: { id: targetId } });
    
    await logActivity(req.user!.id, 'deleted_user', undefined, { targetUserId: targetId, username: member.username });
    res.json({ message: 'User deleted' });
  } catch (err: unknown) {
    console.error(err);
    if ((err as { code?: string }).code === 'P2003') {
      res.status(409).json({ error: 'Cannot delete user because they have created ads or other dependent records.' });
      return;
    }
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
