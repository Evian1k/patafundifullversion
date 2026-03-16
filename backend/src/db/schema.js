export const SCHEMA = `
-- Required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(50) DEFAULT 'customer',
  status VARCHAR(50) DEFAULT 'active',
  disabled_at TIMESTAMP,
  email_verified BOOLEAN DEFAULT false,
  phone_verified BOOLEAN DEFAULT false,
  -- Fundi onboarding gate: admin approval sends OTP, then fundi verifies OTP to access fundi dashboard/features
  fundi_otp_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fundi profiles (with step-by-step registration tracking)
CREATE TABLE IF NOT EXISTS fundi_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  registration_step INTEGER DEFAULT 1,
  step_1_completed_at TIMESTAMP,
  step_2_completed_at TIMESTAMP,
  step_3_completed_at TIMESTAMP,
  step_4_completed_at TIMESTAMP,
  step_5_completed_at TIMESTAMP,
  step_6_completed_at TIMESTAMP,
  step_7_completed_at TIMESTAMP,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  id_number VARCHAR(50),
  id_number_extracted VARCHAR(50),
  id_name_extracted VARCHAR(255),
  id_photo_path VARCHAR(512),
  id_photo_back_path VARCHAR(512),
  selfie_path VARCHAR(512),
  certificate_paths TEXT[] DEFAULT '{}',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  accuracy INTEGER,
  altitude DECIMAL(8, 2),
  location_address VARCHAR(512),
  location_area VARCHAR(255),
  location_estate VARCHAR(255),
  location_city VARCHAR(255),
  location_captured_at BIGINT,
  skills TEXT[] DEFAULT '{}',
  experience_years INTEGER DEFAULT 0,
  mpesa_number VARCHAR(20),
  payment_method_verified BOOLEAN DEFAULT false,
  verification_status VARCHAR(50) DEFAULT 'incomplete',
  verification_notes TEXT,
  subscription_active BOOLEAN DEFAULT false,
  subscription_expires_at TIMESTAMP,
  fraud_flags JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_coordinates CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
);

-- Jobs
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fundi_id UUID REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100),
  location VARCHAR(512) NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  status VARCHAR(50) DEFAULT 'pending',
  estimated_price DECIMAL(10, 2),
  final_price DECIMAL(10, 2),
  platform_fee DECIMAL(10, 2),
  customer_completion_confirmed BOOLEAN DEFAULT false,
  customer_completion_confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job photos
CREATE TABLE IF NOT EXISTS job_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  photo_url VARCHAR(512) NOT NULL,
  photo_type VARCHAR(50) DEFAULT 'before',
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Service categories
CREATE TABLE IF NOT EXISTS service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Profiles (general user profile)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  avatar_url VARCHAR(512),
  location VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job bids
CREATE TABLE IF NOT EXISTS job_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  fundi_id UUID NOT NULL REFERENCES users(id),
  price DECIMAL(10, 2) NOT NULL,
  eta_minutes INTEGER,
  message TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(job_id, fundi_id)
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id),
  reviewee_id UUID NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id),
  fundi_id UUID NOT NULL REFERENCES users(id),
  amount DECIMAL(10, 2) NOT NULL,
  platform_fee DECIMAL(10, 2),
  fundi_earnings DECIMAL(10, 2),
  payment_method VARCHAR(50),
  payment_status VARCHAR(50) DEFAULT 'pending',
  transaction_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- M-Pesa STK transaction tracking
CREATE TABLE IF NOT EXISTS mpesa_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  kind VARCHAR(50) DEFAULT 'job', -- job, subscription
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
);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_checkout ON mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_payment ON mpesa_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_kind ON mpesa_transactions(kind);

-- Fundi subscription payments (initiations + receipts)
CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fundi_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'pending',
  transaction_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_fundi ON subscription_payments(fundi_id, created_at DESC);

-- Job status history (audit trail for job lifecycle)
CREATE TABLE IF NOT EXISTS job_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  actor_id UUID REFERENCES users(id),
  actor_role VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_job_status_history_job ON job_status_history(job_id);
CREATE INDEX IF NOT EXISTS idx_job_status_history_created ON job_status_history(created_at DESC);

-- Location history (for compliance/anomaly checks and playback)
CREATE TABLE IF NOT EXISTS location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  accuracy INTEGER,
  source VARCHAR(50) DEFAULT 'api', -- api, socket, background
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_location_history_user ON location_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_history_job ON location_history(job_id, created_at DESC);

-- General audit logs (all roles/actions)
CREATE TABLE IF NOT EXISTS audit_logs (
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
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Admin action logs table
CREATE TABLE IF NOT EXISTS admin_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL,
  target_type VARCHAR(100) NOT NULL,
  target_id UUID,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OTP codes (email/phone verification, job confirmation, etc.)
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  destination VARCHAR(255) NOT NULL, -- email or phone
  channel VARCHAR(20) NOT NULL, -- email, sms
  purpose VARCHAR(50) NOT NULL, -- register, login, job_complete, etc.
  code_hash VARCHAR(255) NOT NULL,
  attempts INTEGER DEFAULT 0,
  used BOOLEAN DEFAULT false,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_otp_codes_user_purpose ON otp_codes(user_id, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_codes_destination ON otp_codes(destination, created_at DESC);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_fundi_profiles_user_id ON fundi_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_fundi_id ON jobs(fundi_id);
CREATE INDEX IF NOT EXISTS idx_job_photos_job_id ON job_photos(job_id);
CREATE INDEX IF NOT EXISTS idx_job_bids_job_id ON job_bids(job_id);
CREATE INDEX IF NOT EXISTS idx_messages_job_id ON messages(job_id);
CREATE INDEX IF NOT EXISTS idx_payments_job_id ON payments(job_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_admin_id ON admin_action_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_target_id ON admin_action_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_created_at ON admin_action_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fundi_profiles_verification_status ON fundi_profiles(verification_status);

-- Token blacklist for logout / token revocation
CREATE TABLE IF NOT EXISTS token_blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(1024) NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_token ON token_blacklist(token);

-- Persistent fundi locations for matching and tracking
CREATE TABLE IF NOT EXISTS fundi_locations (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  accuracy INTEGER,
  online BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fundi_locations_updated_at ON fundi_locations(updated_at DESC);

-- Fundi wallet and transactions
CREATE TABLE IF NOT EXISTS fundi_wallets (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance DECIMAL(12,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fundi_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  type VARCHAR(50) NOT NULL,
  source VARCHAR(100),
  job_id UUID,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fundi_wallet_user ON fundi_wallet_transactions(user_id);

-- Fundi withdrawal requests (M-Pesa readiness)
CREATE TABLE IF NOT EXISTS fundi_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  mpesa_number VARCHAR(30),
  status VARCHAR(50) DEFAULT 'requested',
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fundi_withdrawals_user ON fundi_withdrawals(user_id);

-- Job requests for real-time matching
CREATE TABLE IF NOT EXISTS job_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  fundi_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, declined, accepted, expired
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_job_requests_job_id ON job_requests(job_id);
CREATE INDEX IF NOT EXISTS idx_job_requests_fundi_id ON job_requests(fundi_id);

-- Fundi verification evidence (OCR scores, face matching, quality metrics)
CREATE TABLE IF NOT EXISTS fundi_verification_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fundi_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  evidence_type VARCHAR(100) NOT NULL, -- ocr_id, ocr_selfie, face_match, liveness, location_gps, payment_verify
  confidence_score DECIMAL(5,2),
  score_details JSONB,
  passed BOOLEAN,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fundi_verification_evidence_fundi_id ON fundi_verification_evidence(fundi_id);

-- Fundi fraud and anti-cheating logs
CREATE TABLE IF NOT EXISTS fundi_fraud_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fundi_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fraud_type VARCHAR(100) NOT NULL, -- duplicate_id, duplicate_phone, name_change_attempt, location_mismatch, multiple_registrations, etc
  details JSONB,
  severity VARCHAR(50), -- low, medium, high, critical
  action_taken VARCHAR(100), -- flagged, blocked, review_required, etc
  admin_reviewed BOOLEAN DEFAULT false,
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fundi_fraud_logs_fundi_id ON fundi_fraud_logs(fundi_id);
CREATE INDEX IF NOT EXISTS idx_fundi_fraud_logs_severity ON fundi_fraud_logs(severity);

-- Insert default service categories
INSERT INTO service_categories (name, description, icon) VALUES
  ('Plumbing', 'Pipes, leaks, installations', 'droplets'),
  ('Electrical', 'Wiring, repairs, installations', 'zap'),
  ('AC & HVAC', 'Cooling, heating, maintenance', 'wind'),
  ('Cleaning', 'Home, office, deep cleaning', 'sparkles'),
  ('Carpentry', 'Furniture, repairs, custom work', 'hammer'),
  ('Auto Repair', 'Mechanics, diagnostics, service', 'car'),
  ('Painting', 'Interior, exterior, finishing', 'paint-bucket'),
  ('General Repair', 'Handyman services', 'wrench')
ON CONFLICT DO NOTHING;
`;
