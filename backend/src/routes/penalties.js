import express from 'express';
import { query } from '../db.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT id, level, description, duration_minutes, action_type, created_at
       FROM penalties
       ORDER BY
         CASE level
           WHEN 'warning' THEN 1
           WHEN 'restriction' THEN 2
           WHEN 'suspension' THEN 3
           WHEN 'ban' THEN 4
           ELSE 99
         END ASC`,
      []
    );
    res.json({ success: true, penalties: r.rows });
  } catch (err) {
    next(err);
  }
});

export default router;

