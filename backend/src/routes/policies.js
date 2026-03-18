import express from 'express';
import { query } from '../db.js';
import { AppError } from '../utils/errors.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

const REQUIRED_FUNDI_POLICY_SLUGS = [
  'terms-of-service',
  'privacy-policy',
  'platform-rules',
  'enforcement-policy',
];

router.get('/required/fundi', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT slug, title, version
       FROM policies
       WHERE slug = ANY($1::text[])
       ORDER BY title ASC`,
      [REQUIRED_FUNDI_POLICY_SLUGS]
    );
    res.json({ success: true, required: r.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/accept', authMiddleware, async (req, res, next) => {
  try {
    const slugs = Array.isArray(req.body?.slugs) ? req.body.slugs.map((s) => String(s).trim()).filter(Boolean) : [];
    if (slugs.length === 0) throw new AppError('Policy slugs are required', 400);

    const policies = await query(
      `SELECT slug, version
       FROM policies
       WHERE slug = ANY($1::text[])`,
      [slugs]
    );

    if (policies.rows.length === 0) throw new AppError('No matching policies found', 404);

    const ip =
      (req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : null) ||
      req.socket?.remoteAddress ||
      null;
    const ua = (req.headers['user-agent'] || '').toString().slice(0, 1000) || null;

    for (const p of policies.rows) {
      await query(
        `INSERT INTO policy_acceptances (user_id, policy_slug, policy_version, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, policy_slug, policy_version) DO NOTHING`,
        [req.user.userId, p.slug, p.version, ip, ua]
      );
    }

    res.json({ success: true, accepted: policies.rows });
  } catch (err) {
    next(err);
  }
});

// List published policies (for footer navigation)
router.get('/', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT slug, title, version, updated_at, published_at
       FROM policies
       WHERE status = 'published'
       ORDER BY title ASC`,
      []
    );
    res.json({ success: true, policies: r.rows });
  } catch (err) {
    next(err);
  }
});

// Get a policy by slug including ordered sections
router.get('/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) throw new AppError('Policy slug is required', 400);

    const p = await query(
      `SELECT id, slug, title, version, status, updated_at, published_at
       FROM policies
       WHERE slug = $1
       LIMIT 1`,
      [slug]
    );
    if (p.rows.length === 0) throw new AppError('Policy not found', 404);
    if (p.rows[0].status !== 'published') throw new AppError('Policy not available', 404);

    const s = await query(
      `SELECT id, title, content, section_order
       FROM policy_sections
       WHERE policy_id = $1
       ORDER BY section_order ASC`,
      [p.rows[0].id]
    );

    res.json({
      success: true,
      policy: {
        ...p.rows[0],
        sections: s.rows.map((row) => ({
          id: row.id,
          title: row.title,
          content: row.content,
          order: row.section_order,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
