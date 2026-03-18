import express from 'express';
import { query } from '../db.js';
import { AppError } from '../utils/errors.js';

const router = express.Router();

router.get('/jobs', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT slug, title, department, location, employment_type, description, requirements, status, created_at
       FROM career_jobs
       WHERE status = 'open'
       ORDER BY created_at DESC`,
      []
    );
    res.json({ success: true, jobs: r.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/jobs/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) throw new AppError('Job slug is required', 400);
    const r = await query(
      `SELECT id, slug, title, department, location, employment_type, description, requirements, status, created_at
       FROM career_jobs
       WHERE slug = $1
       LIMIT 1`,
      [slug]
    );
    if (r.rows.length === 0) throw new AppError('Job not found', 404);
    res.json({ success: true, job: r.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.post('/apply', async (req, res, next) => {
  try {
    const { jobSlug, fullName, email, phone, message } = req.body || {};
    const safeFullName = String(fullName || '').trim();
    const safeEmail = String(email || '').trim();
    if (!safeFullName) throw new AppError('Full name is required', 400);
    if (!safeEmail) throw new AppError('Email is required', 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) throw new AppError('Invalid email', 400);

    let jobId = null;
    if (jobSlug) {
      const j = await query(`SELECT id FROM career_jobs WHERE slug = $1 LIMIT 1`, [String(jobSlug).trim()]);
      jobId = j.rows[0]?.id || null;
    }

    const r = await query(
      `INSERT INTO career_applications (job_id, full_name, email, phone, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [jobId, safeFullName, safeEmail, phone ? String(phone).trim().slice(0, 40) : null, message ? String(message).trim() : null]
    );

    res.status(201).json({ success: true, application: r.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;

