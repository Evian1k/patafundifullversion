#!/usr/bin/env node
/**
 * Smoke test: fundi applicant -> submit docs -> admin approve -> fundi OTP verify -> fundi dashboard
 *
 * Prereqs:
 * - Backend running at http://localhost:5000
 * - Postgres running
 * - backend/.env contains ADMIN_EMAIL + ADMIN_PASSWORD
 * - For fully automated OTP: set DEV_ECHO_OTP=true in backend/.env (dev only)
 */

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';
import '../src/env.js';

const API_BASE = process.env.SMOKE_API_BASE || 'http://localhost:5000/api';

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

async function jsonOrText(res) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    return { _raw: t };
  }
}

async function main() {
  console.log('🧪 Smoke: fundi approval flow');
  const health = await fetch(`${API_BASE.replace(/\/api$/, '')}/health`).catch(() => null);
  if (!health || !health.ok) fail('Backend not reachable. Start backend on :5000 then rerun.');
  console.log('✅ Backend reachable');

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) fail('Missing ADMIN_EMAIL/ADMIN_PASSWORD in backend/.env');

  // 1) Create fundi applicant user
  const email = `smoke-fundi-${Date.now()}@example.com`;
  const password = 'Test@1234A!';
  const fullName = 'Smoke Fundi';

  const signupRes = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, fullName, role: 'fundi' }),
  });
  const signup = await jsonOrText(signupRes);
  if (!signupRes.ok) fail(`Signup failed: ${signupRes.status} ${JSON.stringify(signup)}`);
  const token = signup.token;
  console.log(`✅ Fundi applicant created: ${email} (role=${signup.user?.role})`);

  // 2) Submit fundi registration docs (uses placeholder image; OCR may mismatch but should be accepted in dev)
  const img = path.resolve('../frontend/src/assets/hero-fundi.jpg');
  if (!fs.existsSync(img)) fail(`Missing test image: ${img}`);

  const form = new FormData();
  form.append('firstName', 'Smoke');
  form.append('lastName', 'Fundi');
  form.append('email', email);
  form.append('phone', '0712345678');
  form.append('idNumber', '12345678');
  form.append('latitude', '1.2921');
  form.append('longitude', '36.8219');
  form.append('skills', JSON.stringify(['Plumbing']));
  form.append('idPhoto', fs.createReadStream(img));
  form.append('selfie', fs.createReadStream(img));

  const regRes = await fetch(`${API_BASE}/fundi/register`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const reg = await jsonOrText(regRes);
  if (!regRes.ok) fail(`Fundi register failed: ${regRes.status} ${JSON.stringify(reg)}`);
  console.log(`✅ Fundi registration submitted: ${reg.registration?.id} (status=${reg.registration?.verificationStatus})`);

  // 3) Admin login
  const adminLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const adminLogin = await jsonOrText(adminLoginRes);
  if (!adminLoginRes.ok) fail(`Admin login failed: ${adminLoginRes.status} ${JSON.stringify(adminLogin)}`);
  const adminToken = adminLogin.token;
  console.log('✅ Admin login ok');

  // 4) Find our pending fundi by listing pending fundis
  const pendingRes = await fetch(`${API_BASE}/admin/pending-fundis?page=1&limit=50`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const pending = await jsonOrText(pendingRes);
  if (!pendingRes.ok) fail(`Fetch pending fundis failed: ${pendingRes.status} ${JSON.stringify(pending)}`);
  const row = (pending.fundis || []).find((f) => (f.email || '').toLowerCase() === email.toLowerCase());
  if (!row) fail('Could not find fundi in /admin/pending-fundis');
  console.log(`✅ Fundi appears in admin pending list: fundiId=${row.id}`);

  // 5) Approve fundi
  const approveRes = await fetch(`${API_BASE}/admin/fundis/${row.id}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: 'approved via smoke test' }),
  });
  const approve = await jsonOrText(approveRes);
  if (!approveRes.ok) fail(`Approve failed: ${approveRes.status} ${JSON.stringify(approve)}`);
  console.log('✅ Admin approved fundi');

  // 6) Verify fundi approval OTP (requires DEV_ECHO_OTP=true)
  const code = approve?.debug?.otp?.code;
  if (!code) {
    console.log('ℹ️ DEV_ECHO_OTP not enabled; cannot auto-verify OTP.');
    console.log('   Enable DEV_ECHO_OTP=true in backend/.env, restart backend, then rerun for full automation.');
    console.log('✅ Smoke partial pass (approval succeeded)');
    process.exit(0);
  }

  const otpVerifyRes = await fetch(`${API_BASE}/auth/otp-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, purpose: 'fundi_approval' }),
  });
  const otpVerify = await jsonOrText(otpVerifyRes);
  if (!otpVerifyRes.ok) fail(`OTP verify failed: ${otpVerifyRes.status} ${JSON.stringify(otpVerify)}`);
  const fundiToken = otpVerify.token;
  console.log('✅ Fundi approval OTP verified');

  // 7) Fundi dashboard should work
  const dashRes = await fetch(`${API_BASE}/fundi/dashboard`, {
    headers: { Authorization: `Bearer ${fundiToken}` },
  });
  const dash = await jsonOrText(dashRes);
  if (!dashRes.ok) fail(`Fundi dashboard failed: ${dashRes.status} ${JSON.stringify(dash)}`);
  console.log('✅ Fundi dashboard accessible');

  console.log('\n🎉 Smoke test PASS\n');
}

main().catch((e) => fail(e.message));
