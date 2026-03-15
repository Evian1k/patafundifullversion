# 🚀 Admin Panel Quick Start Guide

## Prerequisites
- Node.js v18+ installed
- PostgreSQL running locally
- Backend and frontend running in separate terminals

---

## 1. Start the Development Servers

### Terminal 1: Backend
```bash
cd /home/emmanuel/tali/fixit-connect/backend
npm install
npm start
# Server runs on http://localhost:5000
```

### Terminal 2: Frontend
```bash
cd /home/emmanuel/tali/fixit-connect/frontend
npm install
npm run dev
# Server runs on http://localhost:5173
```

---

## 2. Create Admin Account

### Option A: Automatic Setup (Recommended)
```bash
cd /home/emmanuel/tali/fixit-connect/backend
npm run setup-admin
# Creates admin account with email from .env
```

### Option B: Manual Setup
```bash
cd /home/emmanuel/tali/fixit-connect/backend
npm run seed-admin
# Or use: node scripts/setup-admin.js
```

### Default Credentials
- **Email:** Value of `ADMIN_EMAIL` in `.env` (defaults to `admin@fixit.co.ke`)
- **Password:** Configured in `.env` or reset script

---

## 3. Access Admin Panel

1. **Open Browser:** http://localhost:5173/admin/login
2. **Enter Credentials:**
   - Email: admin@fixit.co.ke
   - Password: (your admin password)
3. **Click Login**
4. **Redirects to Dashboard:** http://localhost:5173/admin/dashboard

---

## 4. Explore Admin Features

### Dashboard
- View real-time statistics
- See pending actions
- Monitor key metrics

### Fundi Management
- View pending fundi applications
- Approve/reject with reasons
- Verify documents and ID
- Suspend/revoke approvals

### Customer Management
- View all customers
- Search by name/email/phone
- Block suspicious accounts
- Monitor customer activity

### Job Monitoring
- View all jobs on platform
- Filter by status
- Check customer/fundi assignments
- Monitor payment status

### Payments & Finance
- Track revenue and commissions
- View transaction history
- Monitor payment processing
- Export financial reports

### Security
- Monitor security alerts
- Force logout suspicious users
- Disable accounts
- Resolve fraud alerts

### Reports
- View platform analytics
- 7/30/90 day trends
- Top performing fundis
- Export CSV reports

### Settings
- Adjust commission rates
- Set job price limits
- Toggle features
- Configure notifications

### Audit Logs
- View all admin actions
- Search by action type
- Filter and export
- Track changes

---

## 5. Common Tasks

### Approve a Fundi
1. Click **Fundi Verification** in sidebar
2. Find pending fundi
3. Click to open modal
4. Review documents and OCR comparison
5. Click **Approve**
6. (Optional) Add notes
7. Confirm

### Block a Customer
1. Click **Customers** in sidebar
2. Search for customer
3. Click **Block** button
4. Confirm action
5. Customer account disabled

### View Transaction History
1. Click **Payments** in sidebar
2. See all completed jobs as transactions
3. View customer and fundi names
4. See 10% commission calculated

### Export Reports
1. Click **Reports** in sidebar
2. Select date range (7d/30d/90d)
3. Scroll down to **Top Fundis**
4. Click **Export CSV** button
5. File downloads to computer

### Update Commission Rate
1. Click **Settings** in sidebar
2. Change **Platform Commission Rate**
3. Click **Save Settings**
4. Reload page to verify

### Check Audit Logs
1. Click **Audit Logs** in sidebar
2. See all admin actions
3. Search by target ID
4. Filter by action type
5. Export for records

---

## 6. Troubleshooting

### "Invalid Credentials" Error
- Verify email matches `.env` ADMIN_EMAIL
- Check password is correct
- Ensure admin account created with `npm run setup-admin`

### "Access Denied" Error
- Verify JWT token in localStorage (DevTools → Application → localStorage → token)
- Check token hasn't expired
- Try logging out and back in

### "Database Connection Error"
- Verify PostgreSQL is running
- Check DB credentials in `.env`
- Verify `fixit_connect` database exists
- Check network connectivity

### Pages Not Loading
- Check browser console for errors (F12)
- Verify both servers running (backend:5000, frontend:5173)
- Try hard refresh (Ctrl+Shift+R)
- Check network tab for failed requests

### "No Data" on Pages
- Verify test data exists in database
- Check API endpoints responding
- Review browser console for errors
- Check backend logs for query errors

---

## 7. API Integration Testing

### Test Admin Authentication
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@fixit.co.ke",
    "password": "your-password"
  }'
```

### Test Protected Endpoint
```bash
curl -X GET http://localhost:5000/api/admin/dashboard-stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test Transaction Endpoint
```bash
curl -X GET http://localhost:5000/api/admin/transactions?page=1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 8. Database Queries for Testing

### Check Admin Account
```sql
SELECT id, email, role, status FROM users 
WHERE email = 'admin@fixit.co.ke';
```

### Check Admin Action Logs
```sql
SELECT id, admin_id, action_type, target_type, created_at 
FROM admin_action_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Fundi Count
```sql
SELECT status, COUNT(*) as count 
FROM users 
WHERE role = 'fundi' 
GROUP BY status;
```

### Check Jobs by Status
```sql
SELECT status, COUNT(*) as count 
FROM jobs 
GROUP BY status;
```

### Check Revenue
```sql
SELECT SUM(final_price) as total_revenue, COUNT(*) as completed_jobs
FROM jobs 
WHERE status = 'completed';
```

---

## 9. Performance Monitoring

### Monitor Active Sessions
```bash
# Check backend logs for admin logins
tail -f backend/logs/admin.log
```

### Monitor Database Queries
```bash
# PostgreSQL query log
psql -U postgres -d fixit_connect \
  -c "SELECT query, calls, mean_time FROM pg_stat_statements LIMIT 10;"
```

### Monitor API Response Times
- Open DevTools → Network tab
- Perform admin actions
- Check response times for API calls
- Aim for < 500ms for list endpoints

---

## 10. Useful Commands

```bash
# Reset admin password
cd backend && node scripts/setup-admin.js

# Clear all admin logs
psql -U postgres -d fixit_connect \
  -c "DELETE FROM admin_action_logs;"

# Check database size
psql -U postgres -d fixit_connect \
  -c "SELECT pg_size_pretty(pg_database_size('fixit_connect'));"

# View recent admin actions
psql -U postgres -d fixit_connect \
  -c "SELECT admin_id, action_type, target_type, created_at FROM admin_action_logs ORDER BY created_at DESC LIMIT 20;"

# Test backend connectivity
curl http://localhost:5000/health

# Test frontend build
cd frontend && npm run build
```

---

## 11. Next Steps After Setup

1. **Test All Pages** - Verify each admin page loads
2. **Test Authentication** - Login/logout flow
3. **Test Actions** - Approve/reject/block operations
4. **Check Logs** - Verify audit logs record actions
5. **Export Data** - Test CSV export
6. **Test Filters** - Search and pagination
7. **Monitor Performance** - Check response times

---

## 12. Security Reminders

✅ **DO:**
- Check audit logs regularly
- Monitor security alerts
- Use strong admin password
- Keep JWT secret confidential
- Regularly backup database
- Review admin actions

❌ **DON'T:**
- Share admin credentials
- Commit secrets to git
- Use default passwords in production
- Bypass authentication checks
- Disable audit logging
- Allow public admin access

---

## 13. Support Resources

- **Backend Issues:** Check `/backend/logs/error.log`
- **Frontend Issues:** Open DevTools Console (F12)
- **Database Issues:** Use pgAdmin or psql terminal
- **API Issues:** Test with curl or Postman
- **Documentation:** See `ADMIN_PANEL_COMPLETE.md`

---

## Ready to Go! 🎉

Your admin panel is now ready for use. All features are fully functional, data is persistent, and every action is logged.

**Happy administrating!**
