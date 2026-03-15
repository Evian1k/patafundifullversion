# FixIt Connect - Full-Stack Production System

A complete, production-ready service marketplace (Uber-style) for service professionals (fundis) and customers. Built with Node.js/Express backend, React/TypeScript frontend, PostgreSQL, real-time Socket.IO, and advanced anti-cheat verification (OCR, GPS, selfie capture).

---

## 📋 Table of Contents

- [System Architecture](#system-architecture)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Frontend Components](#frontend-components)
- [Database Schema](#database-schema)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)

---

## 🏗️ System Architecture

### Backend (Node.js/Express)
- **Authentication**: JWT-based with token blacklist for logout
- **Authorization**: Role-based access control (customer, fundi, admin)
- **Real-time**: Socket.IO for job requests, location tracking, and chat
- **Files**: Multer for secure file uploads (ID photos, selfies, certificates)
- **OCR**: Tesseract.js for ID verification and anti-cheat
- **Email**: Nodemailer for notifications and password reset
- **Database**: PostgreSQL with transactions for atomic earnings/withdrawal operations

### Frontend (React/TypeScript)
- **UI**: Shadcn/UI components with Framer Motion animations
- **Real-time**: Socket.IO client for instant job requests and chat
- **Forms**: React Hook Form with Zod validation
- **Maps**: Google Maps embed for GPS preview
- **Media**: Native HTML5 camera/geolocation APIs

### Database (PostgreSQL)
- 15+ tables: users, fundi_profiles, jobs, job_requests, messages, payments, wallets, reviews, admin_action_logs, etc.
- Indexes on critical queries (verification status, location, user_id)
- Transactions for earnings and withdrawal workflows

---

## ✨ Key Features

### 🔐 Fundi Registration & Verification
- **Multi-step flow**: Personal info → ID upload → Selfie capture → GPS location → Skills/experience
- **OCR Validation**: Extract name/ID from ID photo using Tesseract; compare with input
- **GPS Enforcement**: Capture real device location with accuracy threshold (≤150m)
- **Selfie Verification**: Camera-only capture (no uploads); prevents pre-recorded videos
- **Admin Approval**: Pending → Approved workflow with email notifications

### 💰 Earnings & Wallet
- **Automatic credits**: Job completion triggers earnings transaction
- **Platform commission**: Configurable percentage (default 15%)
- **Withdrawal requests**: M-Pesa integration ready (status: 'requested', 'processed')
- **Transaction history**: Full audit of all credits/debits

### 📱 Real-Time Job Matching
- **Nearby dispatch**: Find closest online fundis within 50km radius
- **Animated requests**: Countdown timer (default 20s), accept/decline within window
- **Request locking**: Only first accepting fundi gets the job; others auto-expire
- **Location tracking**: Live location updates during active jobs

### 💬 In-App Chat
- **Job-scoped**: Messages tied to specific job_id
- **Persistent**: Stored in DB; searchable history
- **Real-time delivery**: Socket.IO for instant message sync
- **Delivery status**: "sent" + socket acknowledgment

### ⭐ Ratings & Reviews
- **Customer-only**: Customers rate fundis after job completion
- **Non-editable**: Review immutability (no edit, delete history tracked)
- **Impact**: High ratings improve job matching priority

### 🛡️ Admin Panel
- **Dashboard**: Key stats (users, fundis, pending verifications, revenue)
- **Verification workflow**: Approve/reject/suspend fundis with audit logs
- **OCR comparison**: Side-by-side extracted vs. provided data
- **Action logs**: Full audit trail of admin actions with IP address

---

## 🛠️ Tech Stack

### Backend
- **Framework**: Express.js (Node.js/ESM)
- **Database**: PostgreSQL with pg driver
- **Auth**: JWT + bcryptjs for password hashing
- **File Storage**: Multer (local; upgrade to S3 for production)
- **Real-time**: Socket.IO
- **OCR**: Tesseract.js
- **Email**: Nodemailer
- **Validation**: Server-side only (no client trust)

### Frontend
- **Framework**: React 18 + TypeScript
- **UI**: Shadcn/UI + Tailwind CSS
- **State**: React hooks (useState, useEffect, useRef)
- **Forms**: React Hook Form + Zod
- **Animation**: Framer Motion
- **API Client**: Custom fetch-based REST client
- **Real-time**: Socket.IO client
- **Maps**: Google Maps embed (static preview)
- **Media**: HTML5 Geolocation + getUserMedia

### Database
- **Engine**: PostgreSQL 14+
- **Tables**: 15+ normalized tables
- **Transactions**: ACID-compliant for earnings/withdrawal
- **Indexes**: On critical columns for query performance

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v18+
- **PostgreSQL**: 14+
- **npm**: 9+
- **Google Maps API key** (optional, for embed)

### Installation

1. **Clone and install dependencies**
```bash
git clone <repo>
cd fixit-connect

# Backend
cd backend
npm install

# Frontend (in root)
npm install
```

2. **Set up database**
```bash
cd backend
# Create PostgreSQL database
createdb fixit_connect

# Apply schema
npm run setup-db

# Create admin account (default: emmanuelevian@gmail.com / emmanuelevian12k@Q)
npm run setup-admin
```

3. **Configure environment variables**

Create `.env` in `/backend`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fixit_connect
DB_USER=postgres
DB_PASSWORD=postgres

JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRY=7d

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=no-reply@yourapp.com
ADMIN_EMAIL=emmanuelevian@gmail.com

PLATFORM_FEE_PERCENT=15
JOB_REQUEST_BATCH_SIZE=5
JOB_REQUEST_TIMEOUT_SEC=20

FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
```

Create `.env` in root or `.env.local`:
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

4. **Run locally**
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## 📡 API Documentation

### Authentication
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/signup` | POST | ❌ | Register new user (role=customer) |
| `/auth/login` | POST | ❌ | Login with email/password |
| `/auth/logout` | POST | ✅ | Revoke JWT token |
| `/auth/me` | GET | ✅ | Get current user |
| `/auth/password/forgot` | POST | ❌ | Request password reset email |
| `/auth/password/reset` | POST | ❌ | Reset password with token |

### Fundi Registration
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/fundi/register` | POST | ✅ | Submit fundi registration (multipart: idPhoto, idPhotoBack, selfie) |
| `/fundi/profile` | GET | ✅ | Get fundi profile |
| `/fundi/profile` | PUT | ✅ | Update fundi profile |
| `/fundi/status/online` | POST | ✅ | Go online (with GPS) |
| `/fundi/status/offline` | POST | ✅ | Go offline |
| `/fundi/location` | POST | ✅ | Update location while online |

### Fundi Dashboard
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/fundi/dashboard` | GET | ✅ | Get dashboard stats (verification, wallet, jobs, ratings) |
| `/fundi/wallet/transactions` | GET | ✅ | Get wallet transaction history |
| `/fundi/wallet/withdraw-request` | POST | ✅ | Request M-Pesa withdrawal |
| `/fundi/ratings` | GET | ✅ | Get fundi ratings and reviews |

### Jobs
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/jobs` | POST | ✅ | Create job (triggers matching) |
| `/jobs` | GET | ✅ | Get user's jobs |
| `/jobs/:jobId` | GET | ✅ | Get job details |
| `/jobs/:jobId/status` | PATCH | ✅ | Update job status (triggers earnings on 'completed') |
| `/jobs/:jobId/photos` | POST | ✅ | Upload job photo |
| `/jobs/:jobId/photos` | GET | ✅ | Get job photos |

### Admin
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/admin/dashboard-stats` | GET | ✅ Admin | Get admin dashboard stats |
| `/admin/pending-fundis` | GET | ✅ Admin | Get pending fundi verifications |
| `/admin/fundis/:fundiId` | GET | ✅ Admin | Get fundi details for review |
| `/admin/fundis/:fundiId/approve` | POST | ✅ Admin | Approve fundi (sets role='fundi', sends email) |
| `/admin/fundis/:fundiId/reject` | POST | ✅ Admin | Reject fundi registration |
| `/admin/fundis/:fundiId/suspend` | POST | ✅ Admin | Suspend approved fundi |
| `/admin/fundis/:fundiId/revoke` | POST | ✅ Admin | Revoke fundi approval |
| `/admin/logs/actions` | GET | ✅ Admin | Get admin action logs |
| `/admin/customers` | GET | ✅ Admin | Get all customers |
| `/admin/jobs` | GET | ✅ Admin | Get all jobs with filtering |

### Real-Time Events (Socket.IO)

**Client → Server**
- `auth:token` — Authenticate with JWT
- `fundi:location:update` — Update location (lat, lon, accuracy)
- `fundi:response` — Accept/decline job request
- `chat:send` — Send message (jobId, content)

**Server → Client**
- `auth:ok` — Authentication successful
- `job:request` — New job request (jobId, title, distance, expiresAt)
- `job:accepted` — Job was accepted by fundi
- `job:request:declined` — Another fundi declined
- `job:matching` — Matching started (candidates list)
- `job:search:failed` — No fundis available
- `chat:message` — New message received
- `fundi:location` — Live location update (during active job)

---

## 🎨 Frontend Components

### Pages
- **`FundiRegister`**: Multi-step registration (personal info → ID → selfie → GPS → skills)
- **`FundiDashboard`**: Dashboard with stats, online/offline toggle, wallet
- **`CreateJob`**: Customer creates job (description, location, price)
- **`JobTracking`**: Track active job with live fundi location and chat
- **`Admin/*`**: Admin verification UI, dashboard, fundi list

### Components
- **`JobRequestCard`**: Animated card with countdown timer (accept/decline)
- **`JobChat`**: In-app chat panel (right sidebar)
- **`CameraCapture`**: Native camera for selfie (no file upload)
- **`GPSCapture`**: Device GPS with Google Maps preview
- **`FundiDashboard`**: Stats, wallet, online toggle

### Hooks
- **`useRealtime`**: Socket.IO connection and event binding
- **`useJobRequest`**: Listen for job requests, countdown logic
- **`useJobChat`**: Send/receive messages for a job
- **`useFundiLocation`**: Manage online/offline and location updates

---

## 📊 Database Schema

### Key Tables

**users**
- id (UUID PK)
- email (UNIQUE)
- password_hash
- full_name
- phone
- role (customer | fundi | admin)
- created_at

**fundi_profiles**
- id (UUID PK)
- user_id (FK → users, UNIQUE)
- first_name, last_name, email, phone
- id_number (UNIQUE)
- id_number_extracted, id_name_extracted
- id_photo_path, id_photo_back_path, selfie_path
- latitude, longitude, accuracy, altitude (GPS)
- location_address, location_area, location_city, location_captured_at
- skills (TEXT[]), experience_years, mpesa_number
- verification_status (pending | approved | rejected | suspended)
- verification_notes
- subscription_active, subscription_expires_at
- created_at, updated_at

**jobs**
- id (UUID PK)
- customer_id (FK → users)
- fundi_id (FK → users, nullable)
- title, description, category
- location, latitude, longitude
- status (pending | matching | requested | accepted | on_the_way | in_progress | completed | cancelled)
- estimated_price, final_price, platform_fee
- created_at, updated_at

**job_requests**
- id (UUID PK)
- job_id (FK → jobs)
- fundi_id (FK → users)
- status (pending | sent | declined | accepted | expired)
- expires_at
- created_at

**fundi_wallets**
- user_id (UUID PK, FK → users)
- balance (DECIMAL)
- updated_at

**fundi_wallet_transactions**
- id (UUID PK)
- user_id (FK → users)
- amount, type (credit | debit), source, job_id, description
- created_at

**messages**
- id (UUID PK)
- job_id (FK → jobs)
- sender_id (FK → users)
- content, read_at
- created_at

**reviews**
- id (UUID PK)
- job_id (FK → jobs)
- reviewer_id, reviewee_id (FK → users)
- rating (1-5)
- comment
- created_at

**admin_action_logs**
- id (UUID PK)
- admin_id (FK → users)
- action_type (approve | reject | suspend | revoke)
- target_type (fundi), target_id
- old_value, new_value, reason
- ip_address, created_at

**password_resets**
- id (UUID PK)
- user_id (FK → users)
- token (UNIQUE)
- expires_at, used, created_at

**token_blacklist**
- id (UUID PK)
- token (UNIQUE), user_id (FK), expires_at, created_at

**fundi_locations**
- user_id (UUID PK, FK → users)
- latitude, longitude, accuracy
- online (BOOLEAN)
- updated_at

---

## 🚢 Deployment

### Backend Deployment (Heroku/Railway/Render)

1. **Set environment variables** on your platform
2. **Ensure PostgreSQL** is provisioned and connected
3. **Run migrations** (setup-db) on first deploy
4. **Use environment-based config**:
```bash
NODE_ENV=production npm start
```

### Frontend Deployment (Vercel/Netlify)

1. **Set VITE env vars** in your platform:
   - `VITE_API_URL` → production backend URL
   - `VITE_SOCKET_URL` → production Socket.IO server
2. **Build and deploy**:
```bash
npm run build
```

### Production Checklist

- [ ] Update `JWT_SECRET` to a strong random value
- [ ] Configure real SMTP credentials (Gmail, SendGrid, etc.)
- [ ] Enable HTTPS for all endpoints
- [ ] Use environment-based database (managed DB service)
- [ ] Upgrade file storage to S3/GCS (not local uploads)
- [ ] Set up Redis for Socket.IO adapter (multi-server support)
- [ ] Enable CORS properly (specify frontend domain)
- [ ] Add rate limiting on auth/password reset endpoints
- [ ] Configure automated database backups
- [ ] Set up monitoring/logging (Sentry, CloudWatch, etc.)
- [ ] Enable SQL query logging for performance tuning
- [ ] Test end-to-end: signup → registration → job → completion → earnings

---

## 🔑 Environment Variables

### Backend (.env)

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fixit_connect
DB_USER=postgres
DB_PASSWORD=postgres

# JWT
JWT_SECRET=change-me-in-production
JWT_EXPIRY=7d

# Email (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=no-reply@fixitconnect.com
ADMIN_EMAIL=emmanuelevian@gmail.com

# Platform Config
PLATFORM_FEE_PERCENT=15
JOB_REQUEST_BATCH_SIZE=5
JOB_REQUEST_TIMEOUT_SEC=20

# URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000

# Optional
LOG_LEVEL=info
NODE_ENV=development
```

### Frontend (.env.local / .env)

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## 🧪 Testing & Validation

### Manual Testing Flow

1. **Signup as customer**
   ```
   POST /auth/signup
   Email: customer@example.com, Password: Secure123!
   ```

2. **Signup & register as fundi**
   ```
   POST /auth/signup (email: fundi@example.com)
   POST /fundi/register (multipart: ID, selfie, GPS, skills)
   ```

3. **Admin approves fundi**
   ```
   POST /admin/fundis/:fundiId/approve
   Fundi receives email, role promoted to 'fundi'
   ```

4. **Fundi goes online**
   ```
   POST /fundi/status/online (lat, lon, accuracy)
   Socket.IO connects, realtime service ready
   ```

5. **Customer creates job**
   ```
   POST /jobs (title, description, location, lat, lon, estimatedPrice)
   System finds nearest online fundi, broadcasts job:request
   ```

6. **Fundi accepts job**
   ```
   Socket.IO: fundi:response { jobId, accept: true }
   Job status → 'accepted', other fundis auto-expired
   ```

7. **Job completion & earnings**
   ```
   PATCH /jobs/:jobId/status { status: 'completed', finalPrice: 5000 }
   Transaction created, wallet credited, debit for platform fee
   ```

### Automated Tests (Optional)

```bash
cd backend
npm test  # Server-side tests (auth, job flow, transactions)

cd ..
npm test  # Frontend component tests
```

---

## 📝 Key Files

### Backend
- `/backend/src/routes/fundi.js` — Fundi registration, dashboard, wallet
- `/backend/src/routes/jobs.js` — Job creation, matching, completion earnings
- `/backend/src/routes/admin.js` — Verification workflow and action logs
- `/backend/src/services/realtime.js` — Socket.IO handlers (requests, chat, location)
- `/backend/src/services/ocr.js` — Tesseract OCR for ID verification
- `/backend/src/db/schema.js` — All table definitions

### Frontend
- `/frontend/src/pages/FundiDashboard.tsx` — Fundi stats and online/offline
- `/frontend/src/pages/FundiRegister.tsx` — Multi-step registration
- `/frontend/src/components/fundi/JobRequestCard.tsx` — Animated request + countdown
- `/frontend/src/components/fundi/JobChat.tsx` — In-app chat
- `/frontend/src/components/fundi/CameraCapture.tsx` — Selfie capture
- `/frontend/src/components/fundi/GPSCapture.tsx` — GPS + maps preview
- `/frontend/src/services/realtime.ts` — Socket.IO service
- `/frontend/src/hooks/useRealtime.ts` — Real-time hooks

---

## 🐛 Troubleshooting

### "Port already in use"
```bash
# Kill process on port 5000 (backend)
lsof -ti:5000 | xargs kill -9

# Kill process on port 3000 (frontend)
lsof -ti:3000 | xargs kill -9
```

### "Database connection failed"
- Ensure PostgreSQL is running: `brew services start postgresql`
- Check credentials in `.env`
- Verify database exists: `psql -U postgres -l`

### "Socket.IO not connecting"
- Check browser console for auth errors
- Ensure CORS is enabled on backend
- Verify token is in localStorage

### "OCR extraction returns empty"
- Image quality may be poor (ensure ID is clear, well-lit)
- Tesseract prefers high-contrast images
- Try rotating or re-capturing the ID

### "GPS accuracy poor (>150m)"
- Move outdoors with clear sky view
- Wait 10-30 seconds for GPS lock
- Disable location spoofing if enabled

---

## 📞 Support & Contributing

For bugs, feature requests, or questions:
1. Check existing issues and documentation
2. Create a detailed bug report with:
   - Steps to reproduce
   - Expected vs. actual behavior
   - Error logs/screenshots
3. Submit a pull request with tests

---

## 📄 License

This project is proprietary and confidential. All rights reserved.

---

## ✅ Production Readiness Checklist

- [x] **Authentication**: JWT + token blacklist for logout
- [x] **Authorization**: Role-based (customer, fundi, admin)
- [x] **Database**: PostgreSQL with transactions, indexes, constraints
- [x] **File uploads**: Multer with validation; ready for S3 upgrade
- [x] **OCR anti-cheat**: Tesseract.js name/ID comparison
- [x] **GPS validation**: Accuracy threshold, real device capture
- [x] **Real-time**: Socket.IO for job requests, chat, location
- [x] **Earnings**: Atomic transactions, commission deduction, wallet
- [x] **Admin panel**: Verification workflow, audit logs, approval/rejection
- [x] **Email notifications**: Password reset, fundi approval
- [x] **Validation**: Server-side only; no trust in client
- [x] **Error handling**: Centralized middleware, clear error messages
- [x] **API docs**: Full endpoint reference with auth requirements
- [x] **Deployment**: Environment-based config, production checklist

---

**Built with ❤️ for a scalable, production-ready service marketplace.**
