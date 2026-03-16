#!/usr/bin/env node
/**
 * Clean Non-Admin Script
 * - Deletes all customers + fundis (keeps admin user(s))
 * - Truncates user-generated tables (jobs, fundi profiles, logs, OTPs, etc.)
 * - Clears backend/uploads
 *
 * Usage:
 *   node scripts/clean-non-admin.js --yes
 */

import pool, { query } from '../src/db.js';
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
  // NOTE: do NOT truncate users here (we keep admins)
];

async function emptyDir(absDirPath) {
  const stat = await fs.stat(absDirPath).catch(() => null);
  if (!stat || !stat.isDirectory()) return;
  const entries = await fs.readdir(absDirPath, { withFileTypes: true });
  await Promise.all(entries.map((ent) => fs.rm(path.join(absDirPath, ent.name), { recursive: true, force: true })));
}

async function main() {
  const yes = process.argv.includes('--yes');
  if (!yes) {
    console.log('⚠️  Refusing to run without confirmation.');
    console.log('Run: node scripts/clean-non-admin.js --yes');
    process.exit(1);
  }

  // Determine which user(s) are admin
  const adminsRes = await query(`SELECT id, email FROM users WHERE role = 'admin'`);
  const adminIds = adminsRes.rows.map((r) => r.id);
  if (adminIds.length === 0) {
    console.log('❌ No admin users found. Aborting to avoid locking you out.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    console.log(`🧼 Cleaning DB (keeping ${adminIds.length} admin user(s))...`);
    await client.query('BEGIN');

    await client.query(`TRUNCATE TABLE ${TABLES_TO_TRUNCATE.join(', ')} RESTART IDENTITY CASCADE`);

    // Delete all non-admin users
    await client.query(`DELETE FROM users WHERE role <> 'admin'`);

    await client.query('COMMIT');
    console.log('✅ Non-admin users deleted and related tables cleaned');

    // Clear uploads (keep folder structure)
    if (path.basename(process.cwd()) !== 'backend') {
      console.log('ℹ️  Not clearing uploads because current directory is not backend/.');
      console.log('   Run from backend/: cd backend && node scripts/clean-non-admin.js --yes');
    } else {
      console.log('🧹 Clearing uploads directory...');
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      await emptyDir(uploadsDir);
      console.log('✅ Uploads cleared');
    }

    console.log('\nAdmins kept:');
    adminsRes.rows.forEach((a) => console.log(`- ${a.email}`));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Clean failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    setTimeout(() => process.exit(process.exitCode || 0), 50);
  }
}

main().catch((err) => {
  console.error('❌ Clean failed:', err.message);
  process.exit(1);
});

