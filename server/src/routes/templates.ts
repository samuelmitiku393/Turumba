import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const templateSchema = z.object({
  name: z.string().min(1).max(200),
  content: z.string().min(1),
  mediaUrls: z.array(z.string().url()).optional().default([]),
  advertiserName: z.string().optional(),
  defaultDuration: z.number().int().min(1).optional().default(7),
});

// GET /api/templates
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const templates = await prisma.template.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(templates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST /api/templates
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() }); return; }

    const template = await prisma.template.create({
      data: parsed.data,
    });
    res.status(201).json(template);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.template.delete({ where: { id: req.params['id'] } });
    res.json({ message: 'Template deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
