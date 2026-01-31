#!/usr/bin/env node
/**
 * Interactive Admin Setup Guide
 * This guides the user through manually creating the admin account in Supabase
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = "https://tudclrlaxmxfmzjnbkac.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1ZGNscmxheG14Zm16am5ia2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NTMzMjIsImV4cCI6MjA4NTQyOTMyMn0.g7CAHvvvv0MVH-kNJyxOLB3hLt597TjQwnBjKWK0MxU";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt) =>
  new Promise((resolve) => rl.question(prompt, resolve));

async function checkAdminExists() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    const { data } = await supabase
      .from("admin_accounts")
      .select("*")
      .limit(1);

    return true; // Table exists
  } catch {
    return false; // Table doesn't exist
  }
}

async function checkAuthUser(email) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    const { data } = await supabase.auth.signInWithPassword({
      email,
      password: "temporary_password_123",
    });

    return data?.user ? true : false;
  } catch {
    return false;
  }
}

async function main() {
  console.log("\n🚀 Admin Account Setup Assistant\n");
  console.log("Project URL: https://tudclrlaxmxfmzjnbkac.supabase.co");
  console.log(
    "For full instructions, see: /home/emmanuel/E/fixit-connect/SETUP_ADMIN.sql\n"
  );

  // Step 1: Check if admin table exists
  console.log("⏳ Checking Supabase status...\n");

  const tableExists = await checkAdminExists();

  if (!tableExists) {
    console.log("❌ admin_accounts table does not exist\n");
    console.log("📝 STEP 1: Create the admin_accounts table\n");
    console.log("1. Go to: https://supabase.com/dashboard/project/tudclrlaxmxfmzjnbkac");
    console.log("2. Click 'SQL Editor' in the left sidebar");
    console.log("3. Click 'New Query'");
    console.log("4. Copy and paste the SQL from:");
    console.log("   /home/emmanuel/E/fixit-connect/supabase/migrations/20260131_create_admin_system.sql");
    console.log("5. Click 'Run' button\n");

    const ready = await question(
      "Press Enter once you've created the table in Supabase..."
    );

    console.log("\n⏳ Verifying table creation...\n");
    const verified = await checkAdminExists();

    if (!verified) {
      console.log("❌ Table still not found. Please check Supabase dashboard.");
      rl.close();
      process.exit(1);
    }

    console.log("✅ Table created successfully!\n");
  } else {
    console.log("✅ admin_accounts table exists\n");
  }

  // Step 2: Check if auth user exists
  console.log("📝 STEP 2: Create the admin user\n");
  console.log("You need to create an auth user in Supabase Auth.\n");
  console.log("Email: emmanuelevian@gmail.com");
  console.log("Password: neemajoy12k\n");
  console.log("1. Go to: https://supabase.com/dashboard/project/tudclrlaxmxfmzjnbkac");
  console.log("2. Click 'Authentication' in the left sidebar");
  console.log("3. Click 'Users' tab");
  console.log("4. Click 'Add user' or 'Create New User'");
  console.log("5. Enter:");
  console.log("   Email: emmanuelevian@gmail.com");
  console.log("   Password: neemajoy12k");
  console.log("6. Click 'Create user'\n");

  const userReady = await question(
    "Press Enter once you've created the auth user..."
  );

  console.log("\n📝 STEP 3: Link auth user to admin_accounts\n");
  console.log("1. In Supabase, go to: SQL Editor");
  console.log("2. Click 'New Query'");
  console.log("3. Run this SQL to find the user_id:");
  console.log("   SELECT id, email FROM auth.users WHERE email='emmanuelevian@gmail.com';\n");
  console.log("4. Copy the UUID from the result");
  console.log("5. Replace USER_ID below and run this query:");
  console.log("   INSERT INTO admin_accounts (user_id, email, role, is_active)");
  console.log("   VALUES ('USER_ID', 'emmanuelevian@gmail.com', 'super_admin', true);\n");

  const linkReady = await question(
    "Press Enter once you've linked the user to admin_accounts..."
  );

  console.log("\n✅ Setup complete!\n");
  console.log("You can now log in at:");
  console.log("  URL: http://localhost:8082/admin/login");
  console.log("  Email: emmanuelevian@gmail.com");
  console.log("  Password: neemajoy12k\n");
  console.log("If you get an error:");
  console.log("  • Verify the user exists: SELECT * FROM auth.users;");
  console.log("  • Verify admin record exists: SELECT * FROM admin_accounts;");
  console.log("  • Check browser console for network errors\n");

  rl.close();
}

main().catch((err) => {
  console.error("Error:", err);
  rl.close();
  process.exit(1);
});
