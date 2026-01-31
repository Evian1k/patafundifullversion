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
