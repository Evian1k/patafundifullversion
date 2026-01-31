#!/usr/bin/env node
/**
 * Execute admin setup SQL via Supabase query method
 * This requires the Service Role key (only available on Supabase dashboard)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// NOTE: Service Role Key is needed to execute arbitrary SQL
// Get it from: Supabase Dashboard → Project Settings → API Keys
// Copy the "Service Role / Secret" key

console.log("🚀 Admin Setup via SQL\n");
console.log("To set up admin manually:\n");
console.log("1. Go to Supabase Dashboard:");
console.log("   https://supabase.com/dashboard/project/tudclrlaxmxfmzjnbkac\n");

console.log("2. Click 'SQL Editor' in the left sidebar\n");

console.log("3. Click 'New Query'\n");

console.log("4. Copy and paste the following SQL:\n");
console.log("─".repeat(80));

// Read and display the SQL
const sqlPath = path.join(__dirname, "../ADMIN_SETUP.sql");
const sql = fs.readFileSync(sqlPath, "utf-8");
console.log(sql);

console.log("─".repeat(80));
console.log("\n5. Click the 'Run' button (green button in the bottom right)\n");

console.log("6. After SQL runs successfully, refresh browser:");
console.log("   http://localhost:8082/admin/login\n");

console.log("7. Log in with:");
console.log("   Email: emmanuelevian@gmail.com");
console.log("   Password: neemajoy12k\n");

console.log("✅ Done!\n");
