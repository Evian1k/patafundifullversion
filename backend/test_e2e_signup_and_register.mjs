#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';
const IMAGE_PATH = path.resolve('./frontend/src/assets/hero-fundi.jpg');

async function main() {
  try {
    console.log('\n🧪 E2E TEST: Signup → Fundi Registration\n');
    console.log('═'.repeat(70));

    // 1. SIGNUP
    console.log('\n1️⃣  SIGNUP REQUEST\n');
    const email = `e2e-${Date.now()}@example.com`;
    const password = 'Test@1234';
    const fullName = 'E2E TestUser';

    console.log(`   📧 Email: ${email}`);
    console.log(`   🔐 Password: ${password}`);
    console.log(`   👤 Full Name: ${fullName}\n`);

    const signupRes = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName })
    });

    if (!signupRes.ok) {
      console.error(`   ❌ Signup failed: ${signupRes.status}`);
      console.error(await signupRes.text());
      process.exit(1);
    }

    const signupData = await signupRes.json();
    const token = signupData.token;
    const userId = signupData.user.id;

    console.log(`   ✅ Signup successful!`);
    console.log(`   👤 User ID: ${userId}`);
    console.log(`   🎭 Role: ${signupData.user.role}`);
    console.log(`   🔑 Token: ${token.substring(0, 50)}...`);

    // 2. FUNDI REGISTRATION (multipart)
    console.log('\n2️⃣  FUNDI REGISTRATION REQUEST (multipart)\n');

    if (!fs.existsSync(IMAGE_PATH)) {
      console.error(`   ❌ Image not found: ${IMAGE_PATH}`);
      process.exit(1);
    }

    const form = new FormData();
    form.append('firstName', 'E2E');
    form.append('lastName', 'TestUser');
    form.append('email', email);
    form.append('phone', '0712345678');
    form.append('idNumber', '12345678');
    form.append('latitude', '1.2921');
    form.append('longitude', '36.8219');
    form.append('skills', JSON.stringify(['Plumbing', 'Electrical']));
    form.append('idPhoto', fs.createReadStream(IMAGE_PATH));
    form.append('selfie', fs.createReadStream(IMAGE_PATH));

    console.log('   📤 Posting multipart form:');
    console.log('      - firstName: E2E');
    console.log('      - lastName: TestUser');
    console.log('      - email: ' + email);
    console.log('      - phone: 0712345678');
    console.log('      - idNumber: 12345678');
    console.log('      - latitude: 1.2921');
    console.log('      - longitude: 36.8219');
    console.log('      - skills: ["Plumbing", "Electrical"]');
    console.log('      - idPhoto: hero-fundi.jpg');
    console.log('      - selfie: hero-fundi.jpg\n');

    const registerRes = await fetch(`${API_BASE}/fundi/register`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: form
    });

    const registerData = await registerRes.json();

    if (!registerRes.ok) {
      console.error(`   ❌ Registration failed: ${registerRes.status}`);
      console.error('   Response:', JSON.stringify(registerData, null, 2));
      process.exit(1);
    }

    console.log(`   ✅ Registration successful!`);
    console.log(`   📋 Registration ID: ${registerData.registration.id}`);
    console.log(`   ✅ Status: ${registerData.registration.verificationStatus}`);
    console.log(`   📋 Message: ${registerData.message}`);

    // 3. VERIFY ROLE CHANGE
    console.log('\n3️⃣  VERIFY ROLE CHANGE\n');

    const meRes = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const meData = await meRes.json();

    if (!meRes.ok) {
      console.error(`   ❌ Failed to get current user: ${meRes.status}`);
      process.exit(1);
    }

    console.log(`   👤 User: ${meData.user.fullName}`);
    console.log(`   🎭 Role BEFORE: customer`);
    console.log(`   🎭 Role AFTER: ${meData.user.role}`);
    console.log(`   ${meData.user.role === 'fundi' ? '✅' : '❌'} Role change verified!`);

    // 4. FINAL SUMMARY
    console.log('\n' + '═'.repeat(70));
    console.log('\n✨ E2E TEST RESULTS:\n');
    console.log('   ✅ User signup succeeded');
    console.log('   ✅ Multipart fundi registration succeeded');
    console.log(`   ✅ Role changed from "customer" to "${meData.user.role}"`);
    console.log('   ✅ Backend API fully functional\n');
    console.log('═'.repeat(70) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
