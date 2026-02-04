# Admin System - Quick Start Guide

## 🚀 Start Here

### Prerequisites
- PostgreSQL running on localhost:5432
- Node.js 18+
- Environment variables configured (if needed)

### Step 1: Initialize Database
```bash
cd backend
npm run setup-db
```

✅ Creates all tables including admin_action_logs, fundi_profiles, users, etc.

### Step 2: Create First Admin Account
```bash
npm run setup-admin
```

✅ Output:
```
✅ Admin user created successfully!
   Email: admin@fixitconnect.com
   Password: admin123456
```

### Step 3: Start Backend
```bash
npm run dev
```

✅ Backend running at: http://localhost:5000

### Step 4: Start Frontend
```bash
cd ../frontend
npm run dev
```

✅ Frontend running at: http://localhost:5173

### Step 5: Access Admin Panel
1. Go to: http://localhost:5173/admin/login
2. Login with:
   - Email: `admin@fixitconnect.com`
   - Password: `admin123456`
3. You'll see the Admin Dashboard

---

## 📊 What You Can Do

### Dashboard
- View real-time statistics
- See pending verifications
- Monitor active jobs
- Track revenue

### Fundi Verification
- Search fundis by name, ID, or phone
- Filter by status (pending/approved/rejected/suspended)
- View uploaded documents with zoom
- Check OCR results vs submitted data
- Approve, reject, suspend, or revoke fundis

### Customer Monitoring
- View all customers
- See their jobs
- Monitor job status
- Track job assignments

### Action History
- View all admin actions
- See who did what and when
- Check reasons for decisions
- Audit trail for compliance

---

## 🔑 Key Features

✅ **No Mock Data** - Everything is real from the database

✅ **Role-Based Access** - Only admins can access admin pages

✅ **Action Logging** - Every change is tracked and logged

✅ **Real-Time Stats** - Dashboard updates automatically

✅ **Document Review** - Zoom images, view all uploads

✅ **GPS Integration** - View fundi locations on Google Maps

✅ **OCR Verification** - Automatic ID verification with comparison

✅ **Secure** - JWT tokens, server-side validation, protected routes

---

## 🎯 Common Tasks

### Task: Approve a Fundi
1. Click "Fundi" in admin menu
2. Filter by "Pending Verification"
3. Click "Review" on a fundi
4. Check documents and OCR results
5. Click "Approve" button
6. Fundi becomes visible to customers

### Task: Reject a Fundi
1. Open fundi details
2. Click "Reject" button
3. Enter rejection reason
4. Click "Confirm Reject"
5. Action is logged automatically

### Task: Search for Specific Fundi
1. Go to Fundi Verification page
2. Enter name, ID number, or phone in search
3. Click "Search"
4. Results filtered automatically

### Task: View Action Logs
1. Go to Admin Dashboard
2. Click "Action Logs" (bottom section)
3. Filter by admin, action type, or date
4. See who did what and when

---

## 📱 API Quick Reference

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@fixitconnect.com",
    "password": "admin123456"
  }'
```

### Get Dashboard Stats
```bash
curl -X GET http://localhost:5000/api/admin/dashboard-stats \
  -H "Authorization: Bearer <TOKEN>"
```

### Get Pending Fundis
```bash
curl -X GET http://localhost:5000/api/admin/pending-fundis \
  -H "Authorization: Bearer <TOKEN>"
```

### Approve a Fundi
```bash
curl -X POST http://localhost:5000/api/admin/fundis/{fundiId}/approve \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Documents verified"}'
```

### Search Fundis
```bash
curl -X GET "http://localhost:5000/api/admin/search-fundis?q=john&status=pending" \
  -H "Authorization: Bearer <TOKEN>"
```

---

## 🔒 Important Security Notes

⚠️ **Change Default Password**
- The default admin password is `admin123456`
- Change this immediately in production!
- Command: Create new admin with strong password

⚠️ **Secure Your Database**
- Use strong PostgreSQL passwords
- Enable SSL connections in production
- Restrict database access

⚠️ **API Tokens**
- JWT tokens expire after a certain time
- Login again if you see "401 Unauthorized"
- Don't share tokens with others

---

## 🐛 Quick Troubleshooting

**"Admin login failed"**
→ Check admin exists: `SELECT * FROM users WHERE email = 'admin@fixitconnect.com';`

**"404 on admin pages"**
→ Make sure you're logged in and token is valid

**"No fundis showing"**
→ Create a fundi account on main app first, then check in admin

**"Backend not starting"**
→ Check database is running: `psql -U postgres -h localhost`

---

## 📚 Full Documentation

See `ADMIN_SYSTEM_GUIDE.md` for comprehensive documentation covering:
- Database schema
- All API endpoints
- Authentication flow
- Frontend components
- Testing procedures
- Production deployment

---

## ✨ Next Steps

1. ✅ Admin system set up
2. Create test fundi accounts to verify workflow
3. Test approval/rejection process
4. Check action logs
5. Create additional admin accounts as needed
6. Deploy to production when ready

**Enjoy your admin powers!** 🎉
