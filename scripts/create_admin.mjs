import { createClient } from '@supabase/supabase-js';

// Usage:
// SUPABASE_URL=https://<project>.supabase.co \
// SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
// ADMIN_EMAIL=emmanuelevian@gmail.com \
// ADMIN_PASSWORD=neemajoy12k \
// node scripts/create_admin.mjs

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Missing ADMIN_EMAIL or ADMIN_PASSWORD env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function run() {
  try {
    console.log('Checking for existing admin_accounts entry...');
    const { data: existingAdmin } = await supabase
      .from('admin_accounts')
      .select('*')
      .eq('email', ADMIN_EMAIL)
      .single();

    if (existingAdmin) {
      console.log('Admin account already exists in admin_accounts table:', ADMIN_EMAIL);
    }

    console.log('Checking if auth user exists...');
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', ADMIN_EMAIL)
      .single();

    if (existingUser) {
      console.log('Found existing auth user id:', existingUser.id);
      // Insert into admin_accounts if missing
      if (!existingAdmin) {
        const insertRes = await supabase.from('admin_accounts').insert({
          user_id: existingUser.id,
          email: ADMIN_EMAIL,
          role: 'super_admin',
          is_active: true
        });
        if (insertRes.error) throw insertRes.error;
        console.log('Inserted admin_accounts row for', ADMIN_EMAIL);
      }
      console.log('Done.');
      process.exit(0);
    }

    console.log('Auth user not found. Creating new auth user via admin API...');

    // Create auth user using admin API
    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { role: 'super_admin' }
    });

    if (createUserError) {
      console.error('Failed to create auth user:', createUserError.message || createUserError);
      process.exit(1);
    }

    console.log('Created auth user:', createdUser.id);

    // Insert admin_accounts row
    const { error: insertError } = await supabase.from('admin_accounts').insert({
      user_id: createdUser.id,
      email: ADMIN_EMAIL,
      role: 'super_admin',
      is_active: true
    });

    if (insertError) throw insertError;

    console.log('Inserted admin_accounts row for', ADMIN_EMAIL);
    console.log('Admin creation complete. You can now log in at /admin/login');
  } catch (err) {
    console.error('Error creating admin:', err);
    process.exit(1);
  }
}

run();
