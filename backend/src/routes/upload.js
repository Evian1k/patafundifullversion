import express from 'express';
import { upload, getFileUrl } from '../services/file.js';
import { AppError } from '../utils/errors.js';

const router = express.Router();

/**
 * Upload file and get URL
 */
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file provided', 400);
    }

    res.json({
      success: true,
      file: {
        url: getFileUrl(req.file.path),
        path: req.file.path.replace(/\\/g, '/'),
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
