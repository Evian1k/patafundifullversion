#!/usr/bin/env node
import { query } from '../src/db.js';
import { hashPassword } from '../src/utils/password.js';
import { v4 as uuidv4 } from 'uuid';

async function setupAdmin() {
  const email = 'emmanuelevian@gmail.com';
  const password = 'emmanuelevian12k@Q';
  const fullName = 'Emmanuel Evian';

  try {
    console.log('🔐 Creating admin account...');
    
    // Hash password
    const passwordHash = await hashPassword(password);

    // Check if already exists
    const existing = await query('SELECT id, role FROM users WHERE email = $1', [email]);
    
    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      if (user.role === 'admin') {
        console.log('✅ Admin user already exists with admin role');
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
        process.exit(0);
      }

      // Update to admin
      const updateResult = await query(
        'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role',
        ['admin', user.id]
      );
      console.log('✅ Updated user to admin role');
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
      console.log(`   User:`, updateResult.rows[0]);
      process.exit(0);
    }

    // Create admin user
    const userId = uuidv4();
    const result = await query(
      `INSERT INTO users (id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, role`,
      [userId, email, passwordHash, fullName, 'admin']
    );

    console.log('✅ Admin user created successfully!');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   User:`, result.rows[0]);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setupAdmin();
