-- Create Fundi Storage Buckets (Run in Supabase SQL Editor)
-- Go to: Supabase Dashboard → SQL Editor → New Query
-- Copy and paste this entire script, then click "Run"

-- Step 1: Create buckets by inserting into storage.buckets table
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('fundi-ids', 'fundi-ids', false),
  ('fundi-selfies', 'fundi-selfies', false),
  ('fundi-certificates', 'fundi-certificates', false)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 3: Create storage policies for fundi-ids bucket
CREATE POLICY "fundi-ids-upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fundi-ids'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "fundi-ids-read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fundi-ids'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "fundi-ids-delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fundi-ids'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Step 4: Create storage policies for fundi-selfies bucket
CREATE POLICY "fundi-selfies-upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fundi-selfies'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "fundi-selfies-read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fundi-selfies'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "fundi-selfies-delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fundi-selfies'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Step 5: Create storage policies for fundi-certificates bucket
CREATE POLICY "fundi-certificates-upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fundi-certificates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "fundi-certificates-read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fundi-certificates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "fundi-certificates-delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fundi-certificates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
