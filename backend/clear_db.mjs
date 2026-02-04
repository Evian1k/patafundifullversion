import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fixit_connect',
  user: 'postgres',
  password: 'postgres'
});

async function clearDatabase() {
  try {
    console.log('🗑️  Clearing all data...\n');
    
    // Delete in order of dependencies
    await pool.query('DELETE FROM fundi_profiles');
    console.log('✅ Deleted all fundi profiles');
    
    await pool.query('DELETE FROM profiles');
    console.log('✅ Deleted all user profiles');
    
    await pool.query('DELETE FROM users');
    console.log('✅ Deleted all users');
    
    console.log('\n✨ Database cleared successfully!\n');
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

clearDatabase();
