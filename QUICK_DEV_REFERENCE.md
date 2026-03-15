# Quick Dev Reference - FixIt Connect Fundi System

## 🚀 Quick Start

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend  
cd frontend && npm run dev

# Terminal 3: Run tests
bash test-simple-workflow.sh
```

**URLs**:
- Frontend: http://localhost:8080
- Backend: http://localhost:5000
- Admin: http://localhost:8080/admin

---

## 👤 Test Accounts

### Admin
- Email: `emmanuelevian@gmail.com`
- Password: `emmanuelevian12k@Q`
- Role: `admin`

### Create your own
```bash
# Signup (gets role: customer by default)
POST http://localhost:5000/api/auth/signup
{
  "email": "user@test.com",
  "password": "Password123",
  "fullName": "Test User"
}

# Login
POST http://localhost:5000/api/auth/login
{
  "email": "user@test.com",
  "password": "Password123"
}

# Check role
GET http://localhost:5000/api/auth/me
Header: Authorization: Bearer <token>
```

---

## 🔄 Key User Flows

### 1. Customer Creates Job
```
Signup (customer) 
  → Login 
  → Create job (lat/lng) 
  → Job broadcast to nearby approved fundis
  → Customer waits for acceptance
```

### 2. Fundi Registration & Approval
```
Signup (will be customer initially)
  → Register as fundi (upload documents + photos)
  → OCR extracts & validates ID
  → Admin reviews & approves
  → Role changes: customer → fundi
  → Fundi logs in again
  → Gets routed to /fundi dashboard
```

### 3. Fundi Accepts Job
```
Fundi goes online (lat/lng, accuracy ≤ 150m)
  → Receives job:request via WebSocket
  → Clicks "Accept"
  → Server checks:
     - Fundi is verified ✓
     - Fundi not already on job ✓
     - Request not expired ✓
     - No other fundi accepted yet ✓
  → Job locked to this fundi
  → Other fundis get job:request:declined
```

---

## 🔐 Critical Validation Points

| Endpoint | Check | Reason |
|----------|-------|--------|
| `/fundi/status/online` | Verification status == 'approved' | Prevent unverified from matching |
| `fundi:response (WebSocket)` | Same | Double-check at real-time layer |
| `/fundi/dashboard` | Role == 'fundi' | Gate access to work console |
| `/admin/fundis/:id/approve` | Admin role | Only admin can approve |
| Job acceptance | First-accept-wins | Prevent double-accept |

---

## 📡 WebSocket Events (Real-Time)

### **Fundi → Server**
- `auth:token` - Authenticate: `{ token }`
- `fundi:location:update` - GPS: `{ latitude, longitude, accuracy }`
- `fundi:response` - Accept/decline: `{ jobId, accept: true/false }`
- `chat:send` - Message: `{ jobId, content }`

### **Server → Fundi**
- `auth:ok` - Authentication succeeded
- `job:request` - Job offered: `{ jobId, title, latitude, longitude, expiresAt }`
- `fundi:response:ok` - Accept/decline confirmed
- `fundi:response:failed` - Error: `{ message }`
- `job:accepted` - Another fundi took it: `{ jobId }`
- `chat:message` - New message: `{ jobId, message }`

### **Server → Customer**
- `job:matching` - Fundis being contacted
- `job:accepted` - Fundi accepted: `{ jobId, fundiId }`
- `job:request:declined` - Fundi declined
- `fundi:location` - Live tracking: `{ latitude, longitude, accuracy }`

---

## 🗄️ Database Key Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | All users | id, email, **role**, password_hash |
| `fundi_profiles` | Fundi registration | user_id, **verification_status**, id_photo, selfie |
| `fundi_locations` | Live location | user_id, latitude, longitude, **accuracy**, online |
| `jobs` | Job postings | id, customer_id, **fundi_id**, **status**, latitude, longitude |
| `job_requests` | Fundi invitations | job_id, fundi_id, **status**, expires_at |
| `messages` | Chat | job_id, sender_id, content, created_at |

---

## 🛠️ Common Fixes

### "Fundi can't go online"
```
→ Check: SELECT verification_status FROM fundi_profiles WHERE user_id = '...'
→ Must be 'approved' (not 'pending' or 'rejected')
→ If pending, admin must approve first
```

### "Fundi doesn't receive job requests"
```
→ Check: SELECT * FROM fundi_locations WHERE user_id = '...'
→ Must have online = true
→ Must have recent location (within last 5 min)
→ Check accuracy ≤ 150m
```

### "Job shows status 'pending' forever"
```
→ Check: SELECT * FROM job_requests WHERE job_id = '...'
→ Must have at least one 'sent' request
→ Check expires_at > NOW()
→ Wait up to 20 seconds for timeout OR fundi must accept/decline
```

### "Frontend routing wrong"
```
→ Check Auth.tsx uses apiClient.getCurrentUser()
→ Check routes by role: customer → /dashboard, fundi → /fundi, admin → /admin
→ Clear localStorage auth_token and re-login
```

---

## 📊 Development Checklist

- [ ] Backend running on 5000
- [ ] Frontend running on 8080  
- [ ] Admin account exists (check setup-admin.js output)
- [ ] At least one fundi approved (via admin panel)
- [ ] Test: Create job as customer
- [ ] Test: Accept job as fundi (when online + approved)
- [ ] Test: Chat messages exchange
- [ ] Test: Payment history queries

---

## 📚 Code Locations

| Feature | Files |
|---------|-------|
| **Auth & Role Routing** | `frontend/src/pages/Auth.tsx`, `frontend/src/App.tsx` |
| **Real-Time** | `frontend/src/hooks/useRealtime.ts`, `backend/src/services/realtime.js` |
| **Fundi Verification** | `backend/src/routes/fundi.js`, `backend/src/routes/admin.js` |
| **Job Matching** | `backend/src/routes/jobs.js` |
| **Fundi Dashboard** | `frontend/src/pages/FundiDashboard.tsx` |
| **Admin Panel** | `frontend/src/pages/admin/FundiVerificationManagement.tsx` |

---

**All systems GO** ✅ Feel free to develop with confidence!
