import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  host: 'localhost', port: 5432, database: 'fixit_connect',
  user: 'postgres', password: 'postgres'
});

async function verify() {
  try {
    console.log('\n📊 CURRENT DATABASE STATE\n');
    console.log('═'.repeat(60));
    
    // Get all users
    const users = await pool.query('SELECT id, email, full_name, role FROM users ORDER BY created_at');
    
    console.log('\n👥 USERS:\n');
    console.log('┌──────────────────────────┬────────────────────────┬──────────┐');
    console.log('│ Name                     │ Email                  │ Role     │');
    console.log('├──────────────────────────┼────────────────────────┼──────────┤');
    
    users.rows.forEach((user, i) => {
      const idx = (i + 1).toString();
      const name = user.full_name.padEnd(24);
      const email = user.email.padEnd(22);
      const role = user.role;
      console.log(`│ ${name} │ ${email} │ ${role.padEnd(8)} │`);
    });
    console.log('└──────────────────────────┴────────────────────────┴──────────┘');
    
    // Get all fundis
    const fundis = await pool.query('SELECT id, first_name, last_name, email, verification_status FROM fundi_profiles');
    
    console.log(`\n🎯 FUNDI PROFILES: ${fundis.rows.length}\n`);
    if (fundis.rows.length === 0) {
      console.log('   (None yet)\n');
    } else {
      fundis.rows.forEach((fundi, i) => {
        console.log(`${i+1}. ${fundi.first_name} ${fundi.last_name}`);
        console.log(`   Email: ${fundi.email}`);
        console.log(`   Status: ${fundi.verification_status}\n`);
      });
    }
    
    console.log('═'.repeat(60));
    console.log('\n✅ VERIFICATION COMPLETE\n');
    console.log('Key Points:');
    console.log('• Customer role should be: customer');
    console.log('• Fundi role should be: fundi (after registration)\n');
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

verify();
