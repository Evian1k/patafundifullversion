import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { emitToUser } from '../services/realtime.js';
import { upload, getFileUrl } from '../services/file.js';
import { AppError } from '../utils/errors.js';
import { getClient } from '../db.js';
import { authMiddleware, requireRole } from '../middlewares/auth.js';

const router = express.Router();

/**
 * Create job
 */
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const {
      title, description, category,
      location, latitude, longitude,
      estimatedPrice
    } = req.body;

    if (!title || !description || !location) {
      throw new AppError('Title, description, and location are required', 400);
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
        location, latitude ? parseFloat(latitude) : null,
        longitude ? parseFloat(longitude) : null,
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

        // compute distances (Haversine) and pick nearest
        const toRad = (deg) => deg * Math.PI / 180;
        const haversine = (lat1, lon1, lat2, lon2) => {
          const R = 6371; // km
          const dLat = toRad(lat2 - lat1);
          const dLon = toRad(lon2 - lon1);
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          return R * c;
        };

        const jobLat = job.latitude ? parseFloat(job.latitude) : null;
        const jobLng = job.longitude ? parseFloat(job.longitude) : null;

        // Broadcast to nearest fundis in batches
        if (jobLat !== null && jobLng !== null && candidates.rows.length > 0) {
          const scored = [];
          for (const r of candidates.rows) {
            if (r.latitude == null || r.longitude == null) continue;
            const distKm = haversine(jobLat, jobLng, parseFloat(r.latitude), parseFloat(r.longitude));
            scored.push({ user_id: r.user_id, first_name: r.first_name, last_name: r.last_name, skills: r.skills, distKm });
          }

          scored.sort((a,b) => a.distKm - b.distKm);
          const BATCH = parseInt(process.env.JOB_REQUEST_BATCH_SIZE || '5');
          const TIMEOUT_SEC = parseInt(process.env.JOB_REQUEST_TIMEOUT_SEC || '20');
          const targets = scored.slice(0, BATCH);

          if (targets.length > 0) {
            // create job_request records and set job to matching
            await query('UPDATE jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['matching', job.id]);

            const now = new Date();
            const expiresAt = new Date(now.getTime() + TIMEOUT_SEC * 1000);

            for (const t of targets) {
              try {
                await query(
                  `INSERT INTO job_requests (job_id, fundi_id, status, expires_at) VALUES ($1, $2, $3, $4)`,
                  [job.id, t.user_id, 'sent', expiresAt]
                );

                // emit to each candidate with countdown
                emitToUser(t.user_id, 'job:request', {
                  jobId: job.id,
                  title: job.title,
                  description: job.description,
                  location: job.location,
                  latitude: job.latitude,
                  longitude: job.longitude,
                  distanceKm: t.distKm,
                  expiresAt: expiresAt.toISOString()
                });

                // schedule expiration
                setTimeout(async () => {
                  try {
                    // expire this request if still pending
                    await query(`UPDATE job_requests SET status = 'expired' WHERE job_id = $1 AND fundi_id = $2 AND status = 'sent'`, [job.id, t.user_id]);
                    // check if job has been accepted
                    const j = await query('SELECT fundi_id FROM jobs WHERE id = $1', [job.id]);
                    if (j.rows.length > 0 && !j.rows[0].fundi_id) {
                      // no-one accepted yet; if all requests expired, set job back to pending
                      const pendingRes = await query('SELECT COUNT(*) as cnt FROM job_requests WHERE job_id = $1 AND status IN ($2,$3)', [job.id, 'sent', 'pending']);
                      const remaining = parseInt(pendingRes.rows[0].cnt || 0);
                      if (remaining === 0) {
                        await query('UPDATE jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['pending', job.id]);
                        // notify customer no fundis available
                        emitToUser(job.customer_id, 'job:search:failed', { jobId: job.id });
                      }
                    }
                  } catch (e) {
                    console.error('job_request expiration error', e);
                  }
                }, TIMEOUT_SEC * 1000);

              } catch (e) {
                console.error('Failed to create job_request for', t.user_id, e.message);
              }
            }

            // notify customer that matching started
            try {
              emitToUser(job.customer_id, 'job:matching', { jobId: job.id, candidates: targets.map(t => ({ fundiId: t.user_id, distanceKm: t.distKm })) });
            } catch (e) {
              console.error('Failed to emit job:matching to customer', e);
            }
          }
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
});

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
 * Update job status
 */
router.patch('/:jobId/status', authMiddleware, async (req, res, next) => {
  try {
    const { status } = req.body;

    const validStatuses = ['pending', 'matching', 'accepted', 'in_progress', 'completed', 'cancelled'];
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

    // Prevent job actions for unapproved fundis
    if (allowedByFundi) {
      const fp = await query('SELECT verification_status FROM fundi_profiles WHERE user_id = $1', [req.user.userId]);
      if (fp.rows.length === 0 || fp.rows[0].verification_status !== 'approved') {
        throw new AppError('Fundi account not approved to take jobs', 403);
      }
    }

    // Begin transaction for completion workflow
    if (status === 'completed' && job.status !== 'completed') {
      const client = await getClient();
      try {
        await client.query('BEGIN');

        // Determine final price (allow override by customer or fundi via body.finalPrice)
        const finalPrice = req.body.finalPrice ? parseFloat(req.body.finalPrice) : (job.estimated_price ? parseFloat(job.estimated_price) : 0);
        const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '15');
        const platformFee = parseFloat((finalPrice * (PLATFORM_FEE_PERCENT / 100)).toFixed(2));
        const fundiEarnings = parseFloat((finalPrice - platformFee).toFixed(2));

        // Update job pricing and status
        const upd = await client.query(
          `UPDATE jobs SET status = $1, final_price = $2, platform_fee = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *`,
          [status, finalPrice, platformFee, job.id]
        );

        // Insert payment record (assume platform marks as completed for bookkeeping)
        await client.query(
          `INSERT INTO payments (job_id, customer_id, fundi_id, amount, platform_fee, fundi_earnings, payment_status, payment_method, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
          [job.id, job.customer_id, job.fundi_id, finalPrice, platformFee, fundiEarnings, 'completed', 'wallet']
        );

        // Credit fundi wallet
        await client.query(
          `INSERT INTO fundi_wallets (user_id, balance, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (user_id) DO UPDATE SET balance = fundi_wallets.balance + EXCLUDED.balance, updated_at = NOW()`,
          [job.fundi_id, fundiEarnings]
        );

        // Record wallet transaction
        await client.query(
          `INSERT INTO fundi_wallet_transactions (user_id, amount, type, source, job_id, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [job.fundi_id, fundiEarnings, 'credit', 'job', job.id, `Earnings for job ${job.id}`]
        );

        await client.query('COMMIT');

        // Return updated job
        const refreshed = await query('SELECT * FROM jobs WHERE id = $1', [job.id]);
        const updatedJob = refreshed.rows[0];

        res.json({ success: true, job: { id: updatedJob.id, status: updatedJob.status, finalPrice: updatedJob.final_price, platformFee: updatedJob.platform_fee, updatedAt: updatedJob.updated_at } });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      // Simple status update
      const result = await query(
        `UPDATE jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
        [status, req.params.jobId]
      );

      if (result.rows.length === 0) throw new AppError('Job not found', 404);

      const j = result.rows[0];
      res.json({ success: true, job: { id: j.id, status: j.status, updatedAt: j.updated_at } });
    }
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
    const { estimatedPrice } = req.body;
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

    // Mark job as accepted to this fundi
    const updateRes = await query(
      `UPDATE jobs SET fundi_id = $1, status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [userId, jobId]
    );

    // Mark all job_requests for this job as handled
    await query(
      `UPDATE job_requests SET status = 'expired' WHERE job_id = $1 AND fundi_id != $2 AND status = 'sent'`,
      [jobId, userId]
    );

    const acceptedJob = updateRes.rows[0];

    // Notify customer via realtime
    try {
      emitToUser(acceptedJob.customer_id, 'job:accepted', {
        jobId: acceptedJob.id,
        fundiId: userId,
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
        estimatedPrice: acceptedJob.estimated_price,
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
    if (job.status !== 'accepted') {
      throw new AppError(`Cannot check in to job with status: ${job.status}`, 400);
    }

    // Valid statuses
    if (!['on_the_way', 'arrived', 'in_progress'].includes(status)) {
      throw new AppError('Invalid status for check-in', 400);
    }

    // Update job status
    const updateRes = await query(
      `UPDATE jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, jobId]
    );

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
    const platformFee = finalPriceNum * 0.15; // 15% platform commission
    const fundiEarnings = finalPriceNum - platformFee;

    // Update job to completed
    const updateRes = await query(
      `UPDATE jobs SET status = 'completed', final_price = $1, platform_fee = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 RETURNING *`,
      [finalPriceNum, platformFee, jobId]
    );

    const completedJob = updateRes.rows[0];

    // Create payment record
    const paymentRes = await query(
      `INSERT INTO payments (id, job_id, customer_id, fundi_id, amount, platform_fee, fundi_earnings, payment_method, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        uuidv4(), jobId, completedJob.customer_id, userId,
        finalPriceNum, platformFee, fundiEarnings,
        'pending', 'pending'
      ]
    );

    const payment = paymentRes.rows[0];

    // Add to fundi wallet
    await query(
      `INSERT INTO fundi_wallets (user_id, balance) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET balance = fundi_wallets.balance + $2`,
      [userId, fundiEarnings]
    );

    // Log transaction
    await query(
      `INSERT INTO fundi_wallet_transactions (user_id, amount, type, source, job_id, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, fundiEarnings, 'earning', 'job_completion', jobId, `Job completed: ${completedJob.title}`]
    );

    // Notify customer
    try {
      emitToUser(completedJob.customer_id, 'job:completed', {
        jobId,
        message: 'Job completed! Ready for payment confirmation',
        finalPrice: finalPriceNum,
        photos: photoUrls
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
