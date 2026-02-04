import { io } from 'socket.io-client';
import fetch from 'node-fetch';
import { query } from '../src/db.js';

const API = 'http://localhost:5000/api';

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ email, password })
  });
  return res.json();
}

async function findAssignedJob(fundiUserId) {
  const res = await query(`SELECT id, latitude AS job_lat, longitude AS job_lng, customer_id FROM jobs WHERE fundi_id = $1 AND status IN ('matched','accepted') ORDER BY created_at DESC LIMIT 1`, [fundiUserId]);
  return res.rows[0];
}

async function run() {
  const loginRes = await login('test.fundi@example.com', 'password123');
  if (!loginRes || !loginRes.token) {
    console.error('Fundi login failed', loginRes);
    process.exit(1);
  }
  const token = loginRes.token;
  const userId = loginRes.user.id;

  const job = await findAssignedJob(userId);
  if (!job) {
    console.error('No assigned job found for fundi', userId);
    process.exit(1);
  }

  const socket = io('http://localhost:5000', { transports: ['websocket'] });
  socket.on('connect', () => {
    console.log('Socket connected, sending auth token');
    socket.emit('auth:token', token);
  });

  socket.on('auth:ok', () => {
    console.log('Authenticated as fundi, accepting job', job.id);
    socket.emit('fundi:response', { jobId: job.id, accept: true });

    // Simulate location updates moving towards job location
    let lat = parseFloat(-1.2950);
    let lng = parseFloat(36.8200);
    const targetLat = parseFloat(job.job_lat || -1.2921);
    const targetLng = parseFloat(job.job_lng || 36.8219);

    const steps = 20;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      lat = lat + (targetLat - lat) / (steps - step + 1);
      lng = lng + (targetLng - lng) / (steps - step + 1);
      socket.emit('fundi:location:update', { latitude: lat, longitude: lng, accuracy: 10 });
      console.log('Sent location', lat.toFixed(5), lng.toFixed(5));
      if (step >= steps) {
        clearInterval(interval);
        console.log('Simulation complete');
        setTimeout(() => process.exit(0), 2000);
      }
    }, 2000);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });
}

run().catch(err => { console.error(err); process.exit(1); });
