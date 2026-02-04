# FixIt Connect Backend

Custom backend implementation for FixIt Connect. No Supabase required.

## Features

✅ User authentication (JWT)
✅ Fundi registration with OCR verification
✅ Multi-file uploads (ID, selfie, certificates)
✅ GPS location tracking
✅ Job management
✅ Real-time capable with WebSocket ready
✅ PostgreSQL database

## Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Set up environment variables

Create `.env` file in backend directory:

```env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fixit_connect
DB_USER=postgres
DB_PASSWORD=postgres

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRY=7d

# Backend URL (for file serving)
BACKEND_URL=http://localhost:5000
```

### 3. Create PostgreSQL database

```bash
createdb fixit_connect
```

### 4. Run migrations

```bash
npm run setup-db
```

## Running the backend

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Fundi Registration

- `POST /api/fundi/register` - Submit registration (multipart/form-data)
- `GET /api/fundi/profile` - Get fundi profile
- `PUT /api/fundi/profile` - Update profile
- `GET /api/fundi/:fundiId` - Get fundi details
- `GET /api/fundi/search?latitude=X&longitude=Y&skill=Plumbing` - Search fundis

### Jobs

- `POST /api/jobs` - Create job
- `GET /api/jobs` - Get user's jobs
- `GET /api/jobs/:jobId` - Get job details
- `PATCH /api/jobs/:jobId/status` - Update job status
- `POST /api/jobs/:jobId/photos` - Upload job photo
- `GET /api/jobs/:jobId/photos` - Get job photos

### File Upload

- `POST /api/upload` - Upload file

## File Structure

```
backend/
├── src/
│   ├── index.js           # Express app
│   ├── db.js              # Database connection
│   ├── middlewares/
│   │   ├── auth.js        # JWT middleware
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── fundi.js
│   │   ├── jobs.js
│   │   └── upload.js
│   ├── services/
│   │   ├── ocr.js         # OCR verification
│   │   └── file.js        # File upload handling
│   ├── utils/
│   │   ├── jwt.js
│   │   ├── password.js
│   │   └── errors.js
│   ├── db/
│   │   └── schema.js      # Database schema
│   └── scripts/
│       └── setup-db.js    # Database setup
├── uploads/               # User uploads directory
└── package.json
```

## Database Schema

- `users` - User accounts
- `profiles` - User profiles
- `fundi_profiles` - Fundi registration data
- `jobs` - Job listings
- `job_photos` - Job photos
- `job_bids` - Fundi bids
- `service_categories` - Service types
- `reviews` - Job reviews
- `messages` - Job messages
- `payments` - Payment records

## OCR Verification

The backend includes OCR verification for ID documents:

- Extracts ID number from photo
- Extracts name from photo
- Validates against user-provided data
- Returns verification status and mismatches
