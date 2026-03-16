import { query } from '../src/db.js';

const userId = '53467623-7add-40ed-afbf-ca8b3225bd3a';

(async () => {
  try {
    console.log('Deleting from token_blacklist...');
    await query('DELETE FROM token_blacklist WHERE user_id = $1', [userId]);

    console.log('Deleting fundi profile...');
    await query('DELETE FROM fundi_profiles WHERE user_id = $1', [userId]);

    console.log('Deleting user...');
    await query('DELETE FROM users WHERE id = $1', [userId]);

    console.log('✅ Fundi deleted successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Delete failed:', err.message);
    process.exit(1);
  }
})();