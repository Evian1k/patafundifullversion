#!/usr/bin/env node
import { query } from '../src/db.js';

async function main() {
  const emailFilter = process.argv.find((a) => a.includes('@')) || null;
  if (emailFilter) {
    const one = await query(
      `SELECT id, email, full_name, role, status, email_verified, created_at
       FROM users
       WHERE email = $1`,
      [emailFilter]
    );
    if (one.rows.length === 0) {
      console.log('User not found:', emailFilter);
      return;
    }
    const u = one.rows[0];
    console.log(
      [
        u.email,
        `role=${u.role}`,
        `status=${u.status || 'n/a'}`,
        `verified=${u.email_verified === true}`,
        `created_at=${u.created_at?.toISOString ? u.created_at.toISOString() : u.created_at}`,
      ].join(' | ')
    );
    const fp = await query(
      `SELECT id, verification_status, created_at
       FROM fundi_profiles
       WHERE user_id = $1`,
      [u.id]
    );
    console.log('Fundi profile:', fp.rows[0] || null);
    return;
  }

  const r = await query(
    `SELECT id, email, full_name, role, status, email_verified, created_at
     FROM users
     ORDER BY created_at DESC`
  );

  console.log(`Users: ${r.rows.length}`);
  for (const u of r.rows) {
    console.log(
      [
        u.email,
        `role=${u.role}`,
        `status=${u.status || 'n/a'}`,
        `verified=${u.email_verified === true}`,
        `created_at=${u.created_at?.toISOString ? u.created_at.toISOString() : u.created_at}`,
      ].join(' | ')
    );
  }

  const customers = r.rows.filter((u) => u.role === 'customer').length;
  console.log(`\nCustomers (role='customer'): ${customers}`);
}

main().catch((err) => {
  console.error('debug-users failed:', err.message);
  process.exit(1);
});
