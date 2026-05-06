import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { uploadMiddleware } from '../middleware/uploadMiddleware';
import { uploadToCloudinary } from '../services/uploadService';

const router = Router();
router.use(authenticate);

// POST /api/upload  – upload media files
router.post('/', uploadMiddleware.array('files', 5), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }

    const uploadPromises = files.map(file => uploadToCloudinary(file));
    const results = await Promise.all(uploadPromises);
    
    res.json({ files: results });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;
