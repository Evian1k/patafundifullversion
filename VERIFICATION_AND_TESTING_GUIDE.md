# 🧪 PRODUCTION VERIFICATION & TESTING GUIDE
**FixIt Connect - Complete System Verification**

---

## 🎯 PRE-LAUNCH CHECKLIST

### Phase 1: Database & Backend Setup
- [ ] PostgreSQL is running
- [ ] Database `fixit_connect` exists
- [ ] Run `npm run setup-db` in backend
- [ ] All schema tables created
- [ ] Backend starts without errors: `npm run dev`

### Phase 2: Backend API Verification
- [ ] Health check: `GET http://localhost:5000/health`
- [ ] Auth endpoints working
- [ ] All 35+ API endpoints accessible
- [ ] Error handling returns proper status codes
- [ ] No console errors in backend

### Phase 3: Frontend Integration
- [ ] Frontend starts: `npm run dev`
- [ ] API client configured correctly (VITE_API_URL)
- [ ] All new API methods imported
- [ ] No TypeScript errors
- [ ] UI renders without console errors

---

## 🧪 MANUAL TEST SCENARIOS

### TEST 1: Customer Registration & Job Creation
**Duration:** 5 minutes

```bash
# Step 1: Start backend
cd backend
npm run setup-db
npm run dev

# Step 2: In another terminal, test signup
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@test.com",
    "password": "password123",
    "fullName": "John Doe"
  }'

# Expected response:
{
  "success": true,
  "user": { "id": "...", "role": "customer" },
  "token": "eyJ..."
}

# Step 3: Create job with token
curl -X POST http://localhost:5000/api/jobs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix Kitchen Tap",
    "description": "Leaking tap needs repair",
    "location": "Nairobi, Westlands",
    "latitude": -1.2921,
    "longitude": 36.8219,
    "estimatedPrice": 2000
  }'

# Verify: Job created with status: "pending"
```

**Expected Results:**
- ✅ Customer signup successful
- ✅ Token returned
- ✅ Job created in database
- ✅ Job initial status is "pending"

---

### TEST 2: Fundi Registration & Approval
**Duration:** 10 minutes

```bash
# Step 1: Fundi signup
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "fundi@test.com",
    "password": "password123",
    "fullName": "James Plumber"
  }'

# Save FUNDI_TOKEN from response

# Step 2: Submit fundi registration (with documents)
# Note: In real scenario, use actual image files
curl -X POST http://localhost:5000/api/fundi/register \
  -H "Authorization: Bearer FUNDI_TOKEN" \
  -F "firstName=James" \
  -F "lastName=Plumber" \
  -F "email=fundi@test.com" \
  -F "phone=254712345678" \
  -F "idNumber=12345678" \
  -F "latitude=-1.2921" \
  -F "longitude=36.8219" \
  -F "accuracy=50" \
  -F "locationAddress=Nairobi" \
  -F "skills=Plumbing" \
  -F "experienceYears=5" \
  -F "idPhoto=@path/to/id.jpg" \
  -F "selfie=@path/to/selfie.jpg"

# Step 3: Get admin token and approve fundi
# (Use ADMIN_EMAIL from backend/.env)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "emmanuelevian@gmail.com",
    "password": "admin_password"
  }'

# Save ADMIN_TOKEN

# Step 4: Get pending fundis
curl -X GET "http://localhost:5000/api/admin/pending-fundis?page=1&limit=10" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Step 5: Approve fundi
curl -X POST "http://localhost:5000/api/admin/fundis/FUNDI_ID/approve" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes": "All documents verified"}'

# Step 6: Verify fundi role changed
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer FUNDI_TOKEN"

# Expected: role changed from "customer" to "fundi"
```

**Expected Results:**
- ✅ Fundi registration submitted
- ✅ Admin can see pending fundis
- ✅ Admin approval succeeds
- ✅ User role changes to "fundi"
- ✅ Fundi receives approval email

---

### TEST 3: Fundi Goes Online & Receives Job
**Duration:** 8 minutes

```bash
# Step 1: Fundi goes online
curl -X POST http://localhost:5000/api/fundi/status/online \
  -H "Authorization: Bearer FUNDI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": -1.2921,
    "longitude": 36.8219,
    "accuracy": 30
  }'

# Expected: success: true

# Step 2: Create a new job (as customer)
# This will trigger matching algorithm to find nearby fundis

curl -X POST http://localhost:5000/api/jobs \
  -H "Authorization: Bearer CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Broken Pipe",
    "description": "Pipe burst in bathroom",
    "location": "Nairobi, Westlands",
    "latitude": -1.2921,
    "longitude": 36.8219,
    "estimatedPrice": 3000
  }'

# Step 3: Check fundi status (should show pending job)
curl -X GET http://localhost:5000/api/fundi/status \
  -H "Authorization: Bearer FUNDI_TOKEN"

# Expected: pendingJobs > 0

# Step 4: Accept job
curl -X POST "http://localhost:5000/api/jobs/JOB_ID/accept" \
  -H "Authorization: Bearer FUNDI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"estimatedPrice": 3000}'

# Expected: success: true, job.status: "accepted"
```

**Expected Results:**
- ✅ Fundi location updated
- ✅ Job broadcast to nearby fundis
- ✅ Fundi receives job request
- ✅ Fundi can accept job
- ✅ Job status changes to "accepted"
- ✅ Customer receives notification (WebSocket)

---

### TEST 4: Fundi Check-In & Completion
**Duration:** 10 minutes

```bash
# Step 1: Fundi checks in (on-the-way)
curl -X POST "http://localhost:5000/api/jobs/JOB_ID/check-in" \
  -H "Authorization: Bearer FUNDI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": -1.293,
    "longitude": 36.822,
    "status": "on_the_way"
  }'

# Expected: success: true

# Step 2: Fundi updates location multiple times
for i in 1 2 3; do
  curl -X POST "http://localhost:5000/api/fundi/location" \
    -H "Authorization: Bearer FUNDI_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"latitude\": -1.294,
      \"longitude\": 36.821,
      \"accuracy\": 25
    }"
  sleep 2
done

# Step 3: Fundi checks in (arrived)
curl -X POST "http://localhost:5000/api/jobs/JOB_ID/check-in" \
  -H "Authorization: Bearer FUNDI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": -1.294,
    "longitude": 36.821,
    "status": "arrived"
  }'

# Step 4: Fundi completes job with photos
# Create a test image first
echo "test" > /tmp/after.jpg

curl -X POST "http://localhost:5000/api/jobs/JOB_ID/complete" \
  -H "Authorization: Bearer FUNDI_TOKEN" \
  -F "finalPrice=3000" \
  -F "photos=@/tmp/after.jpg"

# Expected response:
{
  "success": true,
  "job": {
    "status": "completed",
    "finalPrice": 3000,
    "fundiEarnings": 2550,
    "platformFee": 450
  },
  "payment": {
    "status": "pending",
    "fundi_earnings": 2550
  }
}
```

**Expected Results:**
- ✅ Fundi can check-in to job
- ✅ Location updates work
- ✅ Job status changes through states
- ✅ Completion triggers payment creation
- ✅ Earnings calculated (85% to fundi, 15% platform)
- ✅ Photos uploaded and stored

---

### TEST 5: Payment Processing
**Duration:** 5 minutes

```bash
# Step 1: Check payment record
curl -X GET "http://localhost:5000/api/payments/job/JOB_ID" \
  -H "Authorization: Bearer CUSTOMER_TOKEN"

# Expected: payment status: "pending"

# Step 2: Process payment (as customer)
curl -X POST "http://localhost:5000/api/payments/process/JOB_ID" \
  -H "Authorization: Bearer CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethod": "mpesa",
    "mpesaNumber": "254712345678"
  }'

# Expected: success: true, payment.status: "completed"

# Step 3: Check fundi earnings
curl -X GET http://localhost:5000/api/fundi/earnings \
  -H "Authorization: Bearer FUNDI_TOKEN"

# Expected:
{
  "earnings": {
    "totalEarnings": 2550,
    "thisMonth": 2550,
    "pending": 0,
    "transactions": [ ... ]
  }
}

# Step 4: Check payment history
curl -X GET "http://localhost:5000/api/payments/history?page=1" \
  -H "Authorization: Bearer FUNDI_TOKEN"

# Expected: payment visible in history
```

**Expected Results:**
- ✅ Payment record created
- ✅ Payment can be processed
- ✅ Fundi wallet updated
- ✅ Earnings reflected in dashboard
- ✅ Payment history accessible

---

### TEST 6: Subscription Management
**Duration:** 5 minutes

```bash
# Step 1: Check subscription status
curl -X GET http://localhost:5000/api/fundi/subscription/status \
  -H "Authorization: Bearer FUNDI_TOKEN"

# Step 2: Activate subscription
curl -X POST http://localhost:5000/api/fundi/subscription/activate \
  -H "Authorization: Bearer FUNDI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan": "monthly"}'

# Expected: success: true

# Step 3: Verify subscription active
curl -X GET http://localhost:5000/api/fundi/status \
  -H "Authorization: Bearer FUNDI_TOKEN"

# Expected: subscriptionActive: true, daysLeft: ~30
```

**Expected Results:**
- ✅ Subscription status retrievable
- ✅ Can activate/extend subscription
- ✅ Expiry date calculated correctly
- ✅ Affects job acceptance eligibility

---

## 📊 AUTOMATED TESTING

```bash
# Run automated tests
chmod +x test-endpoints.sh
./test-endpoints.sh

# Expected output: All tests pass
```

---

## 🔒 SECURITY VERIFICATION

### Authentication
- [ ] No authenticated endpoints accessible without token
- [ ] Expired tokens rejected
- [ ] Invalid tokens rejected
- [ ] Logout works (token blacklisted)

### Authorization
- [ ] Customers cannot access admin endpoints
- [ ] Fundis cannot access admin endpoints
- [ ] Fundis cannot modify other fundis' jobs
- [ ] Customers cannot accept their own jobs

### Data Protection
- [ ] Passwords hashed (bcryptjs)
- [ ] PII not exposed in APIs
- [ ] File uploads validated
- [ ] SQL injection prevention (parameterized queries)

---

## 📈 PERFORMANCE CHECKS

- [ ] Database queries use indexes
- [ ] No N+1 query problems
- [ ] Response times < 500ms
- [ ] Large result sets paginated
- [ ] WebSocket connections stable

---

## 📝 DEPLOYMENT CHECKLIST

### Environment Setup
```bash
# Backend .env
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://yourdomain.com
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=fixit_connect
DB_USER=your_user
DB_PASSWORD=your_password
JWT_SECRET=your-long-random-secret-key
JWT_EXPIRY=7d
ADMIN_EMAIL=your-admin-email@example.com
BACKEND_URL=https://api.yourdomain.com
```

### Database Backup
```bash
pg_dump fixit_connect > backup.sql
```

### Production Build
```bash
# Backend
cd backend
npm install
npm run setup-db
npm start

# Frontend
cd frontend
npm install
npm run build
npm start
```

---

## 🎯 GO/NO-GO DECISION

**GO TO PRODUCTION IF:**
- ✅ All 6 manual tests pass
- ✅ Automated tests complete successfully
- ✅ No security vulnerabilities found
- ✅ Performance acceptable
- ✅ Database backups working
- ✅ Admin can approve fundis
- ✅ Payments processing correctly
- ✅ WebSocket connections stable

**DO NOT LAUNCH IF:**
- ❌ Any critical endpoint failing
- ❌ Database not initializing
- ❌ Authentication broken
- ❌ Payment calculations incorrect
- ❌ WebSocket unreliable
- ❌ Console errors present

---

## 📞 SUPPORT & TROUBLESHOOTING

### Backend Won't Start
```bash
# Check port 5000
lsof -i :5000
kill -9 <PID>

# Check database connection
psql -U postgres -h localhost -d fixit_connect
```

### Database Error
```bash
# Reset database
npm run reset-db
npm run setup-db
```

### API Errors
```bash
# Check backend logs
tail -f backend/logs/*.log

# Test specific endpoint
curl -v http://localhost:5000/api/health
```

### Frontend Issues
```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install

# Check env variables
cat .env
# Should have VITE_API_URL=http://localhost:5000/api
```

---

**Status:** Ready for production verification and testing
