-- Enable RLS on fundi_profiles table
ALTER TABLE fundi_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to insert their own profile
CREATE POLICY "Users can insert their own profile"
ON fundi_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Allow users to read their own profile
CREATE POLICY "Users can view their own profile"
ON fundi_profiles FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
ON fundi_profiles FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Allow admins to read all profiles (optional, for future admin dashboard)
-- Uncomment if you have a role column in auth.users
-- CREATE POLICY "Admins can view all profiles"
-- ON fundi_profiles FOR SELECT
-- USING (auth.jwt() ->> 'role' = 'admin');
