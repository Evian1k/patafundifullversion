-- Create Fundi Storage Buckets
-- These buckets store user-uploaded files: IDs, selfies, and certificates

-- Create fundi-ids bucket (private)
INSERT INTO storage.buckets (id, name, owner, public)
VALUES ('fundi-ids', 'fundi-ids', NULL, false)
ON CONFLICT (id) DO NOTHING;

-- Create fundi-selfies bucket (private)
INSERT INTO storage.buckets (id, name, owner, public)
VALUES ('fundi-selfies', 'fundi-selfies', NULL, false)
ON CONFLICT (id) DO NOTHING;

-- Create fundi-certificates bucket (private)
INSERT INTO storage.buckets (id, name, owner, public)
VALUES ('fundi-certificates', 'fundi-certificates', NULL, false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for fundi-ids bucket
-- Allow authenticated users to upload their own files
CREATE POLICY "Allow authenticated upload to fundi-ids" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'fundi-ids' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to read their own files
CREATE POLICY "Allow authenticated read from fundi-ids" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'fundi-ids' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own files
CREATE POLICY "Allow authenticated delete from fundi-ids" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'fundi-ids' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policies for fundi-selfies bucket
CREATE POLICY "Allow authenticated upload to fundi-selfies" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'fundi-selfies' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Allow authenticated read from fundi-selfies" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'fundi-selfies' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Allow authenticated delete from fundi-selfies" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'fundi-selfies' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policies for fundi-certificates bucket
CREATE POLICY "Allow authenticated upload to fundi-certificates" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'fundi-certificates' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Allow authenticated read from fundi-certificates" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'fundi-certificates' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Allow authenticated delete from fundi-certificates" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'fundi-certificates' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
