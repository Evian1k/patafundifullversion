# Admin System - Quick Reference Card

## 🔑 Default Login

**Email:** `admin@fixitconnect.com`  
**Password:** `admin123456`

⚠️ **CRITICAL:** Change this password immediately in production!

---

## 🌐 Access Links

**Admin Login:** http://localhost:5173/admin/login  
**Dashboard:** http://localhost:5173/admin/dashboard  
**Fundi Verification:** http://localhost:5173/admin/fundis  

Backend: http://localhost:5000

---

## ⚙️ Setup Commands

```bash
# Install dependencies
npm install --prefix backend
npm install --prefix frontend

# Initialize database
npm --prefix backend run setup-db

# Create first admin
npm --prefix backend run setup-admin

# Start backend
npm --prefix backend run dev

# Start frontend
npm --prefix frontend run dev
```

---

## 👥 User Roles

```
admin      → Full system access, all verification powers
fundi      → Service provider, can accept jobs
customer   → Can post jobs, rate fundis
```

---

## 📊 Dashboard Statistics

| Statistic | Meaning |
|-----------|---------|
| Total Users | All registered users (admin + fundi + customers) |
| Total Fundis | All registered service providers |
| Pending Verifications | Fundis waiting for approval |
| Approved Fundis | Verified and active fundis |
| Rejected Fundis | Failed verification |
| Suspended Fundis | Temporarily disabled |
| Active Jobs | In-progress work |
| Completed Jobs | Finished work |
| Total Revenue | Platform earnings |

---

## 🔍 Fundi Verification Statuses

```
┌─────────┐
│ PENDING │  ← Submitted, needs review
└────┬────┘
     │
     ├─→ APPROVED  (can work)
     ├─→ REJECTED  (cannot use platform)
     └─→ SUSPENDED (temporarily blocked)
         │
         └─→ PENDING (can retry)
```

---

## ✅ Approval Checklist

When reviewing a fundi:

- [ ] Name matches ID extraction?
- [ ] ID number matches extraction?
- [ ] All documents are clear?
- [ ] No evidence of fraud?
- [ ] Location makes sense?
- [ ] Skills are legitimate?
- [ ] Ready to work?

**If all ✅**: Click **Approve**  
**If issues**: Click **Reject** (provide reason)  
**If needs time**: Click **Suspend** (provide reason)

---

## 🎯 Common Actions

### Approve a Fundi
1. Go to `/admin/fundis`
2. Search or browse pending fundis
3. Click fundi card
4. Review documents and OCR results
5. Click **Approve** button
6. (Optional) Add notes
7. Confirm

**Result:** Fundi becomes visible to customers ✅

### Reject a Fundi
1. Open fundi details
2. Click **Reject** button
3. Enter required reason
4. Confirm

**Result:** Fundi blocked from platform ❌

### Suspend a Fundi
1. Open fundi details
2. Click **Suspend** button
3. Enter mandatory reason
4. Confirm

**Result:** Fundi temporarily disabled ⏸️

### Search Fundis
1. Go to `/admin/fundis`
2. Search by:
   - **Name**: "John Smith"
   - **ID Number**: "123456"
   - **Phone**: "+254712345678"
3. Results auto-update

### Filter by Status
1. Use dropdown: Pending | Approved | Rejected | Suspended
2. Shows only fundis with that status

### View Action History
1. Dashboard → Scroll down (or dedicated logs page)
2. See all admin actions with:
   - Who did it
   - What happened
   - When
   - Why (reason)
   - Changes made

---

## 📱 Document Verification

**ID Requirements:**
- Front and back of ID
- Clear, legible
- Not expired
- Name must match submission

**Selfie Requirements:**
- Recent photo
- Face clearly visible
- Matches ID photo

**Certificates:**
- Any relevant work credentials
- Shows expertise
- Linked for verification

**OCR Results:**
- Green ✅ = Extracted data matches submission
- Red ❌ = Mismatch found (investigate)

---

## 🗺️ Location Verification

Each fundi has a location (latitude, longitude):
- Click the location to open Google Maps
- Verify it's in service area
- Check if reasonable for services offered

---

## 📋 Action Log

All admin actions automatically logged with:
- **Who**: Admin email
- **What**: Action type (approve, reject, etc)
- **When**: Exact timestamp
- **Where**: IP address
- **Why**: Reason provided
- **Details**: Old and new values

**Use for:** Compliance, audits, dispute resolution

---

## 🔐 Security Notes

✅ **Protected:**
- Admin routes require login
- Non-admins automatically redirected
- JWT token expires (re-login required)
- All actions logged
- Password hashed in database

✅ **Best Practices:**
- Change default password
- Use strong passwords
- Logout when done
- Don't share login credentials
- Review action logs regularly

⚠️ **Risks to Avoid:**
- Approving without document review
- Leaving browser logged in unattended
- Using weak passwords
- Sharing admin account
- Bulk approving without checking each

---

## 🆘 Troubleshooting

**"Admin login failed"**
```
→ Verify account created: npm run setup-admin
→ Check credentials: admin@fixitconnect.com / admin123456
→ Ensure backend running: npm run dev
```

**"No fundis showing"**
```
→ Create fundi accounts in main app first
→ Check database has data: psql ...
→ Verify backend API: curl /api/admin/pending-fundis
```

**"OCR results not showing"**
```
→ Verify documents uploaded
→ Check file paths exist
→ Tesseract.js running: check console errors
```

**"Actions not persisting"**
```
→ Database connected? Check PostgreSQL
→ admin_action_logs table exists? Check schema
→ API request succeeded? Check Network tab
```

**"Can't access /admin routes"**
```
→ Are you logged in? Go to /admin/login
→ Is user role admin? Check user_role in database
→ Expired token? Logout and login again
```

---

## 📞 API Endpoints for Tools

**Create Admin Account:**
```bash
curl -X POST http://localhost:5000/api/auth/admin/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newadmin@example.com",
    "password": "SecurePassword123",
    "fullName": "New Admin"
  }'
```

**Get Dashboard Stats:**
```bash
curl -X GET http://localhost:5000/api/admin/dashboard-stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Search Fundis:**
```bash
curl -X GET "http://localhost:5000/api/admin/search-fundis?q=john&status=pending" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Approve Fundi:**
```bash
curl -X POST http://localhost:5000/api/admin/fundis/{fundiId}/approve \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes": "All documents verified"}'
```

**Get Action Logs:**
```bash
curl -X GET "http://localhost:5000/api/admin/logs/actions?limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📚 More Information

For detailed information:
- **Setup:** See `ADMIN_QUICKSTART.md`
- **Full Reference:** See `ADMIN_SYSTEM_GUIDE.md`
- **Implementation:** See `ADMIN_IMPLEMENTATION_SUMMARY.md`

---

## ✨ Key Features at a Glance

| Feature | Status |
|---------|--------|
| Admin Login | ✅ Ready |
| Dashboard Stats | ✅ Real-time |
| Search Fundis | ✅ By name/ID/phone |
| Filter by Status | ✅ Working |
| Document Viewing | ✅ With zoom |
| OCR Comparison | ✅ Match/mismatch |
| GPS Maps | ✅ Google Maps link |
| Approve/Reject | ✅ One-click |
| Action Logging | ✅ Complete trail |
| Role Protection | ✅ Non-admins blocked |
| Real Data | ✅ No mocks |

---

## 🚀 You're All Set!

The admin system is complete, tested, and ready to use.

1. **Login** with default credentials
2. **Review** pending fundi applications
3. **Approve** or **Reject** with confidence
4. **Monitor** dashboard statistics
5. **Track** all actions in logs

Questions? Check the docs or contact support.

---

**Last Updated:** February 4, 2026  
**Version:** 1.0.0  
**Status:** Production Ready ✨
