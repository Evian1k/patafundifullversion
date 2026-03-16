import pool from '../db.js';

const statements = [
  // Extensions
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,

  // Users hardening (admin endpoints expect these columns)
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMP`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS fundi_otp_verified BOOLEAN DEFAULT false`,
  `UPDATE users SET email_verified = true WHERE role = 'admin' AND (email_verified IS NULL OR email_verified = false)`,
  // Backfill roles for existing records (older builds may have fundi applicants stuck as customers)
  `UPDATE users u
   SET role = 'fundi'
   WHERE u.role = 'customer'
     AND EXISTS (
       SELECT 1 FROM fundi_profiles fp
       WHERE fp.user_id = u.id AND fp.verification_status = 'approved'
     )`,
  `UPDATE users u
   SET role = 'fundi_pending'
   WHERE u.role = 'customer'
     AND EXISTS (
       SELECT 1 FROM fundi_profiles fp
       WHERE fp.user_id = u.id AND fp.verification_status IN ('pending','incomplete')
     )`,

  // Jobs: customer completion confirmation (OTP gate)
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_completion_confirmed BOOLEAN DEFAULT false`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_completion_confirmed_at TIMESTAMP`,

  // Jobs: matching expansion + distance pricing
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS match_radius_km DECIMAL(10,2)`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS match_attempt INTEGER DEFAULT 0`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS distance_km DECIMAL(10,2)`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS base_price DECIMAL(10,2)`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS distance_fee DECIMAL(10,2)`,

  // Service categories: pricing configuration
  `ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS base_price DECIMAL(10,2)`,
  `ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS per_km_rate DECIMAL(10,2)`,
  `UPDATE service_categories SET base_price = COALESCE(base_price, 1000), per_km_rate = COALESCE(per_km_rate, 150)`,

  // Customer settings + saved places
  `CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    safety_alerts BOOLEAN DEFAULT true,
    share_emergency_contact BOOLEAN DEFAULT false,
    hide_profile BOOLEAN DEFAULT false,
    privacy_marketing_opt_in BOOLEAN DEFAULT true,
    privacy_share_location BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS saved_places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    label VARCHAR(64),
    address VARCHAR(512) NOT NULL,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_saved_places_user ON saved_places(user_id, created_at DESC)`,

  // Payments & mpesa transactions
  `CREATE TABLE IF NOT EXISTS mpesa_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    kind VARCHAR(50) DEFAULT 'job',
    fundi_id UUID REFERENCES users(id) ON DELETE SET NULL,
    subscription_payment_id UUID,
    plan VARCHAR(50),
    phone_number VARCHAR(30),
    amount DECIMAL(10,2),
    merchant_request_id VARCHAR(128),
    checkout_request_id VARCHAR(128),
    result_code INTEGER,
    result_desc TEXT,
    receipt_number VARCHAR(64),
    status VARCHAR(50) DEFAULT 'initiated',
    raw JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  // If mpesa_transactions existed before, ensure new columns exist (must come before indexes using them)
  `ALTER TABLE mpesa_transactions ADD COLUMN IF NOT EXISTS kind VARCHAR(50) DEFAULT 'job'`,
  `ALTER TABLE mpesa_transactions ADD COLUMN IF NOT EXISTS fundi_id UUID`,
  `ALTER TABLE mpesa_transactions ADD COLUMN IF NOT EXISTS subscription_payment_id UUID`,
  `ALTER TABLE mpesa_transactions ADD COLUMN IF NOT EXISTS plan VARCHAR(50)`,

  `CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_checkout ON mpesa_transactions(checkout_request_id)`,
  `CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_payment ON mpesa_transactions(payment_id)`,
  `CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_kind ON mpesa_transactions(kind)`,

  // Job status history
  `CREATE TABLE IF NOT EXISTS job_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    actor_id UUID REFERENCES users(id),
    actor_role VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_job_status_history_job ON job_status_history(job_id)`,
  `CREATE INDEX IF NOT EXISTS idx_job_status_history_created ON job_status_history(created_at DESC)`,

  // Location history
  `CREATE TABLE IF NOT EXISTS location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    accuracy INTEGER,
    source VARCHAR(50) DEFAULT 'api',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_location_history_user ON location_history(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_location_history_job ON location_history(job_id, created_at DESC)`,

  // General audit logs
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    metadata JSONB,
    ip_address VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)`,

  // OTP codes
  `CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    destination VARCHAR(255) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    purpose VARCHAR(50) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    attempts INTEGER DEFAULT 0,
    used BOOLEAN DEFAULT false,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_otp_codes_user_purpose ON otp_codes(user_id, purpose, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_otp_codes_destination ON otp_codes(destination, created_at DESC)`,

  // Subscription payments
  `CREATE TABLE IF NOT EXISTS subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fundi_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'pending',
    transaction_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_subscription_payments_fundi ON subscription_payments(fundi_id, created_at DESC)`,
];

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🧱 Running migrations...');
    for (const sql of statements) {
      await client.query(sql);
    }
    console.log('✅ Migrations complete');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    // Allow logs to flush
    setTimeout(() => process.exit(process.exitCode || 0), 50);
  }
}

migrate();
