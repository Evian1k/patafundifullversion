import fetch from 'node-fetch';

const API = 'http://localhost:5000/api';

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ email, password })
  });
  return res.json();
}

async function createJob(token) {
  const res = await fetch(`${API}/jobs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      title: 'Test plumbing - pipe fix',
      description: 'Leaky pipe near kitchen sink',
      category: 'plumbing',
      location: 'Nairobi, Kenya',
      latitude: -1.2921,
      longitude: 36.8219,
      estimatedPrice: 2000
    })
  });
  return res.json();
}

async function run() {
  const loginRes = await login('test.customer@example.com', 'password123');
  if (!loginRes || !loginRes.token) {
    console.error('Login failed', loginRes);
    process.exit(1);
  }
  const token = loginRes.token;
  console.log('Creating job...');
  const job = await createJob(token);
  console.log('Job result:', job);
}

run().catch(err => { console.error(err); process.exit(1); });
