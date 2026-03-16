import { verifyToken } from '../utils/jwt.js';
import { query } from '../db.js';
import { AppError } from '../utils/errors.js';

const toRad = (deg) => (deg * Math.PI) / 180;
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function getCategoryPricing(category) {
  const DEFAULT_BASE = parseFloat(process.env.DEFAULT_BASE_PRICE || '1000');
  const DEFAULT_PER_KM = parseFloat(process.env.DEFAULT_PER_KM_RATE || '150');
  if (!category) return { basePrice: DEFAULT_BASE, perKmRate: DEFAULT_PER_KM };
  try {
    const r = await query(
      'SELECT base_price, per_km_rate FROM service_categories WHERE lower(name) = lower($1) LIMIT 1',
      [category],
    );
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

async function logJobStatusChange(jobId, oldStatus, newStatus, actor) {
  try {
    await query(
      `INSERT INTO job_status_history (job_id, old_status, new_status, actor_id, actor_role, created_at)
       VALUES ($1,$2,$3,$4,$5,NOW())`,
      [jobId, oldStatus || null, newStatus, actor?.userId || null, actor?.role || null]
    );
  } catch {
    // best-effort audit
  }
}

// In-memory timers for job request expirations: jobRequestId -> timeout
const jobRequestTimers = new Map();

// Keep an in-memory mapping userId -> socketId and socketId -> userId
let ioInstance = null;
const userSocketMap = new Map();
const socketUserMap = new Map();

export function getSocketIdForUser(userId) {
  return userSocketMap.get(userId) || null;
}

export function getUserIdForSocket(socketId) {
  return socketUserMap.get(socketId) || null;
}

export function emitToUser(userId, event, payload) {
  if (!ioInstance) return false;
  const socketId = userSocketMap.get(userId);
  if (!socketId) return false;
  ioInstance.to(socketId).emit(event, payload);
  return true;
}

// Broadcast helper for admin dashboards (best-effort; only connected admins will receive).
export async function emitToAdmins(event, payload) {
  if (!ioInstance) return 0;
  try {
    const res = await query("SELECT id FROM users WHERE role = 'admin'");
    let sent = 0;
    for (const row of res.rows) {
      if (emitToUser(row.id, event, payload)) sent++;
    }
    return sent;
  } catch {
    return 0;
  }
}

export default function initRealtime(io) {
  ioInstance = io;
  io.on('connection', (socket) => {
    // Expect client to authenticate immediately with token
    socket.on('auth:token', (token) => {
      const payload = verifyToken(token);
      if (!payload) {
        socket.emit('auth:failed', { message: 'Invalid token' });
        socket.disconnect(true);
        return;
      }

      const userId = payload.userId;
      userSocketMap.set(userId, socket.id);
      socketUserMap.set(socket.id, userId);
      socket.join(`user:${userId}`);
      socket.emit('auth:ok', { userId });
    });

    socket.on('fundi:location:update', async (data) => {
      const userId = socketUserMap.get(socket.id);
      if (!userId) return;
      // persist location to DB
      const { latitude, longitude, accuracy, online = true } = data || {};
      if (typeof latitude !== 'undefined' && typeof longitude !== 'undefined') {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          await query(
            `INSERT INTO fundi_locations (user_id, latitude, longitude, accuracy, online, updated_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id) DO UPDATE SET
               latitude = EXCLUDED.latitude,
               longitude = EXCLUDED.longitude,
               accuracy = EXCLUDED.accuracy,
               online = EXCLUDED.online,
               updated_at = CURRENT_TIMESTAMP`,
            [userId, lat, lng, accuracy ? parseInt(accuracy) : null, online === false ? false : true]
          ).catch(() => {});

          // Store raw location history for compliance/playback
          await query(
            `INSERT INTO location_history (user_id, job_id, latitude, longitude, accuracy, source, created_at)
             VALUES ($1, NULL, $2, $3, $4, 'socket', NOW())`,
            [userId, lat, lng, accuracy ? parseInt(accuracy) : null]
          ).catch(() => {});

          // find active jobs assigned to this fundi and emit location updates to the customer
          try {
            const jobsRes = await query(
              `SELECT id, customer_id FROM jobs WHERE fundi_id = $1 AND status IN ('accepted','on_the_way','in_progress','matched')`,
              [userId]
            );
            for (const job of jobsRes.rows) {
              await query(
                `INSERT INTO location_history (user_id, job_id, latitude, longitude, accuracy, source, created_at)
                 VALUES ($1, $2, $3, $4, $5, 'socket', NOW())`,
                [userId, job.id, lat, lng, accuracy ? parseInt(accuracy) : null]
              ).catch(() => {});

              emitToUser(job.customer_id, 'fundi:location', {
                jobId: job.id,
                latitude: lat,
                longitude: lng,
                accuracy: accuracy || null,
                timestamp: new Date().toISOString()
              });
            }
          } catch (e) {
            // ignore
          }
        }
      }

      socket.emit('fundi:location:ack', { ok: true });
    });

    // Handle fundi response to job request (accept/reject)
    socket.on('fundi:response', async (payload) => {
      // payload: { jobId, accept: true/false }
      const userId = socketUserMap.get(socket.id);
      if (!userId) return;
      try {
        const { jobId, accept } = payload || {};
        if (!jobId) return;

        // ensure job exists
        const res = await query('SELECT * FROM jobs WHERE id = $1', [jobId]);
        if (res.rows.length === 0) return;
        const job = res.rows[0];

        if (!accept) {
          // Mark the specific job_request as declined for this fundi
          await query(
            `UPDATE job_requests SET status = 'declined' WHERE job_id = $1 AND fundi_id = $2 AND status = 'sent'`,
            [jobId, userId]
          );

          // notify customer that this fundi declined (customer may still be waiting)
          emitToUser(job.customer_id, 'job:request:declined', { jobId, fundiId: userId });
          socket.emit('fundi:response:ok', { jobId, accepted: false });
          return;
        }

        // CRITICAL: Check fundi is verified + subscription is active before accepting
        const fundiVerify = await query(
          'SELECT verification_status, subscription_active, subscription_expires_at FROM fundi_profiles WHERE user_id = $1',
          [userId]
        );
        if (fundiVerify.rows.length === 0) {
          socket.emit('fundi:response:failed', { message: 'Fundi profile not found' });
          return;
        }
        const fp = fundiVerify.rows[0];
        if (fp.verification_status !== 'approved') {
          socket.emit('fundi:response:failed', { message: 'Your account is not yet approved. Please complete verification.' });
          return;
        }
        const subExpired = fp.subscription_expires_at && new Date(fp.subscription_expires_at) < new Date();
        if (!fp.subscription_active || subExpired) {
          socket.emit('fundi:response:failed', { message: 'Active subscription required to accept jobs' });
          return;
        }

        // Check fundi has no other active job
        const active = await query(
          `SELECT id FROM jobs WHERE fundi_id = $1 AND status IN ('accepted','on_the_way','in_progress') LIMIT 1`,
          [userId]
        );
        if (active.rows.length > 0) {
          socket.emit('fundi:response:failed', { message: 'You have another active job' });
          return;
        }

        // Verify there's an active job_request for this fundi and job
        const jrRes = await query(
          `SELECT id, status, expires_at FROM job_requests WHERE job_id = $1 AND fundi_id = $2 LIMIT 1`,
          [jobId, userId]
        );

        if (jrRes.rows.length === 0) {
          socket.emit('fundi:response:failed', { message: 'No active request for this job' });
          return;
        }

        const jr = jrRes.rows[0];
        if (jr.status !== 'sent' || new Date(jr.expires_at) < new Date()) {
          socket.emit('fundi:response:failed', { message: 'Request expired or not available' });
          return;
        }

        // CRITICAL: Check if another fundi already accepted (first-accept-wins lock)
        const accepted = await query(
          'SELECT id FROM job_requests WHERE job_id = $1 AND status = $2 LIMIT 1',
          [jobId, 'accepted']
        );
        if (accepted.rows.length > 0) {
          socket.emit('fundi:response:failed', { message: 'Another fundi already accepted this job' });
          return;
        }

        // Accept: set this job_request to accepted and mark other requests expired
        await query('UPDATE job_requests SET status = $1 WHERE id = $2', ['accepted', jr.id]);
        await query('UPDATE job_requests SET status = $1 WHERE job_id = $2 AND id != $3', ['expired', jobId, jr.id]);

        // Clear timer if any
        const timer = jobRequestTimers.get(jr.id);
        if (timer) {
          clearTimeout(timer);
          jobRequestTimers.delete(jr.id);
        }

        // assign fundi and set job accepted
        await query(
          `UPDATE jobs SET fundi_id = $1, status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [userId, jobId]
        );
        await logJobStatusChange(jobId, job.status, 'accepted', { userId, role: 'fundi' });

        // Distance-based pricing (keep socket accept consistent with HTTP accept endpoint)
        let distanceKm = null;
        let estimatedPrice = null;
        try {
          const jobRowRes = await query(
            'SELECT latitude, longitude, category, estimated_price FROM jobs WHERE id = $1',
            [jobId],
          );
          const jobRow = jobRowRes.rows[0];
          if (jobRow?.latitude != null && jobRow?.longitude != null) {
            const locRes = await query('SELECT latitude, longitude FROM fundi_locations WHERE user_id = $1', [userId]);
            const loc = locRes.rows[0];
            if (loc?.latitude != null && loc?.longitude != null) {
              distanceKm = haversineKm(
                parseFloat(jobRow.latitude),
                parseFloat(jobRow.longitude),
                parseFloat(loc.latitude),
                parseFloat(loc.longitude),
              );
              const { basePrice, perKmRate } = await getCategoryPricing(jobRow.category);
              const priced = computeEstimatedPrice(distanceKm, basePrice, perKmRate);
              estimatedPrice = priced.estimatedPrice;
              await query(
                `UPDATE jobs
                 SET estimated_price = COALESCE(estimated_price, $2),
                     base_price = $3,
                     distance_fee = $4,
                     distance_km = $5,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [jobId, estimatedPrice, basePrice, priced.distanceFee, distanceKm],
              );
            }
          }
          if (estimatedPrice == null && jobRow?.estimated_price != null) {
            const p = parseFloat(jobRow.estimated_price);
            if (!Number.isNaN(p)) estimatedPrice = p;
          }
        } catch {
          // ignore pricing failures; don't block accept
        }

        // notify customer
        emitToUser(job.customer_id, 'job:accepted', { jobId, fundiId: userId, distanceKm, estimatedPrice });
        // ack to fundi
        socket.emit('fundi:response:ok', { jobId, accepted: true });
      } catch (err) {
        console.error('fundi:response error', err);
      }
    });

    // In-app chat (job-scoped)
    socket.on('chat:send', async (payload) => {
      // payload: { jobId, content }
      const userId = socketUserMap.get(socket.id);
      if (!userId) return;
      try {
        const { jobId, content } = payload || {};
        if (!jobId || !content) return;

        // ensure job exists and user is participant
        const jobRes = await query('SELECT customer_id, fundi_id FROM jobs WHERE id = $1', [jobId]);
        if (jobRes.rows.length === 0) return;
        const job = jobRes.rows[0];
        if (job.customer_id !== userId && job.fundi_id !== userId) return;

        const insert = await query(
          `INSERT INTO messages (job_id, sender_id, content, created_at) VALUES ($1,$2,$3,NOW()) RETURNING *`,
          [jobId, userId, content]
        );

        const message = insert.rows[0];

        // emit to the other participant
        const otherId = job.customer_id === userId ? job.fundi_id : job.customer_id;
        if (otherId) emitToUser(otherId, 'chat:message', { jobId, message });
        socket.emit('chat:sent', { ok: true, message });
      } catch (e) {
        console.error('chat:send error', e);
      }
    });

    socket.on('disconnect', () => {
      const userId = socketUserMap.get(socket.id);
      if (userId) {
        userSocketMap.delete(userId);
        socketUserMap.delete(socket.id);
      }
    });
  });
}

export { userSocketMap, socketUserMap };
