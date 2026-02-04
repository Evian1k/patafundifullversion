#!/usr/bin/env node
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fixit_connect',
  user: 'postgres',
  password: 'postgres'
});

(async () => {
  try {
    console.log('\n🧹 Clearing test data...\n');
    
    const r1 = await pool.query('DELETE FROM fundi_profiles');
    console.log(`✅ Deleted ${r1.rowCount} fundi_profiles`);
    
    const r2 = await pool.query('DELETE FROM profiles');
    console.log(`✅ Deleted ${r2.rowCount} profiles`);
    
    const r3 = await pool.query("DELETE FROM users WHERE email LIKE '%e2e%' OR email LIKE '%test%'");
    console.log(`✅ Deleted ${r3.rowCount} test users`);
    
    const result = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`\n📊 Total users remaining: ${result.rows[0].count}\n`);
    
    await pool.end();
  } catch(e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
