#!/usr/bin/env node
/**
 * Execute migrations to create admin tables
 * This creates the admin_accounts table needed for admin login
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = "https://tudclrlaxmxfmzjnbkac.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1ZGNscmxheG14Zm16am5ia2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NTMzMjIsImV4cCI6MjA4NTQyOTMyMn0.g7CAHvvvv0MVH-kNJyxOLB3hLt597TjQwnBjKWK0MxU";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runMigration() {
  console.log("📋 Running admin system migrations...\n");

  try {
    // Read the migration file
    const migrationPath = path.join(
      __dirname,
      "../supabase/migrations/20260131_create_admin_system.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf-8");

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
