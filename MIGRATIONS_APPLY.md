# 🚀 QUICK FIX: Apply Supabase Migrations

## Problem
The admin_accounts table doesn't exist because the Supabase migrations haven't been applied yet.

## Solution: Run Migrations in Supabase Dashboard

### Step 1: Go to Supabase SQL Editor
1. Open: https://app.supabase.com
2. Select project: **tudclrlaxmxfmzjnbkac**
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

---

### Step 2: Copy & Execute Migration 1 (Admin System)

Copy this entire SQL and paste into the SQL editor:

```sql
-- Create admin_accounts table for admin-specific authentication and roles
CREATE TABLE IF NOT EXISTS admin_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'support_admin')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on admin_accounts
ALTER TABLE admin_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Only super_admin can view all admin accounts
CREATE POLICY "Super admin can view all admin accounts"
ON admin_accounts FOR SELECT
USING (auth.jwt() ->> 'role' = 'super_admin');

-- Policy: Admins can only read their own account
CREATE POLICY "Admins can view their own account"
ON admin_accounts FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Only super_admin can insert new admin accounts
CREATE POLICY "Only super admin can create admin accounts"
ON admin_accounts FOR INSERT
WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

-- Create admin_audit_log table for tracking all admin actions
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES admin_accounts(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on admin_audit_log
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON admin_audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_accounts 
    WHERE id = admin_id 
    AND user_id = auth.uid()
  )
);
```

Click **Run** (Ctrl+Enter)

---

### Step 3: Copy & Execute Migration 2 (Enhanced Verification)

Click **New Query** again and paste:

```sql
-- Enhanced Fundi Verification Schema with Security Hardening

-- Verification attempt status enum
CREATE TYPE IF NOT EXISTS public.verification_attempt_status AS ENUM ('pending_review', 'approved', 'rejected', 'flagged_fraud');

-- Verification step enum
CREATE TYPE IF NOT EXISTS public.verification_step AS ENUM ('name_match', 'id_verification', 'selfie_liveness', 'location_verification', 'all_complete');

-- Verification data table (immutable after approval)
CREATE TABLE IF NOT EXISTS public.fundi_verification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    -- Submitted data
    submitted_full_name TEXT NOT NULL,
    submitted_email TEXT NOT NULL,
    submitted_phone TEXT NOT NULL,
    submitted_id_number TEXT NOT NULL,
    
    -- ID Photo verification
    id_photo_url TEXT NOT NULL,
    id_photo_public_url TEXT,
    extracted_name_from_id TEXT,
    id_extraction_confidence DECIMAL(3,2),
    id_name_matches BOOLEAN,
    
    -- Selfie verification
    selfie_url TEXT NOT NULL,
    selfie_public_url TEXT,
    selfie_timestamp TIMESTAMP WITH TIME ZONE,
    face_match_score DECIMAL(3,2),
    liveness_score DECIMAL(3,2),
    selfie_quality_issues TEXT[],
    
    -- Location verification
    gps_latitude DECIMAL(10,8) NOT NULL,
    gps_longitude DECIMAL(11,8) NOT NULL,
    gps_accuracy DECIMAL(7,2),
    gps_captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- IP-based location check
    ip_address INET,
    ip_country TEXT,
    ip_region TEXT,
    location_mismatch_flagged BOOLEAN DEFAULT false,
    location_mismatch_reason TEXT,
    
    -- Verification status
    verification_status verification_attempt_status DEFAULT 'pending_review',
    completed_steps verification_step[] DEFAULT '{}',
    failed_steps verification_step[] DEFAULT '{}',
    
    -- Immutability flags
    is_locked BOOLEAN DEFAULT false,
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_by_user_id UUID REFERENCES auth.users(id),
    
    -- Admin review info
    reviewed_by_admin_id UUID REFERENCES auth.users(id),
    review_notes TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    -- Duplicate detection flags
    duplicate_id_conflict_user_id UUID REFERENCES auth.users(id),
    duplicate_phone_conflict_user_id UUID REFERENCES auth.users(id),
    duplicate_email_conflict_user_id UUID REFERENCES auth.users(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Verification audit log (immutable, append-only)
CREATE TABLE IF NOT EXISTS public.fundi_verification_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    verification_id UUID REFERENCES public.fundi_verification(id) ON DELETE CASCADE,
    
    -- Audit entry details
    action TEXT NOT NULL,
    step verification_step,
    status verification_attempt_status,
    
    -- Result details
    success BOOLEAN NOT NULL DEFAULT false,
    failure_reason TEXT,
    
    -- Anomaly detection
    fraud_flags TEXT[],
    
    -- Change tracking
    old_value TEXT,
    new_value TEXT,
    attempted_change_field TEXT,
    
    -- Request metadata
    user_agent TEXT,
    ip_address INET,
    country_from_ip TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Fundi verification blocklist
CREATE TABLE IF NOT EXISTS public.fundi_verification_blocklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- What's blocked
    blocked_id_number TEXT UNIQUE,
    blocked_phone TEXT UNIQUE,
    blocked_email TEXT UNIQUE,
    blocked_ip_range INET,
    
    -- Why it's blocked
    reason TEXT NOT NULL,
    blocked_due_to_fraud BOOLEAN DEFAULT false,
    fraud_severity TEXT,
    
    -- Admin action
    blocked_by_admin_id UUID REFERENCES auth.users(id),
    
    -- Timestamps
    blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_fundi_id_number_unique ON public.fundi_verification(submitted_id_number) 
    WHERE verification_status IN ('approved', 'pending_review');

CREATE UNIQUE INDEX IF NOT EXISTS idx_fundi_phone_unique ON public.fundi_verification(submitted_phone) 
    WHERE verification_status IN ('approved', 'pending_review');

CREATE UNIQUE INDEX IF NOT EXISTS idx_fundi_email_unique ON public.fundi_verification(submitted_email) 
    WHERE verification_status IN ('approved', 'pending_review');

CREATE INDEX IF NOT EXISTS idx_verification_status ON public.fundi_verification(verification_status);
CREATE INDEX IF NOT EXISTS idx_verification_user_id ON public.fundi_verification(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_created ON public.fundi_verification(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON public.fundi_verification_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.fundi_verification_audit(action);
CREATE INDEX IF NOT EXISTS idx_blocklist_id_number ON public.fundi_verification_blocklist(blocked_id_number);
CREATE INDEX IF NOT EXISTS idx_blocklist_phone ON public.fundi_verification_blocklist(blocked_phone);
CREATE INDEX IF NOT EXISTS idx_blocklist_email ON public.fundi_verification_blocklist(blocked_email);

-- Enable RLS
ALTER TABLE public.fundi_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundi_verification_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundi_verification_blocklist ENABLE ROW LEVEL SECURITY;
```

Click **Run**

---

### Step 4: Create Admin Account

Click **New Query** and paste:

```sql
-- First, get your auth user ID
SELECT id, email FROM auth.users LIMIT 1;
```

This will show your user ID. Copy it.

Then run this query (replace `YOUR_USER_ID` with the ID from above):

```sql
INSERT INTO public.admin_accounts (
  user_id,
  email,
  role,
  is_active
) VALUES (
  'YOUR_USER_ID',
  'emmanuelevian@gmail.com',
  'super_admin',
  true
);
```

---

### Step 5: Verify Tables Created

Run this query to verify all tables exist:

```sql
SELECT 
  table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('admin_accounts', 'admin_audit_log', 'fundi_verification', 'fundi_verification_audit', 'fundi_verification_blocklist')
ORDER BY table_name;
```

You should see 5 tables listed.

---

## Back in Your App

### Step 1: Refresh the browser
Go to http://localhost:8080/admin/login

### Step 2: Login with admin credentials
- Email: `emmanuelevian@gmail.com`
- Password: `neemajoy12k`

### Step 3: You should now see the Admin Dashboard ✅

---

## Errors Still Showing?

If you still see errors in console, clear your browser cache:
1. Open Developer Tools (F12)
2. Press Ctrl+Shift+Delete
3. Clear browsing data
4. Refresh page

---

## All Migrations in One Command

If you want to run all migrations at once, copy-paste this entire block:

**File:** `/home/emmanuel/EE/fixit-connect/supabase/migrations/20260131_create_admin_system.sql`  
**File:** `/home/emmanuel/EE/fixit-connect/supabase/migrations/20260131_add_enhanced_verification.sql`

Both are ready to copy and paste into Supabase SQL Editor.

---

**✅ After these steps, your app will be fully functional!**
