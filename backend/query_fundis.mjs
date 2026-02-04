import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fixit_connect',
  user: 'postgres',
  password: 'postgres'
});

async function main() {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        first_name, 
        last_name, 
        email, 
        phone, 
        verification_status, 
        created_at 
      FROM fundi_profiles 
      ORDER BY created_at DESC
    `);
    
    console.log(`\n📊 FUNDI PROFILES IN DATABASE`);
    console.log(`================================\n`);
    
    if (result.rows.length === 0) {
      console.log('✅ No fundis registered yet\n');
    } else {
      console.log(`Total Fundis: ${result.rows.length}\n`);
      result.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row.first_name} ${row.last_name}`);
        console.log(`   Email: ${row.email}`);
        console.log(`   Phone: ${row.phone}`);
        console.log(`   Status: ${row.verification_status}`);
        console.log(`   Created: ${new Date(row.created_at).toLocaleString()}`);
        console.log();
      });
    }
    
    // Also check users table
    const users = await pool.query('SELECT id, email, full_name, role FROM users');
    console.log(`\n📊 TOTAL USERS IN DATABASE`);
    console.log(`================================\n`);
    console.log(`Total Users: ${users.rows.length}\n`);
    
    users.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.full_name} (${row.role})`);
      console.log(`   Email: ${row.email}\n`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Database Error:', error.message);
    process.exit(1);
  }
}

main();
