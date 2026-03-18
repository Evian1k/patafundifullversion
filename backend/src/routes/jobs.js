import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { emitToUser } from '../services/realtime.js';
import { upload, getFileUrl } from '../services/file.js';
import { AppError } from '../utils/errors.js';
import { getClient } from '../db.js';
import { authMiddleware, requireRole } from '../middlewares/auth.js';
import { generateOtpCode, hashOtp, safeEqual } from '../services/otp.js';
import { sendMail, isEmailConfigured, emailMissingKeys } from '../services/mailer.js';

const router = express.Router();

const toRad = (deg) => (deg * Math.PI) / 180;
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

function parseRadiiKm() {
  const raw = process.env.JOB_SEARCH_RADII_KM || '3,6,10,15';
  const radii = raw
    .split(',')
    .map((s) => parseFloat(String(s).trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  return radii.length ? radii : [3, 6, 10, 15];
}

async function getCategoryPricing(category) {
  const DEFAULT_BASE = parseFloat(process.env.DEFAULT_BASE_PRICE || '1000');
  const DEFAULT_PER_KM = parseFloat(process.env.DEFAULT_PER_KM_RATE || '150');
  if (!category) return { basePrice: DEFAULT_BASE, perKmRate: DEFAULT_PER_KM };
  try {
    // Frontend often sends category ids like "plumbing" while DB stores "Plumbing".
    // Use case-insensitive matching so pricing config actually applies.
    const r = await query('SELECT base_price, per_km_rate FROM service_categories WHERE lower(name) = lower($1) LIMIT 1', [category]);
    const row = r.rows[0];
    return {
      basePrice: row?.base_price != null ? parseFloat(row.base_price) : DEFAULT_BASE,
      perKmRate: row?.per_km_rate != null ? parseFloat(row.per_km_rate) : DEFAULT_PER_KM,
    };
  } catch {
    return { basePrice: DEFAULT_BASE, perKmRate: DEFAULT_PER_KM };
  }
}

function computeEstimatedPrice(distanceKm, basePrice, perKmRate) {
  const includedKm = parseFloat(process.env.PRICE_INCLUDED_KM || '2');
  const billable = Math.max(0, distanceKm - includedKm);
  const distanceFee = parseFloat((billable * perKmRate).toFixed(2));
  const total = parseFloat((basePrice + distanceFee).toFixed(2));
  return { estimatedPrice: total, distanceFee };
}

async function dispatchJobRequests({ job, targets, timeoutSec }) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + timeoutSec * 1000);

  for (const t of targets) {
    try {
      await query(
        `INSERT INTO job_requests (job_id, fundi_id, status, expires_at) VALUES ($1, $2, $3, $4)`,
        [job.id, t.user_id, 'sent', expiresAt],
      );

      emitToUser(t.user_id, 'job:request', {
        jobId: job.id,
        title: job.title,
        description: job.description,
        location: job.location,
        latitude: job.latitude,
        longitude: job.longitude,
        distanceKm: t.distKm,
        estimatedPrice: job.estimated_price,
        expiresAt: expiresAt.toISOString(),
      });

      // expiration timer: when all are expired and still unassigned, expand search
      setTimeout(async () => {
        try {
          await query(
            `UPDATE job_requests SET status = 'expired'
             WHERE job_id = $1 AND fundi_id = $2 AND status = 'sent'`,
            [job.id, t.user_id],
          );

          const j = await query('SELECT id, customer_id, fundi_id FROM jobs WHERE id = $1', [job.id]);
          if (j.rows.length === 0) return;
          if (j.rows[0].fundi_id) return;

          const remaining = await query(
            `SELECT COUNT(*)::int as cnt FROM job_requests WHERE job_id = $1 AND status = 'sent' AND expires_at > NOW()`,
            [job.id],
          );
          if ((remaining.rows[0]?.cnt || 0) === 0) {
            // no active requests -> try expanding
            await expandMatching(job.id);
          }
        } catch (e) {
          console.error('job_request expiration/expand error', e?.message || e);
        }
      }, timeoutSec * 1000);
    } catch (e) {
      console.error('Failed to create job_request for', t.user_id, e.message);
    }
  }
}

async function expandMatching(jobId) {
  const client = await getClient();
  const radii = parseRadiiKm();
  const BATCH = parseInt(process.env.JOB_REQUEST_BATCH_SIZE || '5');
  const TIMEOUT_SEC = parseInt(process.env.JOB_REQUEST_TIMEOUT_SEC || '20');

  try {
    await client.query('BEGIN');
    const jobRes = await client.query('SELECT * FROM jobs WHERE id = $1 FOR UPDATE', [jobId]);
    if (jobRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return;
    }
    const job = jobRes.rows[0];
    if (job.fundi_id) {
      await client.query('ROLLBACK');
      return;
    }

    // If there are still active requests, don't expand.
    const activeReq = await client.query(
      `SELECT COUNT(*)::int as cnt FROM job_requests WHERE job_id = $1 AND status = 'sent' AND expires_at > NOW()`,
      [jobId],
    );
    if ((activeReq.rows[0]?.cnt || 0) > 0) {
      await client.query('ROLLBACK');
      return;
    }

    const jobLat = job.latitude != null ? parseFloat(job.latitude) : null;
    const jobLng = job.longitude != null ? parseFloat(job.longitude) : null;
    if (jobLat == null || jobLng == null) {
      await client.query('ROLLBACK');
      return;
    }

    const tried = await client.query('SELECT DISTINCT fundi_id FROM job_requests WHERE job_id = $1', [jobId]);
    const triedIds = new Set(tried.rows.map((r) => r.fundi_id));

    const candidates = await client.query(
      `SELECT fp.user_id, fp.first_name, fp.last_name, fp.skills, fl.latitude, fl.longitude
       FROM fundi_profiles fp
       JOIN fundi_locations fl ON fl.user_id = fp.user_id
       WHERE fp.verification_status = 'approved' AND fl.online = true`,
    );

    const scored = [];
    for (const r of candidates.rows) {
      if (r.latitude == null || r.longitude == null) continue;
      const distKm = haversineKm(jobLat, jobLng, parseFloat(r.latitude), parseFloat(r.longitude));
      scored.push({ user_id: r.user_id, first_name: r.first_name, last_name: r.last_name, skills: r.skills, distKm });
    }
    scored.sort((a, b) => a.distKm - b.distKm);

    const currentRadius = job.match_radius_km != null ? parseFloat(job.match_radius_km) : 0;
    let chosenRadius = null;
    let targets = [];
    for (const rKm of radii) {
      if (rKm <= currentRadius) continue;
      const eligible = scored.filter((s) => s.distKm <= rKm && !triedIds.has(s.user_id));
      if (eligible.length > 0) {
        chosenRadius = rKm;
        targets = eligible.slice(0, BATCH);
        break;
      }
    }

    if (!chosenRadius || targets.length === 0) {
      // Exhausted all radii: mark back to pending and notify customer.
      const prev = job.status;
      await client.query(`UPDATE jobs SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [jobId]);
      await client.query('COMMIT');
      if (prev !== 'pending') await logJobStatusChange(query, jobId, prev, 'pending', { userId: null, role: 'system' });
      emitToUser(job.customer_id, 'job:search:failed', { jobId });
      return;
    }

    const { basePrice, perKmRate } = await getCategoryPricing(job.category);
    const nearestDist = targets[0]?.distKm || chosenRadius;
    const { estimatedPrice, distanceFee } = computeEstimatedPrice(nearestDist, basePrice, perKmRate);

    const prev = job.status;
    await client.query(
      `UPDATE jobs
       SET status = 'matching',
           match_radius_km = $2,
           match_attempt = COALESCE(match_attempt, 0) + 1,
           estimated_price = $3,
           base_price = $4,
           distance_fee = $5,
           distance_km = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [jobId, chosenRadius, estimatedPrice, basePrice, distanceFee, nearestDist],
    );

    await client.query('COMMIT');

    if (prev !== 'matching') await logJobStatusChange(query, jobId, prev, 'matching', { userId: null, role: 'system' });

    // Re-read job for payloads
    const refreshed = await query('SELECT * FROM jobs WHERE id = $1', [jobId]);
    const j = refreshed.rows[0];

    await dispatchJobRequests({ job: j, targets, timeoutSec: TIMEOUT_SEC });
    emitToUser(j.customer_id, 'job:matching', {
      jobId,
      radiusKm: chosenRadius,
      estimatedPrice: j.estimated_price,
      candidates: targets.map((t) => ({ fundiId: t.user_id, distanceKm: t.distKm })),
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('expandMatching error', e?.message || e);
  } finally {
    client.release();
  }
}

async function logJobStatusChange(clientOrQuery, jobId, oldStatus, newStatus, actor) {
  try {
    const q = typeof clientOrQuery.query === 'function' ? clientOrQuery.query.bind(clientOrQuery) : clientOrQuery;
    await q(
      `INSERT INTO job_status_history (job_id, old_status, new_status, actor_id, actor_role, created_at)
       VALUES ($1,$2,$3,$4,$5,NOW())`,
      [jobId, oldStatus || null, newStatus, actor?.userId || null, actor?.role || null]
    );
  } catch {
    // don't break main flow on audit failures
  }
}

/**
 * Create job
 */
async function handleCreateJob(req, res, next) {
  try {
    const {
      title, description, category,
      location, latitude, longitude,
      estimatedPrice
    } = req.body;

    if (!title || !description || !location) {
      throw new AppError('Title, description, and location are required', 400);
    }

    // GPS is required for matching/tracking. Without coordinates, users see a "location mismatch"
    // (pin defaults), and matching cannot work correctly.
    if (typeof latitude === 'undefined' || typeof longitude === 'undefined' || latitude === null || longitude === null) {
      throw new AppError('GPS coordinates are required. Please capture/select your location on the map.', 400);
    }
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new AppError('Invalid GPS coordinates', 400);
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new AppError('GPS coordinates out of range', 400);
    }

    // Safety setting: if the customer has hidden their profile, don't allow matching.
    // This makes "Hide your profile" actually enforceable server-side.
    try {
      const s = await query('SELECT hide_profile FROM user_settings WHERE user_id = $1', [req.user.userId]);
      if (s.rows[0]?.hide_profile === true) {
        throw new AppError('Your profile is hidden. Turn off "Hide your profile" in Settings to request a job.', 403);
      }
    } catch (e) {
      // If settings table doesn't exist (fresh DB without migrations), don't block job creation.
      if (e instanceof AppError) throw e;
    }

    const jobId = uuidv4();
    const result = await query(
      `INSERT INTO jobs (
        id, customer_id, title, description, category,
        location, latitude, longitude, estimated_price, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
      RETURNING *`,
      [
        jobId, req.user.userId, title, description, category,
        location, lat,
        lng,
        estimatedPrice ? parseFloat(estimatedPrice) : null
      ]
    );
      const job = result.rows[0];

      // Try to match nearby approved fundis
      try {
        // ensure fundi_locations table exists
        await query(`
          CREATE TABLE IF NOT EXISTS fundi_locations (
            user_id UUID PRIMARY KEY,
            latitude DECIMAL(10,8),
            longitude DECIMAL(11,8),
            accuracy INTEGER,
            online BOOLEAN DEFAULT true,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // find approved fundis with recent location and online
        const candidates = await query(
          `SELECT fp.user_id, fp.first_name, fp.last_name, fp.skills, fl.latitude, fl.longitude
           FROM fundi_profiles fp
           JOIN fundi_locations fl ON fl.user_id = fp.user_id
           WHERE fp.verification_status = 'approved' AND fl.online = true
          `
        );

        const jobLat = job.latitude ? parseFloat(job.latitude) : null;
        const jobLng = job.longitude ? parseFloat(job.longitude) : null;

        const radii = parseRadiiKm();
        const { basePrice, perKmRate } = await getCategoryPricing(job.category);

        // Broadcast to fundis within a radius (expand automatically if needed)
        if (jobLat !== null && jobLng !== null && candidates.rows.length > 0) {
          const scored = [];
          for (const r of candidates.rows) {
            if (r.latitude == null || r.longitude == null) continue;
            const distKm = haversineKm(jobLat, jobLng, parseFloat(r.latitude), parseFloat(r.longitude));
            scored.push({ user_id: r.user_id, first_name: r.first_name, last_name: r.last_name, skills: r.skills, distKm });
          }

          scored.sort((a,b) => a.distKm - b.distKm);
          const BATCH = parseInt(process.env.JOB_REQUEST_BATCH_SIZE || '5');
          const TIMEOUT_SEC = parseInt(process.env.JOB_REQUEST_TIMEOUT_SEC || '20');
          let chosenRadius = null;
          let targets = [];
          for (const rKm of radii) {
            const eligible = scored.filter((s) => s.distKm <= rKm);
            if (eligible.length > 0) {
              chosenRadius = rKm;
              targets = eligible.slice(0, BATCH);
              break;
            }
          }

          if (targets.length > 0) {
            const nearestDist = targets[0]?.distKm || (chosenRadius || 0);
            const { estimatedPrice: autoPrice, distanceFee } = computeEstimatedPrice(nearestDist, basePrice, perKmRate);

            // create job_request records and set job to matching
            await query(
              `UPDATE jobs
               SET status = $1,
                   match_radius_km = $2,
                   match_attempt = COALESCE(match_attempt, 0) + 1,
                   estimated_price = COALESCE(estimated_price, $3),
                   base_price = $4,
                   distance_fee = $5,
                   distance_km = $6,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $7`,
              ['matching', chosenRadius, autoPrice, basePrice, distanceFee, nearestDist, job.id],
            );
            await logJobStatusChange(query, job.id, job.status, 'matching', req.user);
            const refreshedForDispatch = await query('SELECT * FROM jobs WHERE id = $1', [job.id]);
            await dispatchJobRequests({ job: refreshedForDispatch.rows[0], targets, timeoutSec: TIMEOUT_SEC });

            // notify customer that matching started
            try {
              const refreshed2 = await query('SELECT estimated_price FROM jobs WHERE id = $1', [job.id]);
              emitToUser(job.customer_id, 'job:matching', {
                jobId: job.id,
                radiusKm: chosenRadius,
                estimatedPrice: refreshed2.rows[0]?.estimated_price || null,
                candidates: targets.map(t => ({ fundiId: t.user_id, distanceKm: t.distKm })),
              });
            } catch (e) {
              console.error('Failed to emit job:matching to customer', e);
            }
          } else {
            emitToUser(job.customer_id, 'job:search:failed', { jobId: job.id });
          }
        } else {
          // No eligible fundis online/approved (or missing GPS) -> notify customer so UI doesn't hang.
          emitToUser(job.customer_id, 'job:search:failed', { jobId: job.id });
        }
      } catch (err) {
        console.error('Matching error:', err);
      }

      // Return created job (status may be requested or matched)
      const refreshed = await query('SELECT * FROM jobs WHERE id = $1', [job.id]);
      const j = refreshed.rows[0];

      res.status(201).json({
        success: true,
        job: {
          id: j.id,
          title: j.title,
          description: j.description,
          category: j.category,
          location: j.location,
          latitude: j.latitude,
          longitude: j.longitude,
          estimatedPrice: j.estimated_price,
          status: j.status,
          fundiId: j.fundi_id,
          createdAt: j.created_at
        }
      });
  } catch (error) {
    next(error);
  }
}

router.post('/', authMiddleware, handleCreateJob);
router.post('/create', authMiddleware, handleCreateJob);

/**
 * Get user's jobs
 */
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT j.*, u.full_name as fundi_name
       FROM jobs j
       LEFT JOIN users u ON u.id = j.fundi_id
       WHERE j.customer_id = $1
       ORDER BY j.created_at DESC`,
      [req.user.userId]
    );

    res.json({
      success: true,
      jobs: result.rows.map(job => ({
        id: job.id,
        title: job.title,
        description: job.description,
        category: job.category,
        location: job.location,
        latitude: job.latitude,
        longitude: job.longitude,
        estimatedPrice: job.estimated_price,
        finalPrice: job.final_price,
        platformFee: job.platform_fee,
        status: job.status,
        fundiName: job.fundi_name,
        createdAt: job.created_at,
        updatedAt: job.updated_at
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get available job requests (fundi only)
 */
router.get('/available', authMiddleware, requireRole('fundi'), async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const result = await query(
      `SELECT jr.job_id, jr.expires_at, jr.created_at,
              j.title, j.description, j.category, j.location, j.latitude, j.longitude, j.estimated_price, j.status
       FROM job_requests jr
       JOIN jobs j ON j.id = jr.job_id
       WHERE jr.fundi_id = $1
         AND jr.status = 'sent'
         AND jr.expires_at > NOW()
       ORDER BY jr.created_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json({ success: true, requests: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * Get currently active job for fundi (accepted/on_the_way/arrived/in_progress)
 */
router.get('/fundi/active', authMiddleware, requireRole('fundi'), async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const r = await query(
      `SELECT j.*, cu.full_name as customer_name, cu.phone as customer_phone, cu.email as customer_email
       FROM jobs j
       JOIN users cu ON cu.id = j.customer_id
       WHERE j.fundi_id = $1
         AND j.status IN ('accepted','on_the_way','arrived','in_progress')
       ORDER BY j.updated_at DESC
       LIMIT 1`,
      [userId]
    );

    if (r.rows.length === 0) {
      return res.json({ success: true, job: null });
    }

    const j = r.rows[0];
    res.json({
      success: true,
      job: {
        id: j.id,
        title: j.title,
        description: j.description,
        category: j.category,
        location: j.location,
        latitude: j.latitude,
        longitude: j.longitude,
        status: j.status,
        estimatedPrice: j.estimated_price,
        customer: {
          id: j.customer_id,
          name: j.customer_name,
          phone: j.customer_phone,
          email: j.customer_email,
        },
        updatedAt: j.updated_at,
        createdAt: j.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get job by ID
 */
router.get('/:jobId', authMiddleware, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT j.*, u.full_name as fundi_name
       FROM jobs j
       LEFT JOIN users u ON u.id = j.fundi_id
       WHERE j.id = $1 AND (j.customer_id = $2 OR j.fundi_id = $2)`,
      [req.params.jobId, req.user.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Job not found', 404);
    }

    const job = result.rows[0];

    res.json({
      success: true,
      job: {
        id: job.id,
        title: job.title,
        description: job.description,
        category: job.category,
        location: job.location,
        latitude: job.latitude,
        longitude: job.longitude,
        estimatedPrice: job.estimated_price,
        finalPrice: job.final_price,
        status: job.status,
        fundiName: job.fundi_name,
        createdAt: job.created_at,
        updatedAt: job.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get job status + history
 */
router.get('/:jobId/status', authMiddleware, async (req, res, next) => {
  try {
    const jobRes = await query(
      `SELECT * FROM jobs WHERE id = $1 AND (customer_id = $2 OR fundi_id = $2)`,
      [req.params.jobId, req.user.userId]
    );
    if (jobRes.rows.length === 0) throw new AppError('Job not found', 404);
    const job = jobRes.rows[0];

    const history = await query(
      `SELECT old_status, new_status, actor_id, actor_role, created_at
       FROM job_status_history
       WHERE job_id = $1
       ORDER BY created_at ASC`,
      [req.params.jobId]
    );

    res.json({
      success: true,
      status: job.status,
      jobId: job.id,
      updatedAt: job.updated_at,
      history: history.rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get live job location (customer/admin view)
 * Returns customer job pin + latest fundi location if assigned.
 */
router.get('/:jobId/location', authMiddleware, async (req, res, next) => {
  try {
    const jobRes = await query(
      `SELECT id, customer_id, fundi_id, latitude, longitude, status
       FROM jobs
       WHERE id = $1 AND (customer_id = $2 OR fundi_id = $2)`,
      [req.params.jobId, req.user.userId]
    );
    if (jobRes.rows.length === 0) throw new AppError('Job not found', 404);
    const job = jobRes.rows[0];

    let fundiLocation = null;
    if (job.fundi_id) {
      const locRes = await query(
        `SELECT latitude, longitude, accuracy, updated_at
         FROM fundi_locations
         WHERE user_id = $1`,
        [job.fundi_id]
      );
      if (locRes.rows.length > 0) {
        fundiLocation = {
          latitude: locRes.rows[0].latitude,
          longitude: locRes.rows[0].longitude,
          accuracy: locRes.rows[0].accuracy,
          updatedAt: locRes.rows[0].updated_at,
        };
      }
    }

    res.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        customerPin: { latitude: job.latitude, longitude: job.longitude },
        fundiId: job.fundi_id,
        fundiLocation,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update job status
 */
router.patch('/:jobId/status', authMiddleware, async (req, res, next) => {
  try {
    const { status } = req.body;

    const validStatuses = ['pending', 'matching', 'accepted', 'on_the_way', 'arrived', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    // Fetch job and permission checks
    const jobRes = await query('SELECT * FROM jobs WHERE id = $1', [req.params.jobId]);
    if (jobRes.rows.length === 0) throw new AppError('Job not found', 404);
    const job = jobRes.rows[0];

    const allowedByCustomer = job.customer_id === req.user.userId;
    const allowedByFundi = job.fundi_id === req.user.userId;

    if (!allowedByCustomer && !allowedByFundi) {
      throw new AppError('Not authorized to change this job', 403);
    }

    // Only allow fundi to update certain statuses, and customer others
    const fundiOnly = ['accepted','on_the_way','in_progress','completed'];
    if (fundiOnly.includes(status) && !allowedByFundi) {
      throw new AppError('Only assigned fundi may update this status', 403);
    }

    if (status === 'cancelled' && allowedByCustomer) {
      if (!['pending', 'matching'].includes(job.status)) {
        throw new AppError('Job can only be cancelled before acceptance', 400);
      }
    }

    // Prevent job actions for unapproved fundis
    if (allowedByFundi) {
      const fp = await query('SELECT verification_status FROM fundi_profiles WHERE user_id = $1', [req.user.userId]);
      if (fp.rows.length === 0 || fp.rows[0].verification_status !== 'approved') {
        throw new AppError('Fundi account not approved to take jobs', 403);
      }
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const finalPrice =
        status === 'completed'
          ? req.body.finalPrice
            ? parseFloat(req.body.finalPrice)
            : job.estimated_price
              ? parseFloat(job.estimated_price)
              : 0
          : job.final_price
            ? parseFloat(job.final_price)
            : null;

      const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '15');
      const platformFee =
        status === 'completed' && finalPrice != null
          ? parseFloat((finalPrice * (PLATFORM_FEE_PERCENT / 100)).toFixed(2))
          : job.platform_fee
            ? parseFloat(job.platform_fee)
            : null;

      const result = await client.query(
        `UPDATE jobs
         SET status = $1,
             final_price = COALESCE($2, final_price),
             platform_fee = COALESCE($3, platform_fee),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [status, finalPrice, platformFee, req.params.jobId]
      );

      if (result.rows.length === 0) throw new AppError('Job not found', 404);
      const j = result.rows[0];
      if (job.status !== j.status) {
        await logJobStatusChange(client, j.id, job.status, j.status, req.user);
      }

      // On completion, ensure a pending payment record exists (wallet credit only happens after confirmed payment)
      if (status === 'completed' && job.status !== 'completed') {
        const amount = finalPrice || 0;
        const pf = platformFee || 0;
        const earnings = parseFloat((amount - pf).toFixed(2));
        const existingPay = await client.query('SELECT id FROM payments WHERE job_id = $1', [j.id]);
        if (existingPay.rows.length === 0) {
          await client.query(
            `INSERT INTO payments (job_id, customer_id, fundi_id, amount, platform_fee, fundi_earnings, payment_status, payment_method, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,'pending',NULL,NOW())`,
            [j.id, j.customer_id, j.fundi_id, amount, pf, earnings]
          );
        }
      }

      await client.query('COMMIT');

      res.json({ success: true, job: { id: j.id, status: j.status, finalPrice: j.final_price, platformFee: j.platform_fee, updatedAt: j.updated_at } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Cancel job (customer only, before acceptance)
 */
router.post('/:jobId/cancel', authMiddleware, async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.userId;
    const { reason } = req.body || {};

    const jobRes = await query('SELECT * FROM jobs WHERE id = $1', [jobId]);
    if (jobRes.rows.length === 0) throw new AppError('Job not found', 404);
    const job = jobRes.rows[0];
    if (job.customer_id !== userId) throw new AppError('Only the customer can cancel this job', 403);
    if (!['pending', 'matching'].includes(job.status)) {
      throw new AppError('Job can only be cancelled before acceptance', 400);
    }

    const update = await query(
      `UPDATE jobs SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [jobId]
    );
    const cancelledJob = update.rows[0];
    await logJobStatusChange(query, jobId, job.status, 'cancelled', req.user);

    // Expire any open requests
    await query(`UPDATE job_requests SET status = 'expired' WHERE job_id = $1 AND status = 'sent'`, [jobId]).catch(() => {});

    // Notify fundis who had the request
    try {
      const reqs = await query(`SELECT fundi_id FROM job_requests WHERE job_id = $1`, [jobId]);
      for (const r of reqs.rows) {
        emitToUser(r.fundi_id, 'job:cancelled', { jobId, reason: reason || null });
      }
    } catch {
      // ignore
    }

    res.json({ success: true, message: 'Job cancelled', job: { id: cancelledJob.id, status: cancelledJob.status } });
  } catch (error) {
    next(error);
  }
});

/**
 * Upload job photo
 */
router.post('/:jobId/photos', authMiddleware, upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('Photo is required', 400);
    }

    const { photoType = 'before' } = req.body;

    // Verify job exists and user has access
    const jobCheck = await query(
      'SELECT id FROM jobs WHERE id = $1 AND (customer_id = $2 OR fundi_id = $2)',
      [req.params.jobId, req.user.userId]
    );

    if (jobCheck.rows.length === 0) {
      throw new AppError('Job not found', 404);
    }

    const photoId = uuidv4();
    const result = await query(
      `INSERT INTO job_photos (id, job_id, photo_url, photo_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [photoId, req.params.jobId, req.file.path.replace(/\\/g, '/'), photoType, req.user.userId]
    );

    const photo = result.rows[0];

    res.status(201).json({
      success: true,
      photo: {
        id: photo.id,
        photoUrl: getFileUrl(photo.photo_url),
        photoType: photo.photo_type,
        createdAt: photo.created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get job photos
 */
router.get('/:jobId/photos', authMiddleware, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT jp.* FROM job_photos jp
       JOIN jobs j ON j.id = jp.job_id
       WHERE jp.job_id = $1 AND (j.customer_id = $2 OR j.fundi_id = $2)
       ORDER BY jp.created_at ASC`,
      [req.params.jobId, req.user.userId]
    );

    res.json({
      success: true,
      photos: result.rows.map(photo => ({
        id: photo.id,
        photoUrl: getFileUrl(photo.photo_url),
        photoType: photo.photo_type,
        createdAt: photo.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Fundi accepts a job (from job request)
 */
router.post('/:jobId/accept', authMiddleware, async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.userId;

    // Verify job exists and is still pending/matching
    const jobRes = await query('SELECT * FROM jobs WHERE id = $1', [jobId]);
    if (jobRes.rows.length === 0) {
      throw new AppError('Job not found', 404);
    }
    const job = jobRes.rows[0];
    if (job.status !== 'pending' && job.status !== 'matching') {
      throw new AppError(`Job is not available (status: ${job.status})`, 400);
    }

    // Verify fundi is approved and subscription is active
    const fundiRes = await query(
      'SELECT * FROM fundi_profiles WHERE user_id = $1',
      [userId]
    );
    if (fundiRes.rows.length === 0) {
      throw new AppError('Fundi profile not found', 404);
    }
    const fundi = fundiRes.rows[0];
    if (fundi.verification_status !== 'approved') {
      throw new AppError('Fundi not approved for job acceptance', 403);
    }
    if (!fundi.subscription_active || (fundi.subscription_expires_at && new Date(fundi.subscription_expires_at) < new Date())) {
      throw new AppError('Fundi subscription expired or inactive', 403);
    }

    // First-accept-wins lock (atomic)
    const updateRes = await query(
      `UPDATE jobs
       SET fundi_id = $1, status = 'accepted', updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND fundi_id IS NULL AND status IN ('pending','matching')
       RETURNING *`,
      [userId, jobId]
    );
    if (updateRes.rows.length === 0) {
      throw new AppError('Job already accepted by another fundi', 409);
    }

    // Mark all job_requests for this job as handled
    await query(
      `UPDATE job_requests SET status = 'expired' WHERE job_id = $1 AND fundi_id != $2 AND status = 'sent'`,
      [jobId, userId]
    );

    const acceptedJob = updateRes.rows[0];
    await logJobStatusChange(query, acceptedJob.id, job.status, 'accepted', req.user);

    // Distance-based pricing: compute estimate using fundi distance (auto, not mock)
    let distanceKm = null;
    let estimatedPriceAuto = acceptedJob.estimated_price != null ? parseFloat(acceptedJob.estimated_price) : null;
    try {
      const jobLat = acceptedJob.latitude != null ? parseFloat(acceptedJob.latitude) : null;
      const jobLng = acceptedJob.longitude != null ? parseFloat(acceptedJob.longitude) : null;
      if (jobLat != null && jobLng != null) {
        const loc = await query('SELECT latitude, longitude FROM fundi_locations WHERE user_id = $1', [userId]);
        if (loc.rows.length > 0 && loc.rows[0].latitude != null && loc.rows[0].longitude != null) {
          distanceKm = haversineKm(jobLat, jobLng, parseFloat(loc.rows[0].latitude), parseFloat(loc.rows[0].longitude));
          const { basePrice, perKmRate } = await getCategoryPricing(acceptedJob.category);
          const { estimatedPrice, distanceFee } = computeEstimatedPrice(distanceKm, basePrice, perKmRate);
          estimatedPriceAuto = estimatedPrice;
          await query(
            `UPDATE jobs
             SET estimated_price = COALESCE(estimated_price, $2),
                 base_price = $3,
                 distance_fee = $4,
                 distance_km = $5,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [jobId, estimatedPrice, basePrice, distanceFee, distanceKm],
          );
        }
      }
    } catch {
      // ignore pricing failures (won't block acceptance)
    }

    // Notify customer via realtime
    try {
      emitToUser(acceptedJob.customer_id, 'job:accepted', {
        jobId: acceptedJob.id,
        fundiId: userId,
        distanceKm,
        estimatedPrice: estimatedPriceAuto,
        message: `${fundi.first_name} ${fundi.last_name} accepted your job`
      });
    } catch (err) {
      console.error('Error notifying customer:', err.message);
    }

    res.json({
      success: true,
      message: 'Job accepted successfully',
      job: {
        id: acceptedJob.id,
        title: acceptedJob.title,
        description: acceptedJob.description,
        location: acceptedJob.location,
        latitude: acceptedJob.latitude,
        longitude: acceptedJob.longitude,
        status: acceptedJob.status,
        fundiId: acceptedJob.fundi_id,
        estimatedPrice: estimatedPriceAuto,
        distanceKm,
        createdAt: acceptedJob.created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Fundi checks in to job (marks as on-the-way or arrived)
 */
router.post('/:jobId/check-in', authMiddleware, async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { latitude, longitude, status = 'on_the_way' } = req.body;
    const userId = req.user.userId;

    // Verify job exists and is assigned to this fundi
    const jobRes = await query('SELECT * FROM jobs WHERE id = $1', [jobId]);
    if (jobRes.rows.length === 0) {
      throw new AppError('Job not found', 404);
    }
    const job = jobRes.rows[0];
    if (job.fundi_id !== userId) {
      throw new AppError('This job is not assigned to you', 403);
    }
    // Allow step-by-step transitions:
    // accepted -> on_the_way -> arrived -> in_progress
    const allowedTransitions = {
      accepted: ['on_the_way'],
      on_the_way: ['arrived'],
      arrived: ['in_progress'],
    };
    const allowedNext = allowedTransitions[job.status] || [];
    if (!allowedNext.includes(status)) {
      throw new AppError(`Cannot update job from ${job.status} to ${status}`, 400);
    }

    // Valid statuses
    if (!['on_the_way', 'arrived', 'in_progress'].includes(status)) {
      throw new AppError('Invalid status for check-in', 400);
    }

    // If arriving, verify proximity to customer (anti-cheat / correctness)
    if (status === 'arrived') {
      const lat = latitude != null ? parseFloat(latitude) : null;
      const lng = longitude != null ? parseFloat(longitude) : null;
      if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
        throw new AppError('Valid GPS coordinates are required to confirm arrival', 400);
      }
      if (job.latitude != null && job.longitude != null) {
        const jobLat = parseFloat(job.latitude);
        const jobLng = parseFloat(job.longitude);
        const distKm = haversineKm(jobLat, jobLng, lat, lng);
        const maxMeters = process.env.ARRIVAL_MAX_DISTANCE_METERS
          ? parseInt(process.env.ARRIVAL_MAX_DISTANCE_METERS, 10)
          : 150;
        const distMeters = Math.round(distKm * 1000);
        if (distMeters > maxMeters) {
          throw new AppError(`You are too far from the customer location (${distMeters}m > ${maxMeters}m)`, 400);
        }
      }
    }

    // Update job status
    const updateRes = await query(
      `UPDATE jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, jobId]
    );
    await logJobStatusChange(query, jobId, job.status, status, req.user);

    // Update fundi location
    if (latitude && longitude) {
      await query(
        `INSERT INTO fundi_locations (user_id, latitude, longitude, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE SET latitude = $2, longitude = $3, updated_at = CURRENT_TIMESTAMP`,
        [userId, latitude, longitude]
      );
    }

    const updatedJob = updateRes.rows[0];

    // Notify customer
    try {
      emitToUser(updatedJob.customer_id, 'job:fundi-checkin', {
        jobId,
        status,
        latitude,
        longitude
      });
      // Generic status event for UIs
      emitToUser(updatedJob.customer_id, 'job:status', { jobId, status });
      emitToUser(userId, 'job:status', { jobId, status });
    } catch (err) {
      console.error('Error notifying customer of check-in:', err.message);
    }

    res.json({
      success: true,
      message: `Checked in as ${status}`,
      job: {
        id: updatedJob.id,
        status: updatedJob.status,
        fundiId: updatedJob.fundi_id
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Fundi completes job (triggers payment processing)
 */
router.post('/:jobId/complete', authMiddleware, upload.array('photos', 5), async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { finalPrice, notes } = req.body;
    const userId = req.user.userId;

    if (!finalPrice) {
      throw new AppError('Final price is required', 400);
    }

    // Verify job exists and is assigned to this fundi
    const jobRes = await query('SELECT * FROM jobs WHERE id = $1', [jobId]);
    if (jobRes.rows.length === 0) {
      throw new AppError('Job not found', 404);
    }
    const job = jobRes.rows[0];
    if (job.fundi_id !== userId) {
      throw new AppError('This job is not assigned to you', 403);
    }
    if (!['on_the_way', 'in_progress'].includes(job.status)) {
      throw new AppError(`Cannot complete job with status: ${job.status}`, 400);
    }

    // Upload completion photos if provided
    const photoUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const photoRes = await query(
          `INSERT INTO job_photos (job_id, photo_url, photo_type, uploaded_by)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [jobId, file.filename, 'after', userId]
        );
        if (photoRes.rows[0]) {
          photoUrls.push(getFileUrl(photoRes.rows[0].photo_url));
        }
      }
    }

    const finalPriceNum = parseFloat(finalPrice);
    const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '15');
    const platformFee = parseFloat((finalPriceNum * (PLATFORM_FEE_PERCENT / 100)).toFixed(2));
    const fundiEarnings = parseFloat((finalPriceNum - platformFee).toFixed(2));

    // Update job to completed
    const updateRes = await query(
      `UPDATE jobs SET status = 'completed', final_price = $1, platform_fee = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 RETURNING *`,
      [finalPriceNum, platformFee, jobId]
    );

    const completedJob = updateRes.rows[0];
    await logJobStatusChange(query, jobId, job.status, 'completed', req.user);

    // Create or update payment record (one per job)
    let payment;
    const existingPay = await query('SELECT * FROM payments WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1', [jobId]);
    if (existingPay.rows.length > 0) {
      const p = existingPay.rows[0];
      const upd = await query(
        `UPDATE payments
         SET amount = $1, platform_fee = $2, fundi_earnings = $3
         WHERE id = $4
         RETURNING *`,
        [finalPriceNum, platformFee, fundiEarnings, p.id]
      );
      payment = upd.rows[0];
    } else {
      const paymentRes = await query(
        `INSERT INTO payments (id, job_id, customer_id, fundi_id, amount, platform_fee, fundi_earnings, payment_method, payment_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          uuidv4(), jobId, completedJob.customer_id, userId,
          finalPriceNum, platformFee, fundiEarnings,
          null, 'pending'
        ]
      );
      payment = paymentRes.rows[0];
    }

    // Mark job as needing customer OTP confirmation before payment
    await query(
      `UPDATE jobs SET customer_completion_confirmed = false, customer_completion_confirmed_at = NULL WHERE id = $1`,
      [jobId]
    ).catch(() => {});

    // Send completion OTP to customer (email)
    try {
      const custRes = await query('SELECT email FROM users WHERE id = $1', [completedJob.customer_id]);
      const customerEmail = custRes.rows[0]?.email;
      if (customerEmail) {
        if (!isEmailConfigured()) {
          throw new Error(`Email delivery is not configured (missing: ${emailMissingKeys().join(', ')})`);
        }
        const code = generateOtpCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const codeHash = hashOtp(code, customerEmail, `job_complete:${jobId}`);
        await query(
          `INSERT INTO otp_codes (user_id, destination, channel, purpose, code_hash, expires_at)
           VALUES ($1, $2, 'email', $3, $4, $5)`,
          [completedJob.customer_id, customerEmail, `job_complete:${jobId}`, codeHash, expiresAt]
        );

        const subject = 'FixIt Connect: Confirm Job Completion';
        const text = `Your job completion OTP is ${code}. It expires in 10 minutes. Job ID: ${jobId}`;
        const html = `<p>Your job completion OTP is <strong>${code}</strong>. It expires in 10 minutes.</p><p>Job ID: <code>${jobId}</code></p>`;
        await sendMail(customerEmail, subject, text, html);
      }
    } catch (e) {
      console.error('Failed to send job completion OTP:', e.message);
    }

    // Notify customer
    try {
      emitToUser(completedJob.customer_id, 'job:completed', {
        jobId,
        message: 'Job completed! Enter the OTP sent to your email to confirm, then pay.',
        finalPrice: finalPriceNum,
        photos: photoUrls,
        requiresOtp: true,
      });
    } catch (err) {
      console.error('Error notifying customer of completion:', err.message);
    }

    res.status(201).json({
      success: true,
      message: 'Job completed successfully',
      job: {
        id: completedJob.id,
        status: completedJob.status,
        finalPrice: completedJob.final_price,
        fundiEarnings,
        platformFee
      },
      payment: {
        id: payment.id,
        amount: payment.amount,
        fundi_earnings: payment.fundi_earnings,
        status: payment.payment_status
      },
      photos: photoUrls
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Customer confirms job completion with OTP (required before payment)
 */
router.post('/:jobId/confirm-completion', authMiddleware, async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { code } = req.body || {};
    if (!code) throw new AppError('OTP code is required', 400);

    const jobRes = await query('SELECT * FROM jobs WHERE id = $1', [jobId]);
    if (jobRes.rows.length === 0) throw new AppError('Job not found', 404);
    const job = jobRes.rows[0];
    if (job.customer_id !== req.user.userId) throw new AppError('Only the customer can confirm completion', 403);
    if (job.status !== 'completed') throw new AppError('Job must be completed first', 400);
    if (job.customer_completion_confirmed) {
      return res.json({ success: true, message: 'Already confirmed' });
    }

    const userRes = await query('SELECT email FROM users WHERE id = $1', [req.user.userId]);
    const email = userRes.rows[0]?.email;
    if (!email) throw new AppError('No email on account', 400);

    const otpRes = await query(
      `SELECT * FROM otp_codes
       WHERE user_id = $1 AND purpose = $2 AND used = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user.userId, `job_complete:${jobId}`]
    );
    if (otpRes.rows.length === 0) throw new AppError('OTP not found', 400);
    const otp = otpRes.rows[0];
    if (new Date(otp.expires_at) < new Date()) throw new AppError('OTP expired', 400);
    if ((otp.attempts || 0) >= 5) throw new AppError('Too many attempts', 429);

    const expected = hashOtp(String(code), otp.destination, otp.purpose);
    await query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [otp.id]).catch(() => {});
    if (!safeEqual(expected, otp.code_hash)) throw new AppError('Invalid OTP', 400);

    await query('UPDATE otp_codes SET used = true WHERE id = $1', [otp.id]);
    await query(
      `UPDATE jobs
       SET customer_completion_confirmed = true,
           customer_completion_confirmed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [jobId]
    );

    // Notify fundi
    try {
      if (job.fundi_id) emitToUser(job.fundi_id, 'job:completion:confirmed', { jobId });
    } catch {
      // ignore
    }

    res.json({ success: true, message: 'Completion confirmed' });
  } catch (error) {
    next(error);
  }
});

/**
 * Get job earnings for fundi
 */
router.get('/earnings/summary', authMiddleware, requireRole('fundi'), async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Current balance
    const walletRes = await query('SELECT balance FROM fundi_wallets WHERE user_id = $1', [userId]);
    const totalEarnings = walletRes.rows.length > 0 ? parseFloat(walletRes.rows[0].balance) : 0;

    // This month earnings
    const thisMonthRes = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM fundi_wallet_transactions
       WHERE user_id = $1 AND type = 'earning' 
       AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`,
      [userId]
    );
    const thisMonth = parseFloat(thisMonthRes.rows[0].total) || 0;

    // Pending payments
    const pendingRes = await query(
      `SELECT COALESCE(SUM(fundi_earnings), 0) as total FROM payments
       WHERE fundi_id = $1 AND payment_status = 'pending'`,
      [userId]
    );
    const pending = parseFloat(pendingRes.rows[0].total) || 0;

    // Recent transactions
    const transactionsRes = await query(
      `SELECT * FROM fundi_wallet_transactions
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [userId]
    );

    res.json({
      success: true,
      earnings: {
        totalEarnings,
        thisMonth,
        pending,
        transactions: transactionsRes.rows.map(t => ({
          id: t.id,
          amount: parseFloat(t.amount),
          type: t.type,
          source: t.source,
          description: t.description,
          createdAt: t.created_at
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
