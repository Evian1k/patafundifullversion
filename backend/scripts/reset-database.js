#!/usr/bin/env node

/**
 * Reset Database Script
 * Drops all tables and recreates the schema
 * Starts the system completely fresh
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔄 Resetting Database...\n');

async function resetDatabase() {
  try {
    console.log('📋 Dropping existing tables...');
    
    // Drop all tables in reverse order of dependencies
    const dropTables = `
      DROP TABLE IF EXISTS admin_action_logs CASCADE;
      DROP TABLE IF EXISTS job_fundis CASCADE;
      DROP TABLE IF EXISTS jobs CASCADE;
      DROP TABLE IF EXISTS fundi_profiles CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `;

    const statements = dropTables.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await db.query(statement);
        console.log('  ✓', statement.trim().substring(0, 40) + '...');
      }
    }

    console.log('\n✅ Tables dropped successfully');
    
    console.log('\n📝 Recreating schema...');
    
    // Now recreate the schema
    await import('../src/db/schema.js');
    
    console.log('✅ Schema created successfully');
    
    console.log('\n🎉 Database reset complete!\n');
    console.log('Status:');
    console.log('  ✓ All tables dropped');
    console.log('  ✓ Fresh schema created');
    console.log('  ✓ Ready for fresh start');
    console.log('\nNext steps:');
    console.log('  1. npm run setup-admin    (Create admin account)');
    console.log('  2. Start your application');
    console.log('  3. Users can register');
    console.log('  4. Admin approves verification');
    console.log('  5. User becomes a fundi\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting database:', error.message);
    process.exit(1);
  }
}

// Start the reset
resetDatabase();
