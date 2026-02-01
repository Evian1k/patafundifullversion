-- Create fundi_profiles table for storing fundi registration data
-- This table stores all fundi registration submissions with proper validation

CREATE TABLE IF NOT EXISTS fundi_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Personal Information
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  
  -- ID Verification
  id_number VARCHAR(50) NOT NULL,
  id_number_extracted VARCHAR(50),
  id_name_extracted VARCHAR(255),
  
  -- File Paths (stored in Supabase Storage)
  id_photo_path VARCHAR(512),
  id_photo_back_path VARCHAR(512),
  selfie_path VARCHAR(512),
  certificate_paths TEXT[] DEFAULT '{}',
  
  -- GPS Location Data
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy INTEGER, -- Meters
  altitude DECIMAL(8, 2),
  location_address VARCHAR(512),
  location_area VARCHAR(255),
  location_estate VARCHAR(255),
  location_city VARCHAR(255),
  location_captured_at BIGINT,
  
  -- Professional Information
  skills TEXT[] DEFAULT '{}',
  experience_years INTEGER DEFAULT 0,
  mpesa_number VARCHAR(20),
  
  -- Verification Status
  verification_status VARCHAR(50) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  verification_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  
  -- Indexes for querying
  CONSTRAINT user_id_unique UNIQUE(user_id),
  CONSTRAINT valid_coordinates CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
);

-- Create indexes for common queries
CREATE INDEX idx_fundi_user_id ON fundi_profiles(user_id);
CREATE INDEX idx_fundi_verification_status ON fundi_profiles(verification_status);
CREATE INDEX idx_fundi_created_at ON fundi_profiles(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE fundi_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Fundi can only view their own registration
CREATE POLICY "Fundis can view own registration" ON fundi_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policy: Fundi can only insert their own registration
CREATE POLICY "Fundis can insert own registration" ON fundi_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Fundi can only update their own registration (before approval)
CREATE POLICY "Fundis can update own pending registration" ON fundi_profiles
  FOR UPDATE USING (
    auth.uid() = user_id 
    AND verification_status = 'pending'
  );

-- Admin policy to view all registrations (if admin role exists)
CREATE POLICY "Admins can view all registrations" ON fundi_profiles
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

-- Admin policy to update registration status
CREATE POLICY "Admins can update registration status" ON fundi_profiles
  FOR UPDATE USING (auth.jwt() ->> 'role' = 'admin');

-- Create comments for documentation
COMMENT ON TABLE fundi_profiles IS 'Stores fundi (service professional) registration submissions. Data is stored before admin review and is not publicly accessible.';
COMMENT ON COLUMN fundi_profiles.verification_status IS 'Registration status: pending (default), approved, or rejected';
COMMENT ON COLUMN fundi_profiles.id_photo_path IS 'Path to ID photo in fundi-ids bucket (Supabase Storage)';
COMMENT ON COLUMN fundi_profiles.selfie_path IS 'Path to selfie photo in fundi-selfies bucket (Supabase Storage)';
COMMENT ON COLUMN fundi_profiles.certificate_paths IS 'Array of paths to certificates in fundi-certificates bucket';
