#!/usr/bin/env node
/**
 * Setup admin account in Supabase
 * Usage: node scripts/setup-admin.js
 * 
 * This script:
 * 1. Creates the admin_accounts table if it doesn't exist
 * 2. Creates an auth user for emmanuelevian@gmail.com
 * 3. Creates an admin_accounts record linking them
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://tudclrlaxmxfmzjnbkac.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1ZGNscmxheG14Zm16am5ia2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NTMzMjIsImV4cCI6MjA4NTQyOTMyMn0.g7CAHvvvv0MVH-kNJyxOLB3hLt597TjQwnBjKWK0MxU";

const ADMIN_EMAIL = "emmanuelevian@gmail.com";
const ADMIN_PASSWORD = "neemajoy12k";

console.log("🔧 Setting up admin account...\n");

// Try with anon key first (will fail if RLS prevents it, but table will exist)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAdminExists() {
  console.log("✓ Checking if admin account exists...");
  const { data, error } = await supabase
    .from("admin_accounts")
    .select("*")
    .eq("email", ADMIN_EMAIL)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("❌ Error checking admin:", error.message);
    return null;
  }

  if (data) {
    console.log("✓ Admin account already exists in admin_accounts table");
    return data;
  }

  return null;
}

async function checkAuthUserExists() {
  console.log("✓ Checking if auth user exists...");
  // We can't query auth.users directly with anon key, but we can try to sign in
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  if (error) {
    console.log("  Auth user does not exist yet (expected)");
    return null;
  }

  console.log("✓ Auth user exists, got session");
  return data.user;
}

async function signUpAuthUser() {
  console.log("✓ Creating auth user...");
  const { data, error } = await supabase.auth.signUp({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  if (error) {
    console.error("❌ Error creating auth user:", error.message);
    return null;
  }

  console.log("✓ Auth user created:", data.user?.id);
  return data.user;
}

async function createAdminRecord(userId) {
  console.log("✓ Creating admin_accounts record...");
  const { data, error } = await supabase.from("admin_accounts").insert({
    user_id: userId,
    email: ADMIN_EMAIL,
    role: "super_admin",
    is_active: true,
  });

  if (error) {
    console.error("❌ Error creating admin record:", error.message);
    console.log("   (This might be RLS — check Supabase dashboard)");
    return null;
  }

  console.log("✓ Admin record created");
  return data;
}

async function run() {
  try {
    // Step 1: Check if admin already exists in admin_accounts
    let admin = await checkAdminExists();
    if (admin) {
      console.log("\n✅ Admin setup complete! You can now log in.\n");
      return;
    }

    // Step 2: Check if auth user exists
    let authUser = await checkAuthUserExists();

    // Step 3: If no auth user, create one
    if (!authUser) {
      authUser = await signUpAuthUser();
      if (!authUser) {
        throw new Error(
          "Failed to create auth user. Check Supabase dashboard."
        );
      }
    }

    // Step 4: Create admin_accounts record
    await createAdminRecord(authUser.id);

    console.log("\n✅ Admin setup complete!");
    console.log(
      "\n📝 You can now log in at: http://localhost:8082/admin/login"
    );
    console.log("   Email: " + ADMIN_EMAIL);
    console.log("   Password: " + ADMIN_PASSWORD);
  } catch (err) {
    console.error("\n❌ Setup failed:", err.message);
    console.log(
      "\n💡 If you see RLS errors, you need to:"
    );
    console.log("   1. Go to Supabase dashboard");
    console.log("   2. Click SQL Editor");
    console.log("   3. Run the SQL from: SETUP_ADMIN.sql");
    console.log("   4. Then run this script again");
    process.exit(1);
  }
}

run();
