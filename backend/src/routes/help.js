import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// Help center: categories + FAQs (with optional search)
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const category = (req.query.category || '').toString().trim();

    const categories = await query(
      `SELECT id, slug, title, description, category_order
       FROM faq_categories
       ORDER BY category_order ASC, title ASC`,
      []
    );

    const params = [];
    const where = [];
    if (category) {
      params.push(category);
      where.push(`c.slug = $${params.length}`);
    }
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where.push(`(LOWER(f.question) LIKE $${params.length} OR LOWER(f.answer) LIKE $${params.length})`);
    }

    const faqs = await query(
      `SELECT f.id, f.question, f.answer, f.faq_order, c.slug AS category_slug, c.title AS category_title
       FROM faqs f
       JOIN faq_categories c ON c.id = f.category_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY c.category_order ASC, f.faq_order ASC`,
      params
    );

    res.json({
      success: true,
      query: { q: q || null, category: category || null },
      categories: categories.rows,
      faqs: faqs.rows,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

