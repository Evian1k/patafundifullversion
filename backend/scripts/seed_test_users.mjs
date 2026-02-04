import { query } from '../src/db.js';

const API = 'http://localhost:5000/api';

async function signup(email, password, fullName, role = 'customer') {
  const res = await fetch(`${API}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, fullName, role })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Signup error for', email, body.message || body);
    return { error: body.message || 'Signup failed' };
  }
  return body;
}

async function seed() {
  console.log('Creating test customer...');
  let customer = await signup('test.customer@example.com', 'password123', 'Test Customer');
  if (customer?.error) {
    const loginRes = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ email: 'test.customer@example.com', password: 'password123' })
    });
    customer = await loginRes.json().catch(() => ({}));
  }
  console.log('Customer:', customer.user?.id);

  console.log('Creating test fundi...');
  let fundi = await signup('test.fundi@example.com', 'password123', 'Test Fundi', 'fundi');
  if (fundi?.error) {
    const loginRes = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ email: 'test.fundi@example.com', password: 'password123' })
    });
    fundi = await loginRes.json().catch(() => ({}));
  }
  console.log('Fundi user id:', fundi.user?.id);

  // Insert fundi profile and location
  if (fundi.user?.id) {
    const userId = fundi.user.id;
    try {
      await query(`INSERT INTO fundi_profiles (
        user_id, first_name, last_name, email, phone, id_number,
        latitude, longitude, skills, verification_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'approved')
      ON CONFLICT (user_id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        id_number = EXCLUDED.id_number,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        skills = EXCLUDED.skills,
        verification_status = 'approved'
      `, [userId, 'Test', 'Fundi', 'test.fundi@example.com', '+254700000000', 'ID12345', -1.2921, 36.8219, ['plumbing']]);

      await query(`INSERT INTO fundi_locations (user_id, latitude, longitude, online, updated_at)
        VALUES ($1,$2,$3,true,CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, online = EXCLUDED.online, updated_at = CURRENT_TIMESTAMP
      `, [userId, -1.2921, 36.8219]);

      console.log('Seeded fundi profile and location');
      console.log('Fundi token:', fundi.token);
      console.log('Customer token:', customer.token);
    } catch (err) {
      console.error('DB insert error', err);
    }
  }
}

seed().catch(console.error).finally(() => process.exit(0));
