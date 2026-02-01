# Fundi Backend Setup Instructions

## Step 1: Apply Database Migration

To create the `fundi_profiles` table and enable Row Level Security, run the migration:

```bash
cd /home/emmanuel/EE/fixit-connect
supabase db push
```

Or manually run the SQL in Supabase console:
- Open [Supabase Dashboard](https://app.supabase.com)
- Go to SQL Editor
- Copy contents of `supabase/migrations/20260201_create_fundi_profiles.sql`
- Run the SQL

## Step 2: Create Storage Buckets

Create three private buckets in Supabase Storage:

### Via Supabase Dashboard:
1. Go to **Storage** → **Buckets**
2. Click **+ New bucket**
3. Create bucket: `fundi-ids`
   - Public: OFF (Private)
4. Create bucket: `fundi-selfies`
   - Public: OFF (Private)
5. Create bucket: `fundi-certificates`
   - Public: OFF (Private)

### Via Supabase CLI:
```bash
supabase storage create fundi-ids --private
supabase storage create fundi-selfies --private
supabase storage create fundi-certificates --private
```

## Step 3: Set Storage Policies (Optional)

Storage policies are managed in Supabase dashboard under **Storage** → **Policies**.

Default RLS for authenticated users:
- Users can read/write their own files
- Path must start with their user ID: `{user_id}/*`

## Step 4: Verify Backend Integration

1. **Build the app:**
   ```bash
   npm run build
   ```

2. **Start dev server:**
   ```bash
   npm run dev
   ```

3. **Test registration:**
   - Open http://localhost:8080
   - Go to Fundi Registration
   - Complete all 5 steps
   - Submit registration
   - Check Supabase console:
     - Data should appear in `fundi_profiles` table
     - Files should appear in storage buckets

## Step 5: Test Data Persistence

1. Submit a fundi registration
2. Reload the page
3. Check Supabase dashboard:
   - **SQL Editor** → Query `fundi_profiles` table:
     ```sql
     SELECT * FROM fundi_profiles ORDER BY created_at DESC LIMIT 1;
     ```
   - **Storage** → Check buckets for uploaded files

## What Gets Stored

### Database (`fundi_profiles`)
```json
{
  "user_id": "uuid-from-auth",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+254712345678",
  "id_number": "12345678",
  "id_photo_path": "uuid/id-front-1706821200000.jpg",
  "id_photo_back_path": "uuid/id-back-1706821200000.jpg",
  "selfie_path": "uuid/selfie-1706821200000.jpg",
  "latitude": -1.2865,
  "longitude": 36.8172,
  "accuracy": 50,
  "location_address": "Nairobi, Kenya",
  "skills": ["Plumbing", "Electrical"],
  "experience_years": 5,
  "mpesa_number": "+254712345678",
  "verification_status": "pending",
  "created_at": "2026-02-01T10:30:00Z",
  "submitted_at": "2026-02-01T10:30:00Z"
}
```

### Storage Buckets
```
fundi-ids/
  {user_id}/
    id-front-{timestamp}.jpg
    id-back-{timestamp}.jpg

fundi-selfies/
  {user_id}/
    selfie-{timestamp}.jpg

fundi-certificates/
  {user_id}/
    certificate-0-{timestamp}.pdf
```

## Validation & Error Handling

### Submission Validation
Rejects if:
- ✗ Name, email, phone, or ID missing
- ✗ ID photo not uploaded
- ✗ Selfie not uploaded
- ✗ GPS location not captured
- ✗ No skills selected

### File Upload Validation
- File size: max 10MB
- File types: JPEG, PNG, WebP
- Stored with timestamp for uniqueness

### Database Constraints
- Coordinates within valid ranges: ±90° lat, ±180° lon
- Status must be: pending, approved, or rejected
- User ID must be unique (one registration per user)

## Security Features Enabled

✅ **Authentication Required**
- Only logged-in fundis can submit
- User ID must match their auth ID

✅ **Row Level Security (RLS)**
- Fundis see only their registration
- Admins can see all (if role is set)

✅ **Private Storage**
- Files not publicly accessible
- Path-based access control

✅ **Encryption**
- Supabase encrypts data at rest
- HTTPS for all connections

## Troubleshooting

### Error: "Table 'fundi_profiles' doesn't exist"
- Run the database migration
- Check Supabase SQL editor for errors

### Error: "Permission denied" on file upload
- Verify storage buckets exist
- Check bucket policies
- Ensure user is authenticated

### Registration data not saving
- Check browser console for errors
- Verify `user_id` matches authenticated user
- Check Supabase dashboard for RLS policy errors

### Files uploaded but missing from table
- Verify file paths are stored correctly
- Check storage bucket paths match database records
- Ensure file upload completed before data save

## Environment Setup

Make sure your `.env` has:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Get these from Supabase Settings → API → Project API keys

## Next Steps

1. **Admin Dashboard** (future)
   - View pending registrations
   - Approve/reject submissions

2. **Email Notifications** (future)
   - Notify fundi on approval/rejection

3. **Background Verification** (future)
   - Automated OCR validation
   - GPS plausibility checks

## Support

For detailed architecture docs, see: [FUNDI_BACKEND_DOCS.md](./FUNDI_BACKEND_DOCS.md)

Questions? Check:
- `src/modules/fundis/` - Backend module code
- `supabase/migrations/` - Database schema
- `src/pages/FundiRegister.tsx` - Frontend integration
