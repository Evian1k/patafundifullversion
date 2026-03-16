#!/usr/bin/env node
/**
 * Clean Slate Script
 * - Removes all user-generated data (users, fundis, jobs, payments, logs, etc.)
 * - Keeps static reference data like service_categories
 * - Does NOT drop schema
 *
 * Usage:
 *   node scripts/clean-all.js --yes
 */

import pool from '../src/db.js';
import fs from 'fs/promises';
import path from 'path';

const TABLES_TO_TRUNCATE = [
  'admin_action_logs',
  'audit_logs',
  'job_status_history',
  'location_history',
  'mpesa_transactions',
  'subscription_payments',
  'otp_codes',
  'password_resets',
  'token_blacklist',
  'reviews',
  'messages',
  'job_bids',
  'job_photos',
  'job_requests',
  'fundi_withdrawals',
  'fundi_wallet_transactions',
  'fundi_wallets',
  'fundi_locations',
  'fundi_verification_evidence',
  'fundi_fraud_logs',
  'fundi_profiles',
  'profiles',
  'payments',
  'jobs',
  'users',
];

async function emptyDir(absDirPath) {
  const stat = await fs.stat(absDirPath).catch(() => null);
  if (!stat || !stat.isDirectory()) return;

  const entries = await fs.readdir(absDirPath, { withFileTypes: true });
  await Promise.all(
    entries.map(async (ent) => {
      const p = path.join(absDirPath, ent.name);
      await fs.rm(p, { recursive: true, force: true });
    })
  );
}

async function main() {
  const yes = process.argv.includes('--yes');
  if (!yes) {
    console.log('⚠️  Refusing to run without confirmation.');
    console.log('Run: node scripts/clean-all.js --yes');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    console.log('🧼 Cleaning database (keeping schema + service categories)...');
    await client.query('BEGIN');
    await client.query(`TRUNCATE TABLE ${TABLES_TO_TRUNCATE.join(', ')} RESTART IDENTITY CASCADE`);
    await client.query('COMMIT');
    console.log('✅ Database cleaned');

    // Clear uploads (keep folder structure)
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    // When run from backend/ directory, uploadsDir points to backend/uploads
    if (path.basename(process.cwd()) !== 'backend') {
      console.log('ℹ️  Not clearing uploads because current directory is not backend/.');
      console.log('   Run from backend/: cd backend && node scripts/clean-all.js --yes');
    } else {
      console.log('🧹 Clearing uploads directory...');
      await emptyDir(uploadsDir);
      console.log('✅ Uploads cleared');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Clean failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    // allow stdout to flush
    setTimeout(() => process.exit(process.exitCode || 0), 50);
  }
}

main();
