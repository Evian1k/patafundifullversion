# Admin Panel - Routes & API Reference

## 🗺️ All Admin Routes

### Public Routes (No Auth Required)
```
GET  /admin/login              → Admin login page
```

### Protected Routes (Auth Required)
Accessed through `AdminLayout` component with session validation.

#### Dashboard
```
GET  /admin/dashboard          → Analytics & KPIs
     Resources: fundi_profiles, jobs
     Permissions: Any admin role
```

#### Fundi Verification
```
GET    /admin/verification                → List pending applications
       Query: Search by ID number, user_id, status
       Permissions: support_admin, super_admin
       
PATCH  /admin/verification/:fundiId       → Approve/Reject
       Body: { verification_status: 'approved' | 'rejected' }
       Permissions: support_admin, super_admin
```

#### Job Management
```
GET    /admin/jobs                        → List all jobs with filters
       Query: status, search term, pagination
       Permissions: support_admin, super_admin
       
PATCH  /admin/jobs/:jobId                 → Update job status
       Body: { status: 'paused' | 'cancelled' | 'assigned' }
       Permissions: support_admin, super_admin
```

#### User Management
```
GET    /admin/users                       → List all fundis
       Query: Search by user_id, skills
       Permissions: super_admin only
       
PATCH  /admin/users/:userId               → Ban/Unban user
       Body: { is_available: true | false }
       Permissions: super_admin only
```

#### Disputes & Reports
```
GET    /admin/disputes                    → List all disputes
       Query: Filter by status, type
       Permissions: support_admin, super_admin
       
PATCH  /admin/disputes/:disputeId         → Resolve dispute
       Body: { status: 'resolved', resolution: 'refund' | 'reassign' | 'ban' }
       Permissions: support_admin, super_admin
```

---

## 🔌 Supabase API Endpoints

### Base URL
```
https://tudclrlaxmxfmzjnbkac.supabase.co/rest/v1
```

### Authentication Header
```
Authorization: Bearer {SESSION_TOKEN}
apikey: {VITE_SUPABASE_PUBLISHABLE_KEY}
```

---

## 📡 API Calls by Feature

### 1. Dashboard Analytics

**Fetch Total Users**
```sql
GET /fundi_profiles?select=id
```
Response: Array of all fundis
```json
[
  { "id": "uuid", ... },
  { "id": "uuid", ... }
]
```

**Fetch Pending Verifications**
```sql
GET /fundi_profiles?select=*&verification_status=eq.pending&count=exact
```

**Fetch Active Jobs**
```sql
GET /jobs?select=*&status=in.("assigned","in_progress")&count=exact
```

**Fetch Total Revenue**
```sql
GET /jobs?select=final_price&status=eq.completed
```
Process: Sum all `final_price` values

---

### 2. Fundi Verification Management

**List Pending Applications**
```javascript
const { data, error } = await supabase
  .from('fundi_profiles')
  .select('*')
  .eq('verification_status', 'pending')
  .order('created_at', { ascending: false });
```

**Approve Fundi**
```javascript
const { error } = await supabase
  .from('fundi_profiles')
  .update({ verification_status: 'approved' })
  .eq('id', fundiId);
```

**Reject Fundi**
```javascript
const { error } = await supabase
  .from('fundi_profiles')
  .update({ verification_status: 'rejected' })
  .eq('id', fundiId);
```

**Fetch Images (Base64)**
```javascript
// Images are stored as base64 strings in:
// - id_photo_url (ID document)
// - selfie_url (selfie photo)

// Display directly in <img> tag:
<img src={fundi.id_photo_url} alt="ID" />
```

---

### 3. Job Management

**List All Jobs with Filtering**
```javascript
const { data, error } = await supabase
  .from('jobs')
  .select('*')
  .eq('status', 'assigned')  // Optional filter
  .order('created_at', { ascending: false });
```

**Pause Job**
```javascript
const { error } = await supabase
  .from('jobs')
  .update({ status: 'paused' })
  .eq('id', jobId);
```

**Cancel Job**
```javascript
const { error } = await supabase
  .from('jobs')
  .update({ status: 'cancelled' })
  .eq('id', jobId);
```

**Reassign Job**
```javascript
const { error } = await supabase
  .from('jobs')
  .update({ fundi_id: newFundiId })
  .eq('id', jobId);
```

**Fetch Job Photos**
```javascript
const { data, error } = await supabase
  .from('job_photos')
  .select('*')
  .eq('job_id', jobId);
```

---

### 4. User Management (Super Admin)

**List All Users**
```javascript
const { data, error } = await supabase
  .from('fundi_profiles')
  .select('*')
  .order('created_at', { ascending: false });
```

**Ban User**
```javascript
const { error } = await supabase
  .from('fundi_profiles')
  .update({ is_available: false })
  .eq('id', userId);
```

**Reactivate User**
```javascript
const { error } = await supabase
  .from('fundi_profiles')
  .update({ is_available: true })
  .eq('id', userId);
```

**Search Users**
```javascript
const { data, error } = await supabase
  .from('fundi_profiles')
  .select('*')
  .or(`user_id.ilike.%${searchTerm}%,skills.cs.{"${searchTerm}"}`);
```

---

### 5. Disputes Management

**List Disputes** (Mock - ready for DB integration)
```javascript
// Currently using mock data
// When disputes table is created, query:

const { data, error } = await supabase
  .from('disputes')
  .select('*')
  .order('created_at', { ascending: false });
```

**Resolve Dispute**
```javascript
const { error } = await supabase
  .from('disputes')
  .update({
    status: 'resolved',
    resolution_type: 'refund',  // or 'reassign', 'ban'
    resolved_by: adminId,
    resolved_at: new Date().toISOString()
  })
  .eq('id', disputeId);
```

---

## 🔐 Authentication Flow

### Login Process
```
1. User enters email + password
2. Supabase auth.signInWithPassword()
3. Check admin_accounts table for user
4. Verify role (super_admin | support_admin)
5. Store session in localStorage
6. Redirect to /admin/dashboard
```

### Code Example
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

const adminUser = await supabase
  .from('admin_accounts')
  .select('*')
  .eq('email', email)
  .single();

if (adminUser.role === 'super_admin' || adminUser.role === 'support_admin') {
  localStorage.setItem('admin_session', JSON.stringify({
    userId: data.user.id,
    role: adminUser.role,
    email: adminUser.email,
  }));
  // Navigate to dashboard
}
```

### Logout Process
```
1. Clear Supabase session: supabase.auth.signOut()
2. Remove localStorage admin_session
3. Redirect to /admin/login
```

---

## 📊 Database Tables Reference

### fundi_profiles
```sql
SELECT 
  id,                    -- UUID
  user_id,              -- FK to auth.users
  id_number,            -- Extracted from ID document
  id_photo_url,         -- Base64 encoded ID image
  selfie_url,           -- Base64 encoded selfie
  verification_status,  -- pending | approved | rejected
  skills,               -- Array of skills
  experience_years,     -- Years of experience
  is_available,         -- Active/banned status
  created_at,
  updated_at
FROM fundi_profiles;
```

### jobs
```sql
SELECT 
  id,                   -- UUID
  title,               -- Job title
  description,         -- Job description
  status,              -- pending | assigned | completed | cancelled | paused
  customer_id,         -- FK to auth.users
  fundi_id,            -- FK to fundi_profiles
  location,            -- Job location
  latitude,            -- GPS coordinate
  longitude,           -- GPS coordinate
  estimated_price,     -- Estimated cost
  final_price,         -- Actual cost
  created_at,
  completed_at
FROM jobs;
```

### admin_accounts
```sql
SELECT 
  id,                  -- UUID
  user_id,            -- FK to auth.users
  email,              -- Admin email
  role,               -- super_admin | support_admin
  is_active,          -- Status
  created_at
FROM admin_accounts;
```

### admin_audit_log
```sql
SELECT 
  id,                 -- UUID
  admin_id,          -- FK to admin_accounts
  action,            -- 'approve', 'reject', 'ban', etc
  table_name,        -- Which table was modified
  record_id,         -- ID of modified record
  old_data,          -- JSONB of previous values
  new_data,          -- JSONB of new values
  ip_address,        -- Admin's IP
  created_at
FROM admin_audit_log;
```

---

## 🔍 Query Examples

### Complex: Fundi Verification Analytics
```sql
SELECT 
  verification_status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM fundi_profiles
GROUP BY verification_status;

-- Result: pending | 5 | 33.33
--         approved | 7 | 46.67
--         rejected | 3 | 20.00
```

### Complex: Top Earning Fundis
```sql
SELECT 
  f.id,
  f.skills,
  SUM(j.final_price) as total_earned,
  COUNT(j.id) as jobs_completed,
  AVG(f.rating) as avg_rating
FROM fundi_profiles f
LEFT JOIN jobs j ON f.user_id = j.fundi_id AND j.status = 'completed'
GROUP BY f.id
ORDER BY total_earned DESC
LIMIT 10;
```

### Complex: Job Status Distribution
```sql
SELECT 
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600) as avg_hours
FROM jobs
GROUP BY status
ORDER BY count DESC;
```

---

## ⚙️ RLS Policies

### fundi_profiles Access
```sql
-- Users can insert own profile
WITH CHECK (auth.uid() = user_id)

-- Admins can view/update all
USING (auth.role() = 'admin' OR auth.uid() = user_id)
```

### jobs Access
```sql
-- Customers can view own jobs
USING (customer_id = auth.uid())

-- Fundis can view assigned jobs
OR (fundi_id = auth.uid() AND status IN ('assigned', 'in_progress'))

-- Admins can view all
OR (auth.jwt() ->> 'role' IN ('admin'))
```

### admin_accounts Access
```sql
-- Only super_admin can view all
USING (auth.jwt() ->> 'role' = 'super_admin')

-- Admins can view own account
OR (user_id = auth.uid())
```

---

## 🧪 Test Cases

### TC-001: Admin Login
```
1. Navigate to /admin/login
2. Enter email: admin@fixit.com
3. Enter password: correct
4. Expected: Redirect to /admin/dashboard
5. Verify: Sidebar shows admin name and role
```

### TC-002: Approve Fundi
```
1. Navigate to /admin/verification
2. Click pending fundi application
3. Click "Approve" button
4. Expected: Status changes to "approved"
5. Verify: Updated in database
   SELECT verification_status FROM fundi_profiles WHERE id = 'test_id';
```

### TC-003: Pause Job
```
1. Navigate to /admin/jobs
2. Search for any job
3. Click job card
4. Click "Pause Job" button
5. Expected: Job status = 'paused'
6. Verify: Database updated
   SELECT status FROM jobs WHERE id = 'test_id';
```

### TC-004: Ban User
```
1. Navigate to /admin/users
2. Search user
3. Click "Ban User"
4. Expected: is_available = false
5. Expected: User cannot login
```

### TC-005: Auto-Logout
```
1. Login to admin panel
2. Do not interact for 15 minutes
3. Click anywhere on page
4. Expected: Redirect to /admin/login
5. Verify: Session cleared from localStorage
```

---

## 📋 Performance Considerations

### Indexes Needed
```sql
CREATE INDEX idx_fundi_verification_status 
ON fundi_profiles(verification_status);

CREATE INDEX idx_jobs_status 
ON jobs(status);

CREATE INDEX idx_jobs_created_at 
ON jobs(created_at DESC);

CREATE INDEX idx_admin_email 
ON admin_accounts(email);
```

### Pagination (Future Enhancement)
```javascript
// Fetch with pagination
const { data, error } = await supabase
  .from('fundi_profiles')
  .select('*')
  .range(0, 24)  // First 25 records
  .order('created_at', { ascending: false });
```

---

## 🚨 Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Not logged in | Redirect to /admin/login |
| 42501 RLS Violation | No permission | Verify admin role & RLS policies |
| 404 Not Found | Record deleted | Handle gracefully, reload list |
| 400 Bad Request | Invalid data | Validate input before submit |

### Error Response Format
```json
{
  "code": "42501",
  "message": "new row violates row-level security policy",
  "details": null
}
```

---

**API Reference Version: 1.0**
**Updated: January 31, 2026**
