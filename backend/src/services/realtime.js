import { verifyToken } from '../utils/jwt.js';
import { query } from '../db.js';
import { AppError } from '../utils/errors.js';

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

        // ensure job exists and is assigned to this fundi (or was matched to them)
        const res = await query('SELECT * FROM jobs WHERE id = $1', [jobId]);
        if (res.rows.length === 0) return;
        const job = res.rows[0];

        if (!accept) {
          // mark job as searching again
          await query('UPDATE jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['requested', jobId]);
          // notify customer
          emitToUser(job.customer_id, 'job:rejected', { jobId });
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

        // accept job: set fundi_id and status accepted
        await query(
          `UPDATE jobs SET fundi_id = $1, status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [userId, jobId]
        );

        // notify customer
        emitToUser(job.customer_id, 'job:accepted', { jobId, fundiId: userId });
        // ack to fundi
        socket.emit('fundi:response:ok', { jobId });
      } catch (err) {
        console.error('fundi:response error', err);
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
