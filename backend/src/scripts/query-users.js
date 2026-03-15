import { query } from '../db.js';

const sql = `
SELECT u.id as user_id, u.email, u.full_name, u.role, u.phone as user_phone, u.created_at as user_created_at,
       fp.id as profile_id, fp.first_name, fp.last_name, fp.phone as fundi_phone, fp.verification_status, fp.latitude, fp.longitude, fp.created_at as profile_created_at
FROM users u
LEFT JOIN fundi_profiles fp ON u.id = fp.user_id
ORDER BY u.created_at DESC
LIMIT 200;
`;

(async () => {
  try {
    const res = await query(sql);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Query failed:', err.message);
    process.exit(1);
  }
})();
