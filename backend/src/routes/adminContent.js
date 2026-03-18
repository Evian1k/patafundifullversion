import express from 'express';
import { query } from '../db.js';
import { AppError } from '../utils/errors.js';
import { authMiddleware, adminOnly } from '../middlewares/auth.js';

const router = express.Router();

router.use(authMiddleware, adminOnly);

// ---- Support tickets ----
router.get('/support/tickets', async (req, res, next) => {
  try {
    const status = (req.query.status || '').toString().trim();
    const q = (req.query.q || '').toString().trim().toLowerCase();
    const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);

    const params = [];
    const where = [];
    if (status) {
      params.push(status);
      where.push(`t.status = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(LOWER(COALESCE(t.subject,'')) LIKE $${params.length}
        OR LOWER(COALESCE(t.email,'')) LIKE $${params.length}
        OR LOWER(COALESCE(t.name,'')) LIKE $${params.length}
        OR LOWER(t.message) LIKE $${params.length})`);
    }
    params.push(limit);

    const r = await query(
      `SELECT t.id, t.name, t.email, t.subject, t.category, t.priority, t.status, t.created_at, t.updated_at
       FROM support_tickets t
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY
         CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
         t.created_at DESC
       LIMIT $${params.length}`,
      params
    );
    res.json({ success: true, tickets: r.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/support/tickets/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) throw new AppError('Ticket id is required', 400);

    const t = await query(`SELECT * FROM support_tickets WHERE id = $1 LIMIT 1`, [id]);
    if (t.rows.length === 0) throw new AppError('Ticket not found', 404);

    const e = await query(
      `SELECT id, actor_user_id, actor_role, event_type, message, metadata, created_at
       FROM support_ticket_events
       WHERE ticket_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({ success: true, ticket: t.rows[0], events: e.rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/support/tickets/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) throw new AppError('Ticket id is required', 400);

    const { status, priority, note } = req.body || {};
    const updates = [];
    const params = [];
    if (status) {
      params.push(String(status).trim());
      updates.push(`status = $${params.length}`);
    }
    if (priority) {
      params.push(String(priority).trim());
      updates.push(`priority = $${params.length}`);
    }
    params.push(id);

    if (updates.length === 0 && !note) throw new AppError('Nothing to update', 400);

    let ticketRow = null;
    if (updates.length) {
      const r = await query(
        `UPDATE support_tickets SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $${params.length}
         RETURNING *`,
        params
      );
      if (r.rows.length === 0) throw new AppError('Ticket not found', 404);
      ticketRow = r.rows[0];
    } else {
      const r = await query(`SELECT * FROM support_tickets WHERE id = $1 LIMIT 1`, [id]);
      if (r.rows.length === 0) throw new AppError('Ticket not found', 404);
      ticketRow = r.rows[0];
    }

    if (note) {
      await query(
        `INSERT INTO support_ticket_events (ticket_id, actor_user_id, actor_role, event_type, message)
         VALUES ($1, $2, 'admin', 'note', $3)`,
        [id, req.user.userId, String(note).trim()]
      );
    } else if (updates.length) {
      await query(
        `INSERT INTO support_ticket_events (ticket_id, actor_user_id, actor_role, event_type, message, metadata)
         VALUES ($1, $2, 'admin', 'status_change', $3, $4)`,
        [id, req.user.userId, 'Ticket updated', { status: status || null, priority: priority || null }]
      );
    }

    res.json({ success: true, ticket: ticketRow });
  } catch (err) {
    next(err);
  }
});

// ---- Blog ----
router.get('/blog/posts', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT id, slug, title, excerpt, status, published_at, created_at, updated_at
       FROM blog_posts
       ORDER BY created_at DESC`,
      []
    );
    res.json({ success: true, posts: r.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/blog/posts', async (req, res, next) => {
  try {
    const { slug, title, excerpt, content, coverImageUrl, status = 'draft' } = req.body || {};
    const s = String(slug || '').trim();
    const t = String(title || '').trim();
    const c = String(content || '').trim();
    if (!s) throw new AppError('Slug is required', 400);
    if (!t) throw new AppError('Title is required', 400);
    if (!c) throw new AppError('Content is required', 400);

    const r = await query(
      `INSERT INTO blog_posts (slug, title, excerpt, content, cover_image_url, status, published_at, author_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6 = 'published' THEN NOW() ELSE NULL END, $7)
       RETURNING id, slug`,
      [s, t, excerpt ? String(excerpt).trim() : null, c, coverImageUrl ? String(coverImageUrl).trim() : null, String(status).trim(), req.user.userId]
    );
    res.status(201).json({ success: true, post: r.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/blog/posts/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) throw new AppError('Post id is required', 400);

    const { slug, title, excerpt, content, coverImageUrl, status } = req.body || {};
    const updates = [];
    const params = [];
    if (slug) {
      params.push(String(slug).trim());
      updates.push(`slug = $${params.length}`);
    }
    if (title) {
      params.push(String(title).trim());
      updates.push(`title = $${params.length}`);
    }
    if (typeof excerpt !== 'undefined') {
      params.push(excerpt ? String(excerpt).trim() : null);
      updates.push(`excerpt = $${params.length}`);
    }
    if (typeof content !== 'undefined') {
      params.push(content ? String(content).trim() : '');
      updates.push(`content = $${params.length}`);
    }
    if (typeof coverImageUrl !== 'undefined') {
      params.push(coverImageUrl ? String(coverImageUrl).trim() : null);
      updates.push(`cover_image_url = $${params.length}`);
    }
    if (status) {
      params.push(String(status).trim());
      updates.push(`status = $${params.length}`);
      updates.push(`published_at = CASE WHEN $${params.length} = 'published' THEN COALESCE(published_at, NOW()) ELSE published_at END`);
    }
    if (updates.length === 0) throw new AppError('Nothing to update', 400);
    params.push(id);

    const r = await query(
      `UPDATE blog_posts SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length}
       RETURNING id, slug, status, updated_at`,
      params
    );
    if (r.rows.length === 0) throw new AppError('Post not found', 404);
    res.json({ success: true, post: r.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/blog/posts/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) throw new AppError('Post id is required', 400);
    const r = await query(`DELETE FROM blog_posts WHERE id = $1 RETURNING id`, [id]);
    if (r.rows.length === 0) throw new AppError('Post not found', 404);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ---- Policies (admin) ----
router.get('/policies', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT id, slug, title, version, status, updated_at, published_at
       FROM policies
       ORDER BY updated_at DESC`,
      []
    );
    res.json({ success: true, policies: r.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/policies/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) throw new AppError('Policy id is required', 400);
    const p = await query(`SELECT * FROM policies WHERE id = $1 LIMIT 1`, [id]);
    if (p.rows.length === 0) throw new AppError('Policy not found', 404);
    const s = await query(
      `SELECT id, title, content, section_order
       FROM policy_sections
       WHERE policy_id = $1
       ORDER BY section_order ASC`,
      [id]
    );
    res.json({ success: true, policy: p.rows[0], sections: s.rows });
  } catch (err) {
    next(err);
  }
});

router.put('/policies/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) throw new AppError('Policy id is required', 400);
    const { title, version, status } = req.body || {};
    const updates = [];
    const params = [];
    if (title) {
      params.push(String(title).trim());
      updates.push(`title = $${params.length}`);
    }
    if (version) {
      params.push(String(version).trim());
      updates.push(`version = $${params.length}`);
    }
    if (status) {
      params.push(String(status).trim());
      updates.push(`status = $${params.length}`);
      updates.push(`published_at = CASE WHEN $${params.length} = 'published' THEN COALESCE(published_at, NOW()) ELSE published_at END`);
    }
    if (updates.length === 0) throw new AppError('Nothing to update', 400);
    params.push(id);
    const r = await query(
      `UPDATE policies SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length}
       RETURNING *`,
      params
    );
    if (r.rows.length === 0) throw new AppError('Policy not found', 404);
    res.json({ success: true, policy: r.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.post('/policies/:id/sections', async (req, res, next) => {
  try {
    const policyId = String(req.params.id || '').trim();
    if (!policyId) throw new AppError('Policy id is required', 400);
    const { title, content, order } = req.body || {};
    const t = String(title || '').trim();
    const c = String(content || '').trim();
    const o = parseInt(order || '0', 10);
    if (!t) throw new AppError('Title is required', 400);
    if (!c) throw new AppError('Content is required', 400);
    if (!o) throw new AppError('Order is required', 400);

    const r = await query(
      `INSERT INTO policy_sections (policy_id, title, content, section_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [policyId, t, c, o]
    );
    res.status(201).json({ success: true, section: r.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/policy-sections/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) throw new AppError('Section id is required', 400);
    const { title, content, order } = req.body || {};
    const updates = [];
    const params = [];
    if (typeof title !== 'undefined') {
      params.push(title ? String(title).trim() : '');
      updates.push(`title = $${params.length}`);
    }
    if (typeof content !== 'undefined') {
      params.push(content ? String(content).trim() : '');
      updates.push(`content = $${params.length}`);
    }
    if (typeof order !== 'undefined') {
      params.push(parseInt(order, 10));
      updates.push(`section_order = $${params.length}`);
    }
    if (updates.length === 0) throw new AppError('Nothing to update', 400);
    params.push(id);
    const r = await query(
      `UPDATE policy_sections SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length}
       RETURNING id`,
      params
    );
    if (r.rows.length === 0) throw new AppError('Section not found', 404);
    res.json({ success: true, section: r.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/policy-sections/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) throw new AppError('Section id is required', 400);
    const r = await query(`DELETE FROM policy_sections WHERE id = $1 RETURNING id`, [id]);
    if (r.rows.length === 0) throw new AppError('Section not found', 404);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ---- FAQs (admin) ----
router.get('/faqs', async (req, res, next) => {
  try {
    const cats = await query(
      `SELECT id, slug, title, description, category_order FROM faq_categories ORDER BY category_order ASC`,
      []
    );
    const items = await query(
      `SELECT f.id, f.question, f.answer, f.faq_order, c.slug AS category_slug
       FROM faqs f
       JOIN faq_categories c ON c.id = f.category_id
       ORDER BY c.category_order ASC, f.faq_order ASC`,
      []
    );
    res.json({ success: true, categories: cats.rows, faqs: items.rows });
  } catch (err) {
    next(err);
  }
});

export default router;

