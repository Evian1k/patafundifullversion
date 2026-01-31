-- RLS Policy Setup for fundi_profiles table
-- Run this in your Supabase SQL Editor to allow authenticated users to create and manage their profiles

-- Ensure RLS is enabled
ALTER TABLE public.fundi_profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to INSERT their own profile (user_id must match their uid)
CREATE POLICY "allow_authenticated_insert_own_profile"
  ON public.fundi_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ( user_id = auth.uid() );

-- Allow authenticated users to SELECT their own profile only
CREATE POLICY "allow_authenticated_select_own_profile"
  ON public.fundi_profiles
  FOR SELECT
  TO authenticated
  USING ( user_id = auth.uid() );

-- Allow authenticated users to UPDATE their own profile
CREATE POLICY "allow_authenticated_update_own_profile"
  ON public.fundi_profiles
  FOR UPDATE
  TO authenticated
  USING ( user_id = auth.uid() )
  WITH CHECK ( user_id = auth.uid() );

-- Optional: Allow admins/service role to view all profiles (for admin dashboard)
-- CREATE POLICY "allow_service_select_all"
--   ON public.fundi_profiles
--   FOR SELECT
--   TO service_role
--   USING ( true );
