import express from 'express';
import { query } from '../db.js';
import { AppError } from '../utils/errors.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10) || 20, 50);
    const r = await query(
      `SELECT slug, title, excerpt, cover_image_url, published_at
       FROM blog_posts
       WHERE status = 'published'
       ORDER BY published_at DESC NULLS LAST, created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ success: true, posts: r.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) throw new AppError('Post slug is required', 400);

    const r = await query(
      `SELECT slug, title, excerpt, content, cover_image_url, published_at
       FROM blog_posts
       WHERE slug = $1 AND status = 'published'
       LIMIT 1`,
      [slug]
    );
    if (r.rows.length === 0) throw new AppError('Post not found', 404);
    res.json({ success: true, post: r.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;

