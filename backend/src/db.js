import './env.js';
import pg from 'pg';
import { SCHEMA } from './db/schema.js';

const { Pool } = pg;

const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
const DB_SSL = process.env.DB_SSL === 'true' || process.env.PGSSLMODE === 'require';
const ssl =
  DATABASE_URL && DB_SSL
    ? {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
      }
    : undefined;

const pool = new Pool(
  DATABASE_URL
    ? { connectionString: DATABASE_URL, ssl }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'fixit_connect',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        ssl,
      }
);

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
    // 1) Add missing columns we directly read in auth/fundi flows
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fundi_otp_verified BOOLEAN DEFAULT false`);

    // 2) If newer tables (e.g. policies) are missing, ensure the full schema.
    // This is safe in dev because SCHEMA is idempotent (CREATE TABLE IF NOT EXISTS).
    const shapeCheck = await client.query(`SELECT to_regclass('public.policies') AS policies_table`);
    const hasPolicies = Boolean(shapeCheck.rows?.[0]?.policies_table);
    if (!hasPolicies) {
      const statements = SCHEMA.split(';').filter((stmt) => stmt.trim());
      for (const statement of statements) {
        await client.query(statement);
      }
    }
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

async function ensureSchema() {
  if (process.env.DB_AUTO_SETUP !== 'true') return;

  const client = await pool.connect();
  try {
    console.log('🗄️  DB_AUTO_SETUP enabled: ensuring database schema...');
    const statements = SCHEMA.split(';').filter((stmt) => stmt.trim());
    for (const statement of statements) {
      await client.query(statement);
    }
    console.log('✅ Database schema ensured');
  } finally {
    client.release();
  }
}

// If explicitly enabled, ensure the schema exists before handling requests.
// This is useful on hosts where one-off jobs/shell access isn't available.
await ensureSchema();

export const query = (text, params) => pool.query(text, params);

export const getClient = () => pool.connect();

export default pool;
