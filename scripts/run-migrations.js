#!/usr/bin/env node
/**
 * DEPRECATED: This script used Supabase and is no longer needed.
 * 
 * All database migrations should be handled via the backend:
 * 
 * To set up the database:
 *   cd backend && node src/scripts/setup-db.js
 * 
 * The backend now uses PostgreSQL directly without Supabase.
 */

console.log("⚠️  DEPRECATED: This script uses Supabase and is no longer used.");
console.log("");
console.log("To set up the database, run:");
console.log("  cd backend && node src/scripts/setup-db.js");
console.log("");

    // Split into individual statements
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
      console.log(`   ${statement.substring(0, 60)}...`);

      const { error } = await supabase.rpc("exec", {
        sql: statement,
      });

      // Note: RPC approach might not work, let's try a different approach
      // We'll just log success for now
      if (error) {
        console.log(
          `   ⚠️  ${error.message} (this might be OK if table already exists)`
        );
      } else {
        console.log(`   ✓ Done`);
      }
    }

    console.log("\n💡 Migration attempt complete");
    console.log("   Note: Direct SQL execution via client not supported");
    console.log("   You must manually run SETUP_ADMIN.sql in Supabase dashboard");
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

runMigration();
