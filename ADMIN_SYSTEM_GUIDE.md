# Admin System - Complete Implementation Guide

## 🎯 Overview

The admin system provides complete control, verification, and monitoring powers for managing fundis, customers, and jobs on the FixIt Connect platform.

### Key Features:
- ✅ Admin authentication with role-based access control
- ✅ Fundi verification and approval workflow
- ✅ Real-time dashboard with statistics
- ✅ Advanced search and filtering
- ✅ Action logging and audit trail
- ✅ Customer monitoring (read-only)
- ✅ Job management and status tracking

---

## 📦 Architecture

### Backend Structure
```
backend/
├── src/
│   ├── routes/
│   │   ├── admin.js          # All admin endpoints
│   │   └── auth.js           # Auth including admin creation
│   ├── middlewares/
│   │   └── auth.js           # Role-based access control
│   ├── services/
│   │   └── adminLogger.js    # Action logging
│   └── db/
│       └── schema.js         # Database schema with admin tables
├── scripts/
│   └── setup-admin.js        # Create first admin account
```

### Frontend Structure
```
frontend/src/
├── pages/admin/
│   ├── AdminLogin.tsx                    # Admin login page
│   ├── Dashboard.tsx                     # Admin dashboard
│   ├── FundiVerificationManagement.tsx   # Fundi list & search
│   └── FundiVerificationModal.tsx        # Fundi detail & approval
```

---

## 🗄️ Database Schema

### New Tables Added:

#### `admin_action_logs`
Tracks all admin actions for audit trail:
```sql
CREATE TABLE admin_action_logs (
  id UUID PRIMARY KEY,
  admin_id UUID (references users),
  action_type VARCHAR(100),        -- 'approve', 'reject', 'suspend', 'revoke'
  target_type VARCHAR(100),        -- 'fundi', 'customer', 'job'
  target_id UUID,
  old_value TEXT (JSON),           -- Previous state
  new_value TEXT (JSON),           -- New state
  reason TEXT,                     -- Admin's reason
  ip_address VARCHAR(50),
  created_at TIMESTAMP
);
```

### Enhanced Tables:

**users table** - Added support for 'admin' role:
```sql
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'customer';
-- Values: 'customer', 'fundi', 'admin'
```

**fundi_profiles table** - Already had verification_status:
```sql
-- Values: 'pending', 'approved', 'rejected', 'suspended'
verification_status VARCHAR(50) DEFAULT 'pending'
```

---

## 🔐 Authentication & Access Control

### Admin Login
**Endpoint:** `POST /api/auth/login`

Request:
```json
{
  "email": "admin@fixitconnect.com",
  "password": "admin123456"
}
```

Response:
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "admin@fixitconnect.com",
    "fullName": "Admin User",
    "role": "admin"
  },
  "token": "JWT_TOKEN"
}
```

### Role-Based Access Control
All admin endpoints require:
1. Valid JWT token in `Authorization: Bearer <token>` header
2. User role must be `admin`

Middleware in `backend/src/middlewares/auth.js`:
```javascript
export const adminOnly = (req, res, next) => {
  return requireRole('admin')(req, res, next);
};
```

### Creating Additional Admin Accounts
Only existing admins can create new admin accounts:

**Endpoint:** `POST /api/auth/admin/create`

Request:
```json
{
  "email": "newadmin@fixitconnect.com",
  "password": "secure_password",
  "fullName": "New Admin Name"
}
```

---

## 📊 Admin Dashboard

### Statistics API
**Endpoint:** `GET /api/admin/dashboard-stats`

Returns:
```json
{
  "success": true,
  "stats": {
    "totalUsers": 50,              # All customers
    "totalFundis": 15,             # All fundis (any status)
    "pendingVerifications": 3,     # Waiting approval
    "approvedFundis": 10,
    "rejectedFundis": 2,
    "suspendedFundis": 0,
    "activeJobs": 8,               # Searching, accepted, in-progress
    "completedJobs": 25,
    "totalRevenue": 45000          # From completed jobs
  }
}
```

---

## ✅ Fundi Verification Workflow

### 1. Fundi Registration
When a fundi submits registration:
1. Data stored with `verification_status = 'pending'`
2. OCR extracts name and ID number from ID photo
3. Comparison made (match/mismatch)
4. Submission appears in admin queue

### 2. Admin Review
**Endpoint:** `GET /api/admin/pending-fundis?page=1&limit=10`

Lists all pending fundis with:
- Personal information (name, email, phone, ID)
- Uploaded documents (ID front/back, selfie, certificates)
- OCR results and verification status
- GPS location coordinates

### 3. Admin Actions

#### Approve Fundi
**Endpoint:** `POST /api/admin/fundis/{fundiId}/approve`

```json
{
  "notes": "ID matches, documents verified"  // Optional
}
```

Effects:
- `verification_status` → `approved`
- Fundi becomes visible to customers
- Action logged with timestamp and notes

#### Reject Fundi
**Endpoint:** `POST /api/admin/fundis/{fundiId}/reject`

```json
{
  "reason": "ID number does not match extracted data"  // Required
}
```

Effects:
- `verification_status` → `rejected`
- Reason saved in `verification_notes`
- Action logged

#### Suspend Fundi
**Endpoint:** `POST /api/admin/fundis/{fundiId}/suspend`

```json
{
  "reason": "Suspicious activity detected"  // Required
}
```

Effects:
- `verification_status` → `suspended`
- `subscription_active` → `false`
- Action logged

#### Revoke Approval
**Endpoint:** `POST /api/admin/fundis/{fundiId}/revoke`

```json
{
  "reason": "Documents appear fraudulent upon review"  // Optional
}
```

Effects:
- `verification_status` → `pending` (moves back to queue)
- `subscription_active` → `false`
- Action logged

---

## 🔍 Search & Filter

### Search Fundis
**Endpoint:** `GET /api/admin/search-fundis?q=john&status=pending&page=1`

Query Parameters:
- `q` - Search by name, ID number, or phone
- `status` - Filter by: `pending`, `approved`, `rejected`, `suspended`
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 10)

Response:
```json
{
  "success": true,
  "fundis": [
    {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phone": "+254700000000",
      "idNumber": "12345678",
      "verificationStatus": "pending",
      "skills": ["Plumbing", "Electrical"],
      "createdAt": "2026-02-04T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "pages": 5
  }
}
```

### Get Fundi Details
**Endpoint:** `GET /api/admin/fundis/{fundiId}`

Includes:
- All personal information
- Full document URLs
- OCR comparison results
- GPS coordinates
- Complete verification history

---

## 📝 Action Logging

Every admin action is logged:

**Endpoint:** `GET /api/admin/logs/actions?page=1&adminId=xxx&actionType=approve`

Response:
```json
{
  "success": true,
  "logs": [
    {
      "id": "uuid",
      "adminId": "admin_uuid",
      "actionType": "approve",
      "targetType": "fundi",
      "targetId": "fundi_uuid",
      "oldValue": { "status": "pending" },
      "newValue": { "status": "approved" },
      "reason": "Verified documents",
      "ipAddress": "192.168.1.1",
      "createdAt": "2026-02-04T10:35:00Z"
    }
  ],
  "pagination": { ... }
}
```

---

## 👥 Customer Monitoring (Read-Only)

### View All Customers
**Endpoint:** `GET /api/admin/customers?page=1&limit=20`

### View All Jobs
**Endpoint:** `GET /api/admin/jobs?status=pending&customerId=xxx&page=1`

Admins can monitor but **cannot** impersonate customers or fundis.

---

## 🚀 Setup Instructions

### 1. Initialize Database
```bash
cd backend
npm run setup-db
```

This creates all tables including `admin_action_logs`.

### 2. Create First Admin Account
```bash
npm run setup-admin
```

Output:
```
✅ Admin user created successfully!
   Email: admin@fixitconnect.com
   Password: admin123456
```

⚠️ **Change this password immediately in production!**

### 3. Start Backend
```bash
npm run dev
# Runs on http://localhost:5000
```

### 4. Start Frontend
```bash
cd frontend
npm run dev
# Runs on http://localhost:5173
```

### 5. Access Admin Panel
Navigate to: `http://localhost:5173/admin/login`

Login with:
- Email: `admin@fixitconnect.com`
- Password: `admin123456`

---

## 🔗 API Endpoints Reference

### Authentication
```
POST   /api/auth/login              # Login (any role)
POST   /api/auth/admin/create       # Create admin (admin only)
GET    /api/auth/me                 # Get current user
```

### Admin Dashboard
```
GET    /api/admin/dashboard-stats   # Overview statistics
```

### Fundi Verification
```
GET    /api/admin/pending-fundis    # List pending fundis
GET    /api/admin/fundis/{id}       # Get fundi details
GET    /api/admin/search-fundis     # Search fundis
POST   /api/admin/fundis/{id}/approve    # Approve
POST   /api/admin/fundis/{id}/reject     # Reject
POST   /api/admin/fundis/{id}/suspend    # Suspend
POST   /api/admin/fundis/{id}/revoke     # Revoke approval
```

### Monitoring
```
GET    /api/admin/customers         # List customers
GET    /api/admin/jobs              # List jobs
GET    /api/admin/logs/actions      # Action audit trail
```

---

## 🎨 Frontend Pages

### Admin Login
**Route:** `/admin/login`
- Email and password input
- Session check on load
- Redirects to dashboard if authenticated
- Shows error messages

### Admin Dashboard
**Route:** `/admin/dashboard`
- Real-time statistics cards
- Bar and line charts
- Pending actions summary
- Refresh button

### Fundi Verification Management
**Route:** `/admin/fundis`
- Searchable list of fundis
- Status filter (pending/approved/rejected/suspended)
- Pagination
- Click to open detail modal

### Fundi Verification Modal
- Full fundi profile
- All uploaded documents with zoom
- OCR comparison results
- Google Maps link for GPS location
- Approve/Reject/Suspend/Revoke actions
- Notes/reason input
- Action confirmation

---

## 🔒 Security Features

1. **JWT Tokens** - Secure authentication
2. **Role-Based Access** - Only admins access admin routes
3. **Action Logging** - All changes tracked with admin ID, IP, timestamp
4. **No Mock Data** - All operations use real database
5. **Server-Side Validation** - All inputs validated on backend
6. **Protected Routes** - Frontend checks user role before rendering

---

## 📋 Verification Status Flow

```
Registration Submitted
        ↓
  [PENDING] ← Admin reviews documents
        ↓ (can go to any state)
    ┌───────────────────────────────┐
    ↓                               ↓
[APPROVED]                      [REJECTED]
(visible to                    (cannot access
 customers)                     platform)
    ↓
  (can also → [SUSPENDED])
              (temporarily
               disabled)
```

---

## 🧪 Testing the Admin System

### 1. Create Admin Account
```bash
npm run setup-admin
```

### 2. Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@fixitconnect.com",
    "password": "admin123456"
  }'
```

### 3. Check Dashboard
```bash
curl -X GET http://localhost:5000/api/admin/dashboard-stats \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### 4. List Pending Fundis
```bash
curl -X GET http://localhost:5000/api/admin/pending-fundis \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### 5. Approve a Fundi
```bash
curl -X POST http://localhost:5000/api/admin/fundis/{fundiId}/approve \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Verified"}'
```

---

## 🐛 Troubleshooting

### Admin Can't Login
- Verify admin account exists: `SELECT * FROM users WHERE role = 'admin';`
- Check password hash is correct
- Ensure JWT token is valid

### Fundi Not Appearing in Verification Queue
- Check fundi `verification_status` is 'pending'
- Verify all required fields are filled
- Check database connection

### Action Not Logged
- Verify `admin_action_logs` table exists
- Check admin user ID is correct
- Ensure adminLogger.js import is present

### Search Not Working
- Check database indexes on fundi_profiles
- Verify search query has proper escaping
- Test with simple search (e.g., just first name)

---

## 📞 Support

For issues or questions:
1. Check action logs: `/api/admin/logs/actions`
2. Review backend console for errors
3. Check browser network tab for API responses
4. Verify database schema: `\dt` in psql

---

## ✅ Verification Checklist

- [x] Admin authentication working
- [x] Dashboard displays correct statistics
- [x] Fundi search/filter functions
- [x] Approve/reject/suspend actions persist
- [x] Action logging captures all changes
- [x] Documents display correctly
- [x] OCR comparison shows match/mismatch
- [x] GPS location links work
- [x] No mock data in responses
- [x] Frontend routing protected
- [x] Role-based access enforced
- [x] All API endpoints tested

---

**Last Updated:** February 4, 2026
**Status:** Production Ready
