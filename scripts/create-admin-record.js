#!/usr/bin/env node
/**
 * Create admin record in admin_accounts table
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://tudclrlaxmxfmzjnbkac.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1ZGNscmxheG14Zm16am5ia2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NTMzMjIsImV4cCI6MjA4NTQyOTMyMn0.g7CAHvvvv0MVH-kNJyxOLB3hLt597TjQwnBjKWK0MxU";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_EMAIL = "emmanuelevian@gmail.com";
const ADMIN_PASSWORD = "neemajoy12k";

async function main() {
  try {
    console.log("1️⃣  Getting auth user ID...");
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      });

    if (authError) {
      console.error("❌ Auth error:", authError.message);
      return;
    }

    const userId = authData.user.id;
    console.log("✅ Auth user found:", userId);

    console.log("\n2️⃣  Checking if admin record exists...");
    const { data: existing } = await supabase
      .from("admin_accounts")
      .select("*")
      .eq("email", ADMIN_EMAIL)
      .single();

    if (existing) {
      console.log("✅ Admin record already exists");
      console.log("   ID:", existing.id);
      console.log("   Role:", existing.role);
      return;
    }

    console.log("❌ No admin record found, creating...");

    console.log("\n3️⃣  Creating admin record...");
    const { data: newRecord, error: insertError } = await supabase
      .from("admin_accounts")
      .insert({
        user_id: userId,
        email: ADMIN_EMAIL,
        role: "super_admin",
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("❌ Insert error:", insertError.message);
      console.log(
        "\n💡 This likely means the admin_accounts table doesn't exist yet."
      );
      console.log("   Please run the SQL migration first:");
      console.log("   1. Go to Supabase Dashboard → SQL Editor");
      console.log("   2. Run the SQL from: supabase/migrations/20260131_create_admin_system.sql");
      return;
    }

    console.log("✅ Admin record created successfully!");
    console.log("\n🎉 Admin setup complete!");
    console.log("   You can now log in at: http://localhost:8082/admin/login");
    console.log("   Email: " + ADMIN_EMAIL);
    console.log("   Password: " + ADMIN_PASSWORD);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

main();
