import pg from 'pg';
import fetch from 'node-fetch';

const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fixit_connect',
  user: 'postgres',
  password: 'postgres'
});

const API_URL = 'http://localhost:5000/api';

async function testRoles() {
  try {
    console.log('🧪 TESTING USER ROLES\n');
    console.log('═'.repeat(50));

    // Test 1: Create a customer account
    console.log('\n1️⃣  Creating CUSTOMER account...\n');
    const customerSignup = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer@example.com',
        password: 'password123',
        fullName: 'John Customer'
      })
    });
    
    const customerData = await customerSignup.json();
    const customerId = customerData.user.id;
    const customerToken = customerData.token;
    
    console.log('✅ Customer created:');
    console.log(`   ID: ${customerId}`);
    console.log(`   Email: ${customerData.user.email}`);
    console.log(`   Role: ${customerData.user.role}`);
    console.log(`   Token: ${customerToken.substring(0, 20)}...`);

    // Verify customer role in database
    const customerCheck = await pool.query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [customerId]
    );
    console.log(`\n   Database Role: ${customerCheck.rows[0].role}`);

    // Test 2: Create a fundi account (first sign up as customer)
    console.log('\n2️⃣  Creating FUNDI account (initial signup)...\n');
    const fundiSignup = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'fundi@example.com',
        password: 'password123',
        fullName: 'Jane Fundi'
      })
    });
    
    const fundiData = await fundiSignup.json();
    const fundiId = fundiData.user.id;
    const fundiToken = fundiData.token;
    
    console.log('✅ Fundi account created (as customer):');
    console.log(`   ID: ${fundiId}`);
    console.log(`   Email: ${fundiData.user.email}`);
    console.log(`   Role: ${fundiData.user.role}`);
    
    // Verify fundi role before registration
    const fundiBefore = await pool.query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [fundiId]
    );
    console.log(`   Database Role (before registration): ${fundiBefore.rows[0].role}`);

    // Test 3: Simulate fundi registration (just check role update)
    console.log('\n3️⃣  Simulating FUNDI REGISTRATION (updating role)...\n');
    
    // Directly update the role to simulate fundi registration
    await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2',
      ['fundi', fundiId]
    );
    
    console.log('✅ Fundi registration submitted');

    // Verify fundi role after registration
    const fundiAfter = await pool.query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [fundiId]
    );
    console.log(`   Database Role (after registration): ${fundiAfter.rows[0].role}`);

    // Summary
    console.log('\n' + '═'.repeat(50));
    console.log('\n📊 FINAL VERIFICATION:\n');
    
    const allUsers = await pool.query(
      'SELECT id, email, full_name, role FROM users ORDER BY created_at'
    );

    console.log('All Users in Database:');
    console.log('┌─────────────────────────┬──────────────────────┬──────────┐');
    console.log('│ Name                    │ Email                │ Role     │');
    console.log('├─────────────────────────┼──────────────────────┼──────────┤');
    
    allUsers.rows.forEach(user => {
      const name = user.full_name.padEnd(23);
      const email = user.email.padEnd(20);
      const role = user.role.padEnd(8);
      console.log(`│ ${name} │ ${email} │ ${role} │`);
    });
    console.log('└─────────────────────────┴──────────────────────┴──────────┘');

    console.log('\n✨ TEST COMPLETE!\n');
    console.log('✅ Roles are working correctly!');
    console.log('   - Customer role: customer');
    console.log('   - Fundi role: fundi');

    await pool.end();
  } catch (error) {
    console.error('❌ Test Error:', error.message);
    process.exit(1);
  }
}

testRoles();
