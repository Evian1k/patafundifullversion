# Admin Panel - Complete Setup Guide

## Overview
A production-ready admin panel for the Fixit-Connect platform with role-based access control, fundi verification management, job oversight, and dispute resolution.

---

## 🔐 Authentication & Access Control

### Admin Roles
1. **Super Admin** - Full system access
2. **Support Admin** - Limited access (verification, jobs, disputes)

### Setup Steps

#### Step 1: Create Admin Table in Supabase
Run this SQL in your Supabase SQL Editor:

```sql
-- Execute this file: /supabase/migrations/20260131_create_admin_system.sql
```

#### Step 2: Insert Admin Accounts
```sql
INSERT INTO admin_accounts (user_id, email, role, is_active)
SELECT id, email, 'super_admin', true
FROM auth.users
WHERE email = 'admin@fixit.com';
```

#### Step 3: Test Login
- Navigate to `/admin/login`
- Use your Supabase auth credentials
- System verifies admin role from `admin_accounts` table

---

## 📋 Admin Routes

```
/admin/login                    → Admin login page
/admin/dashboard               → Dashboard with analytics
/admin/verification            → Fundi verification management
/admin/jobs                    → Job management & oversight
/admin/users                   → User management (Super Admin only)
/admin/disputes                → Disputes & reports handling
/admin/settings                → System settings (Super Admin only)
```

---

## 📊 Admin Dashboard

### Features
- **Total Users & Fundis**: Real-time user counts
- **Pending Verifications**: Count of applications awaiting review
- **Active Jobs**: Currently assigned jobs
- **Failed ID Checks**: Fraud flagged applications
- **Revenue Overview**: Total platform revenue from completed jobs
- **Charts**: Weekly jobs and revenue trends

### Data Sources
- `fundi_profiles` - User data
- `jobs` - Job listings and status
- Real-time analytics with Recharts visualizations

---

## ✅ Fundi Verification System

### Core Features

#### 1. Application Review List
- Search by ID number, user ID, or status
- Filter by verification status (pending/approved/rejected)
- Real-time update of application count

#### 2. Side-by-Side Comparison
- Display ID photo (extracted from base64)
- Display selfie photo (extracted from base64)
- Show extracted OCR data vs user-entered data
- Highlight mismatches automatically

#### 3. Admin Actions
- **Approve**: Instant approval with `verification_status = 'approved'`
- **Reject**: With mandatory reason field
- Status updates reflect instantly in user profile

### Database Operations
```sql
-- Approve fundi
UPDATE fundi_profiles 
SET verification_status = 'approved' 
WHERE id = 'fundi_id';

-- Reject fundi
UPDATE fundi_profiles 
SET verification_status = 'rejected' 
WHERE id = 'fundi_id';
```

---

## 💼 Job Management

### Features
- **View All Jobs**: Complete job listings with real-time updates
- **Advanced Filtering**: By status (pending, assigned, completed, disputed)
- **Search**: By job title, location, or job ID
- **Job Details**: Title, description, location with GPS coordinates, pricing

### Admin Actions
- **Pause Job**: Temporarily halt job progress
- **Cancel Job**: Full job cancellation
- **Reassign**: Move job to different fundi (placeholder)

### Job Status Workflow
```
pending → assigned → completed ✓
  ↓                     ↓
paused              cancelled
```

---

## 👥 User Management (Super Admin Only)

### Features
- **Search Users**: By user ID, skills, or verification status
- **View User Details**: Skills, experience, joining date
- **Account Status**: Active/Banned toggle

### Admin Actions
- **Ban User**: Remove access and mark as unavailable
- **Reactivate**: Restore account access
- **View History**: Access control and violation log (placeholder)

---

## ⚠️ Disputes & Reports

### Dispute Types
1. **Customer Report**: Customer disputes fundi's work quality
2. **Fundi Report**: Fundi reports customer non-payment or disputes

### Resolution Options
- **Refund**: Return payment to customer
- **Reassign**: Move job to different fundi
- **Ban**: Suspend problematic user account

### Features
- Chat history between parties (placeholder)
- Evidence image uploads
- Dispute status tracking (open/resolved/closed)
- Resolution notes

---

## 🔒 Security Features

### 1. Auto-Logout
- 15-minute inactivity timeout
- Activity reset on mouse/keyboard/scroll events
- Automatic session clearing

### 2. RLS Policies
```sql
-- Users can only insert their own profile
CREATE POLICY "Users can insert their own profile"
ON fundi_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON fundi_profiles FOR SELECT
USING (auth.role() = 'admin');
```

### 3. Admin Audit Log
- Track all admin actions
- Store old/new data for compliance
- Timestamp and IP logging

---

## 🛠️ Technical Architecture

### File Structure
```
src/
├── pages/admin/
│   ├── AdminLogin.tsx              (Login form)
│   ├── Dashboard.tsx               (Analytics dashboard)
│   ├── VerificationManagement.tsx  (Fundi review)
│   ├── JobManagement.tsx           (Job oversight)
│   ├── UserManagement.tsx          (User control)
│   └── DisputesAndReports.tsx      (Dispute resolution)
├── components/admin/
│   └── AdminLayout.tsx             (Sidebar + auth)
└── integrations/supabase/
    ├── client.ts                   (Supabase client)
    └── types.ts                    (Database types)
```

### Database Tables
```sql
-- Primary tables
fundi_profiles        -- User data (extended for admin)
jobs                  -- Job listings
job_bids              -- Job bidding
job_photos            -- Job images

-- Admin tables
admin_accounts        -- Admin users & roles
admin_audit_log       -- Action logging
```

### API Endpoints (Supabase)
```
GET    /rest/v1/fundi_profiles           (Fetch fundis)
PATCH  /rest/v1/fundi_profiles           (Update verification status)
GET    /rest/v1/jobs                     (Fetch jobs)
PATCH  /rest/v1/jobs                     (Update job status)
GET    /rest/v1/admin_accounts           (Admin verification)
INSERT /rest/v1/admin_audit_log          (Log actions)
```

---

## 📊 Fraud Protection Rules

### Implemented
1. ✅ One ID = One Fundi (check via `id_number` uniqueness)
2. ✅ Name + ID must match OCR (compared during verification)
3. ✅ Location validation (GPS coordinates checked)
4. ✅ Duplicate detection (ID & selfie hashing)
5. ✅ Manual review flags

### To Implement
```sql
-- Add indexes for performance
CREATE INDEX idx_fundi_id_number ON fundi_profiles(id_number);
CREATE INDEX idx_fundi_user_id ON fundi_profiles(user_id);
CREATE UNIQUE INDEX idx_one_id_per_user ON fundi_profiles(id_number) 
WHERE verification_status = 'approved';
```

---

## 🚀 Deployment Checklist

### Pre-Launch
- [ ] Run all migration files in Supabase SQL Editor
- [ ] Create at least one super admin account
- [ ] Set inactivity timeout (default: 15 min)
- [ ] Configure email notifications
- [ ] Test all admin actions in production
- [ ] Verify RLS policies are active
- [ ] Enable audit logging

### Environment Variables
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_public_key
```

---

## 🧪 Testing Admin Features

### Test Case 1: Fundi Verification
1. Register as fundi (fill all steps)
2. Login as admin
3. Navigate to `/admin/verification`
4. View application with images
5. Click "Approve" or "Reject"
6. Verify status change instantly

### Test Case 2: Job Management
1. Create job as customer
2. Bid as fundi
3. Accept bid as customer
4. Login as admin → `/admin/jobs`
5. Pause/Cancel job
6. Verify status update

### Test Case 3: Auto-Logout
1. Login as admin
2. Wait 15 minutes (or modify timer for testing)
3. Click anywhere
4. Should redirect to login

---

## 📈 Analytics Data Points

### Dashboard Queries
```sql
-- Total verified fundis
SELECT COUNT(*) FROM fundi_profiles WHERE verification_status = 'approved';

-- Pending verifications
SELECT COUNT(*) FROM fundi_profiles WHERE verification_status = 'pending';

-- Active jobs
SELECT COUNT(*) FROM jobs WHERE status IN ('assigned', 'in_progress');

-- Total revenue
SELECT SUM(final_price) FROM jobs WHERE status = 'completed';

-- Weekly jobs
SELECT DATE_TRUNC('day', created_at), COUNT(*) 
FROM jobs 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', created_at);
```

---

## 🔧 Troubleshooting

### Admin login fails
- Check email exists in Supabase auth
- Verify `admin_accounts` record created
- Ensure password is correct

### Images not displaying
- Verify base64 strings stored correctly in `id_photo_url` and `selfie_url`
- Check if strings start with `data:image/`
- Base64 strings should be < 5MB (image size limit)

### Changes not reflecting
- Verify RLS policies are active (check Supabase dashboard)
- Ensure authenticated user has proper role
- Check browser console for API errors

### Performance issues
- Add indexes on frequently queried columns
- Implement pagination for large result sets
- Use view layer caching for charts

---

## 📝 Future Enhancements

1. **Multi-language Support**: Admin panel localization
2. **Batch Actions**: Approve/reject multiple fundis at once
3. **Advanced Analytics**: Heatmaps, user behavior tracking
4. **Automated Rules**: Auto-approve/reject based on criteria
5. **Mobile Admin App**: React Native version for on-the-go
6. **API Keys**: For third-party integrations
7. **Export Reports**: CSV/PDF exports for audits
8. **Real-time Notifications**: WebSocket alerts for disputes

---

## 📞 Support

For issues or questions:
1. Check database RLS policies in Supabase dashboard
2. Verify migration files were executed
3. Review browser console for errors
4. Check Supabase logs for API failures
5. Ensure admin_accounts table has your email with correct role

---

**Admin Panel Version: 1.0.0**
**Last Updated: January 31, 2026**
