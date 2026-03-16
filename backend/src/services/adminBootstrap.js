import { query } from '../db.js';
import { hashPassword } from '../utils/password.js';
import { v4 as uuidv4 } from 'uuid';

export async function bootstrapAdmin() {
  const enabled =
    process.env.ADMIN_AUTO_BOOTSTRAP === 'true' ||
    (process.env.ADMIN_AUTO_BOOTSTRAP !== 'false' && process.env.NODE_ENV !== 'production');
  if (!enabled) return;

  const email = (process.env.ADMIN_EMAIL || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  const fullName = process.env.ADMIN_FULL_NAME || 'Admin';

  if (!email || !password) {
    console.warn('Admin bootstrap skipped (missing ADMIN_EMAIL or ADMIN_PASSWORD).');
    return;
  }

  const existing = await query('SELECT id, role FROM users WHERE email = $1', [email]).catch(() => ({ rows: [] }));
  if (existing.rows.length > 0) {
    const user = existing.rows[0];
    if (user.role !== 'admin') {
      const passwordHash = await hashPassword(password);
      await query(
        `UPDATE users
         SET role = 'admin',
             password_hash = $1,
             full_name = COALESCE(NULLIF($2, ''), full_name),
             email_verified = true,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [passwordHash, fullName, user.id]
      ).catch(() => {});
      console.log(`🔐 Bootstrapped admin (promoted): ${email}`);
    }
    return;
  }

  const passwordHash = await hashPassword(password);
  const userId = uuidv4();
  await query(
    `INSERT INTO users (id, email, password_hash, full_name, role, email_verified)
     VALUES ($1, $2, $3, $4, 'admin', true)`,
    [userId, email, passwordHash, fullName]
  ).catch(() => {});

  console.log(`🔐 Bootstrapped admin (created): ${email}`);
}

