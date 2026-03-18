import express from 'express';
import { query } from '../db.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const role = (req.query.role || '').toString().trim().toLowerCase();
    const params = [];
    let where = '';
    if (role) {
      params.push(role);
      where = `WHERE role = $${params.length} OR role = 'all'`;
    }

    const r = await query(
      `SELECT id, role, rule_text, severity_level, created_at
       FROM rules
       ${where}
       ORDER BY severity_level DESC, created_at DESC`,
      params
    );
    res.json({ success: true, rules: r.rows });
  } catch (err) {
    next(err);
  }
});

export default router;

