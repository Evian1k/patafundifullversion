import pool from '../db.js';
import { SCHEMA } from '../db/schema.js';

const setupDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log('🗄️  Setting up database schema...');
    
    // Execute all statements
    const statements = SCHEMA.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await client.query(statement);
      }
    }
    
    console.log('✅ Database schema created successfully');
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
};

setupDatabase();
