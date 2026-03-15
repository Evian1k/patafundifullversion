import { verifyToken } from '../utils/jwt.js';
import { query } from '../db.js';
import { AppError } from '../utils/errors.js';

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
          // ensure table exists
          await query(`
            CREATE TABLE IF NOT EXISTS fundi_locations (
              user_id UUID PRIMARY KEY,
              latitude DECIMAL(10,8),
              longitude DECIMAL(11,8),
              accuracy INTEGER,
              online BOOLEAN DEFAULT true,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `).catch(() => {});
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

          // find active jobs assigned to this fundi and emit location updates to the customer
          try {
            const jobsRes = await query(
              `SELECT id, customer_id FROM jobs WHERE fundi_id = $1 AND status IN ('accepted','on_the_way','in_progress','matched')`,
              [userId]
            );
            for (const job of jobsRes.rows) {
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

        // CRITICAL: Check fundi is verified before accepting
        const fundiVerify = await query(
          'SELECT verification_status FROM fundi_profiles WHERE user_id = $1',
          [userId]
        );
        if (fundiVerify.rows.length === 0 || fundiVerify.rows[0].verification_status !== 'approved') {
          socket.emit('fundi:response:failed', { message: 'Your account is not yet approved. Please complete verification.' });
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

        // notify customer
        emitToUser(job.customer_id, 'job:accepted', { jobId, fundiId: userId });
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
