# Fundi Registration Backend Architecture

## Overview

This document describes the backend data storage structure for fundi (service professional) registration submissions in the FundiHub application.

## Directory Structure

```
src/
├── modules/
│   └── fundis/
│       ├── fundi.model.ts         # Type definitions
│       ├── fundi.service.ts       # Business logic & data persistence
│       ├── fundi.controller.ts    # Orchestration & file uploads
│       ├── fundi.routes.ts        # API route handlers
│       └── index.ts               # Module exports
```

## Database Schema

### `fundi_profiles` Table

Stores all fundi registration submissions with the following fields:

#### Personal Information
- `id` (UUID): Primary key
- `user_id` (UUID): Foreign key to Supabase auth user (unique)
- `first_name` (VARCHAR): Fundi's first name
- `last_name` (VARCHAR): Fundi's last name
- `email` (VARCHAR): Email address
- `phone` (VARCHAR): Phone number

#### ID Verification
- `id_number` (VARCHAR): National ID or passport number
- `id_number_extracted` (VARCHAR): ID number extracted from OCR
- `id_name_extracted` (VARCHAR): Name extracted from ID via OCR

#### File Paths (Stored in Supabase Storage)
- `id_photo_path` (VARCHAR): Path to ID front photo
- `id_photo_back_path` (VARCHAR): Path to ID back photo
- `selfie_path` (VARCHAR): Path to selfie photo
- `certificate_paths` (TEXT[]): Array of certificate file paths

#### GPS Location Data
- `latitude` (DECIMAL): Location latitude (-90 to 90)
- `longitude` (DECIMAL): Location longitude (-180 to 180)
- `accuracy` (INTEGER): GPS accuracy in meters
- `altitude` (DECIMAL): Altitude in meters
- `location_address` (VARCHAR): Reverse-geocoded address
- `location_area` (VARCHAR): Area/suburb name
- `location_estate` (VARCHAR): Estate name
- `location_city` (VARCHAR): City name
- `location_captured_at` (BIGINT): Timestamp when location was captured

#### Professional Information
- `skills` (TEXT[]): Array of service skills (plumbing, electrical, etc.)
- `experience_years` (INTEGER): Years of experience
- `mpesa_number` (VARCHAR): M-Pesa phone number for payments

#### Verification Status
- `verification_status` (VARCHAR): One of: `pending`, `approved`, `rejected`
- `verification_notes` (TEXT): Admin notes for approval/rejection

#### Timestamps
- `created_at` (TIMESTAMP): When record was created
- `updated_at` (TIMESTAMP): When record was last updated
- `submitted_at` (TIMESTAMP): When registration was submitted

## Storage Buckets

Files are stored in Supabase Storage in separate buckets:

### `fundi-ids` (Private)
- Stores ID front and back photos
- Path format: `{user_id}/id-front-{timestamp}.jpg`
- Access: Only authenticated fundi can read their own files; admin can read all

### `fundi-selfies` (Private)
- Stores selfie photos
- Path format: `{user_id}/selfie-{timestamp}.jpg`
- Access: Only authenticated fundi can read their own files; admin can read all

### `fundi-certificates` (Private)
- Stores optional professional certificates
- Path format: `{user_id}/certificate-{index}-{timestamp}.pdf`
- Access: Only authenticated fundi can read their own files; admin can read all

## Row Level Security (RLS) Policies

### `fundi_profiles` Table Policies

1. **Select Policy (Fundi)**
   - Fundis can view only their own registration
   - Admins can view all registrations

2. **Insert Policy**
   - Fundis can insert only their own registration

3. **Update Policy**
   - Fundis can update their registration only if status is `pending`
   - Admins can update any registration

### Storage Bucket Policies

- **Anonymous**: No access
- **Authenticated Users**: Can list/read/write only their own files (`user_id` matches)
- **Admin Role**: Can list/read all files

## Module Architecture

### `fundi.model.ts`
Defines TypeScript interfaces for type safety:
- `FundiRegistrationData`: Complete registration data structure
- `FundiGPSData`: GPS location information
- `FundiFileUpload`: File metadata
- `VerificationStatus`: Enum for registration status

### `fundi.service.ts`
Handles data persistence and validation:
- `validateFundiRegistration()`: Validates all required fields
- `uploadFundiFile()`: Uploads file to Supabase storage
- `saveFundiRegistration()`: Persists registration to database
- `getFundiRegistration()`: Retrieves fundi's registration
- `updateFundiVerificationStatus()`: Updates status (admin only)

### `fundi.controller.ts`
Orchestrates the registration flow:
- `handleFundiSubmission()`: Coordinates file uploads and data save
- `prepareFileForUpload()`: Validates and prepares files for upload
- Progress tracking during submission

### `fundi.routes.ts`
Provides route handlers:
- `submitRegistration()`: Entry point for registration submission
- Authentication and authorization checks

## Data Flow

### Registration Submission Flow

1. **User fills registration form** → FundiRegister component
2. **Validation** → Form fields checked client-side
3. **File Upload Phase**
   - ID front photo → `fundi-ids` bucket
   - ID back photo → `fundi-ids` bucket
   - Selfie → `fundi-selfies` bucket
   - Certificates → `fundi-certificates` bucket
4. **Data Persistence**
   - All data saved to `fundi_profiles` table
   - File paths stored (not raw files)
5. **Response**
   - Success status
   - Registration status = `pending`
   - Ready for admin review

### Admin Review Flow

1. **Admin views pending registrations** (future feature)
2. **Admin reviews**:
   - ID photos (OCR extracted name matches)
   - Selfie (liveness detection)
   - GPS location (accuracy & plausible)
   - Professional credentials
3. **Admin approves or rejects**
   - Status updated to `approved` or `rejected`
   - Notes added for feedback
4. **Fundi notifications** (future feature)
   - Email/SMS notification of decision

## Security

### Authentication
- Only authenticated Supabase users can submit registrations
- User ID from JWT token must match registration submission

### Authorization
- **Fundis**: Can only access their own registration
- **Admins**: Can access all registrations (via role in JWT)
- RLS policies enforce these rules at database level

### File Security
- Files stored in private buckets (not publicly accessible)
- File paths stored in database (not raw file data)
- Storage bucket policies restrict access

### Data Validation
- Required fields enforced at application level
- Database constraints enforce data integrity
- GPS coordinates validated for valid ranges

## Validation Rules

Submission is rejected if:
- ❌ First name or last name missing
- ❌ Email or phone missing
- ❌ ID number missing
- ❌ ID photo not uploaded
- ❌ Selfie not uploaded
- ❌ GPS location not captured
- ❌ At least one skill not selected

Warnings issued if:
- ⚠️ Location address could not be resolved
- ⚠️ Experience information missing
- ⚠️ M-Pesa number not provided

## API Endpoints (Future)

When a dedicated backend API is implemented, these endpoints would be available:

```
POST /api/fundis/register
  - Submit fundi registration
  - Body: FundiRegistrationData
  - Response: FundiRegistrationResponse

GET /api/fundis/me
  - Get current fundi's registration
  - Response: FundiRegistrationData

GET /api/fundis/:userId/status
  - Get fundi's verification status
  - Response: { status: VerificationStatus, notes?: string }

# Admin endpoints
GET /api/admin/fundis
  - List all fundi registrations
  - Query: ?status=pending&page=1&limit=20

PUT /api/admin/fundis/:userId/verify
  - Update fundi verification status
  - Body: { status: VerificationStatus, notes?: string }
```

## Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GOOGLE_MAPS_API_KEY=optional-for-better-geocoding
```

## Testing Checklist

- ✅ Fundi can submit complete registration
- ✅ Files uploaded to correct storage buckets
- ✅ Data persisted to database
- ✅ Registration status defaults to `pending`
- ✅ Fundi cannot access other fundis' registrations
- ✅ Admin can view all registrations
- ✅ Data survives page reload
- ✅ Validation rejects incomplete submissions
- ✅ GPS coordinates saved accurately
- ✅ Location address reverse-geocoded

## Future Enhancements

1. **Admin Dashboard**
   - View pending registrations
   - Approve/reject with notes
   - Filter by status, location, skills

2. **Background Verification**
   - Automated checks on OCR name matches
   - GPS plausibility verification
   - Certificate validation

3. **Notifications**
   - Email to fundi on approval/rejection
   - SMS reminder for pending reviews

4. **Audit Trail**
   - Track all status changes
   - Record admin actions
   - Timestamp all updates

5. **Batch Operations**
   - Bulk approval/rejection
   - Export registrations
   - Data analytics

## Troubleshooting

### Registration submission fails
- Check all required fields are filled
- Verify files are within 10MB size limit
- Ensure GPS location was captured
- Check browser console for specific error message

### Files not uploading
- Verify storage buckets exist in Supabase
- Check bucket policies allow uploads
- Ensure file MIME types are image (JPEG, PNG, WebP)
- Check network connectivity

### Data not persisting
- Verify `fundi_profiles` table exists
- Check RLS policies allow inserts
- Ensure user is authenticated
- Review Supabase dashboard for migration status

### Admin cannot see registrations
- Verify admin role is set in JWT metadata
- Check RLS policies for admin access
- Ensure admin user has `role: 'admin'` in metadata

## Support

For issues or questions about the fundi backend system, refer to:
- Fundi module: `src/modules/fundis/`
- Database migrations: `supabase/migrations/`
- Frontend integration: `src/pages/FundiRegister.tsx`
