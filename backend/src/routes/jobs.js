import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { emitToUser } from '../services/realtime.js';
import { upload, getFileUrl } from '../services/file.js';
import { AppError } from '../utils/errors.js';

const router = express.Router();

/**
 * Create job
 */
router.post('/', async (req, res, next) => {
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

        let nearest = null;
        if (jobLat !== null && jobLng !== null && candidates.rows.length > 0) {
          for (const r of candidates.rows) {
            if (r.latitude == null || r.longitude == null) continue;
            const distKm = haversine(jobLat, jobLng, parseFloat(r.latitude), parseFloat(r.longitude));
            if (!nearest || distKm < nearest.distKm) {
              nearest = { ...r, distKm };
            }
          }
        }

        if (nearest) {
          // assign fundi and update job status to matched
          await query(
            `UPDATE jobs SET fundi_id = $1, status = 'matched', updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [nearest.user_id, job.id]
          );

          // notify fundi via realtime socket
          emitToUser(nearest.user_id, 'job:request', {
            jobId: job.id,
            title: job.title,
            description: job.description,
            location: job.location,
            latitude: job.latitude,
            longitude: job.longitude
          });

          // notify customer that a fundi was matched
          try {
            emitToUser(job.customer_id, 'job:matched', {
              jobId: job.id,
              fundiId: nearest.user_id,
              distanceKm: nearest.distKm,
            });
          } catch (e) {
            console.error('Failed to emit job:matched to customer', e);
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
router.get('/', async (req, res, next) => {
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
router.get('/:jobId', async (req, res, next) => {
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
router.patch('/:jobId/status', async (req, res, next) => {
  try {
    const { status } = req.body;

    const validStatuses = ['pending', 'matching', 'accepted', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    const result = await query(
      `UPDATE jobs SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND customer_id = $3
       RETURNING *`,
      [status, req.params.jobId, req.user.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Job not found', 404);
    }

    const job = result.rows[0];

    res.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        updatedAt: job.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Upload job photo
 */
router.post('/:jobId/photos', upload.single('photo'), async (req, res, next) => {
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
router.get('/:jobId/photos', async (req, res, next) => {
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

export default router;
