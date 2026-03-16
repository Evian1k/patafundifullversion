import './env.js';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'fixit_connect',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Best-effort, non-destructive schema hardening for local dev.
// Prevents runtime errors when the DB exists but is missing newer columns.
async function ensureDbShape() {
  const auto =
    process.env.DB_AUTO_MIGRATE === 'true' ||
    (process.env.DB_AUTO_MIGRATE !== 'false' && process.env.NODE_ENV !== 'production');
  if (!auto) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Only add missing columns we directly read in auth/fundi flows
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fundi_otp_verified BOOLEAN DEFAULT false`);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    // Don't crash the app if this fails; migrations can still be run manually.
    console.error('DB auto-migrate (safe) failed:', err.message);
  } finally {
    client.release();
  }
}

// Fire and forget (logs on failure)
ensureDbShape().catch(() => {});

export const query = (text, params) => pool.query(text, params);

export const getClient = () => pool.connect();

export default pool;
