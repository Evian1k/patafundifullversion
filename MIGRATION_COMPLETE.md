# FixIt Connect - Complete Migration from Supabase to Custom Backend

## Overview

This project has been completely migrated from Supabase to a custom Node.js/Express backend with PostgreSQL database. All features remain identical - no UI changes, no functionality changes.

## What Changed

### ✅ Removed
- Supabase client and auth
- Supabase storage buckets
- Supabase migrations
- All Supabase environment variables
- `src/integrations/supabase/` folder (still present but no longer used)

### ✅ Added
- Custom Express backend (`/backend` folder)
- REST API endpoints for all operations
- OCR verification service (Tesseract.js)
- File upload handling via multer
- JWT authentication
- PostgreSQL database schema

### ✅ Features Preserved
- ✅ User authentication (customers & fundis)
- ✅ Fundi registration & document submission
- ✅ Multi-file uploads (ID front/back, selfie, certificates)
- ✅ OCR extraction of name & ID number from ID images
- ✅ Name & ID number matching against user input
- ✅ GPS location capture (lat, lng, accuracy, altitude)
- ✅ Fundi availability & job matching
- ✅ Customer job request submission
- ✅ Real-time status updates (polling)
- ✅ Subscription tracking
- ✅ M-Pesa phone number handling
- ✅ Secure data storage & validation

## Quick Start

### 1. Set Up Backend

```bash
cd backend
npm install

# Create PostgreSQL database
createdb fixit_connect

# Set up environment
cp .env.example .env

# Create tables
npm run setup-db

# Start development server
npm run dev
```

Backend runs on `http://localhost:5000`

### 2. Set Up Frontend

```bash
# In project root
npm install

# Environment is pre-configured in .env
VITE_API_URL=http://localhost:5000/api

# Start frontend
npm run dev
```

Frontend runs on `http://localhost:5173`

## Backend Structure

```
backend/
├── src/
│   ├── index.js                 # Express app
│   ├── db.js                    # PostgreSQL connection
│   ├── db/schema.js             # Database schema
│   ├── middlewares/
│   │   ├── auth.js              # JWT verification
│   │   └── errorHandler.js      # Error handling
│   ├── routes/
│   │   ├── auth.js              # Authentication endpoints
│   │   ├── fundi.js             # Fundi registration & profile
│   │   ├── jobs.js              # Job management
│   │   └── upload.js            # File uploads
│   ├── services/
│   │   ├── ocr.js               # OCR verification (Tesseract)
│   │   └── file.js              # File upload & storage
│   ├── utils/
│   │   ├── jwt.js               # JWT token generation
│   │   ├── password.js          # Password hashing
│   │   └── errors.js            # Custom errors
│   └── scripts/
│       └── setup-db.js          # Database initialization
├── uploads/                     # User-uploaded files
└── package.json
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/me` - Get current user info

### Fundi Registration
- `POST /api/fundi/register` - Submit registration (multipart/form-data)
- `GET /api/fundi/profile` - Get fundi profile
- `PUT /api/fundi/profile` - Update profile
- `GET /api/fundi/search` - Search fundis by location

### Jobs
- `POST /api/jobs` - Create job
- `GET /api/jobs` - Get user's jobs
- `GET /api/jobs/:jobId` - Get job details
- `PATCH /api/jobs/:jobId/status` - Update job status
- `POST /api/jobs/:jobId/photos` - Upload job photo
- `GET /api/jobs/:jobId/photos` - Get job photos

### File Uploads
- `POST /api/upload` - Upload any file

## OCR Verification

The backend automatically verifies:
1. **ID Number Extraction** - Extracts ID from document photo
2. **Name Extraction** - Extracts full name from document
3. **Data Matching** - Validates extracted data matches user input
4. **Clear Feedback** - Returns specific mismatch reasons

All OCR processing happens server-side using Tesseract.js.

## Database Schema

Key tables:
- **users** - User accounts with email/password
- **profiles** - User profile information
- **fundi_profiles** - Extended fundi registration data
- **jobs** - Job listings and requests
- **job_photos** - Before/after photos for jobs
- **job_bids** - Fundi bids on jobs
- **service_categories** - Service type definitions
- **payments** - Payment records

## Authentication Flow

1. User signs up → Creates user in `users` table
2. Password is hashed with bcrypt
3. JWT token is generated and stored in localStorage
4. Token is sent with every authenticated request
5. Backend verifies token before processing request

## File Upload Flow

1. File selected in frontend
2. FormData created with file + metadata
3. Sent to `/api/upload` or multipart endpoints
4. Backend validates file type/size
5. File stored in `/backend/uploads/{userId}/{filename}`
6. File URL returned to frontend
7. Path stored in database for reference

## Environment Variables

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000/api
```

### Backend (.env)
```
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173

DB_HOST=localhost
DB_PORT=5432
DB_NAME=fixit_connect
DB_USER=postgres
DB_PASSWORD=postgres

JWT_SECRET=your-secret-key
JWT_EXPIRY=7d

BACKEND_URL=http://localhost:5000
```

## Deployment

### Production Database
Replace `.env` values with production PostgreSQL credentials:
```
DB_HOST=prod-database.example.com
DB_NAME=fixit_production
DB_USER=prod_user
DB_PASSWORD=strong_password_here
```

### Production Backend
```bash
NODE_ENV=production PORT=5000 npm start
```

Use a reverse proxy (nginx) to handle HTTPS and route to backend.

### Production Frontend
```bash
npm run build
# Deploy dist/ folder to static hosting (Vercel, Netlify, etc.)
```

Update `VITE_API_URL` to production backend URL.

## Testing the Flow

### Test Fundi Registration
1. Start both backend and frontend
2. Go to "Register as Fundi"
3. Fill in all fields
4. Upload ID photos (test with clear document photos)
5. Grant GPS permission
6. Submit registration
7. Check backend console for OCR results
8. Database records created in `fundi_profiles` table

### Test Customer Job Request
1. Go to "Create Job Request"
2. Fill in service details
3. Capture location (or allow geo location)
4. Upload photos
5. Submit job
6. Job created in `jobs` table

## Migration Notes

- No mock data exists in database
- All features use real API calls
- No Supabase dependencies remain
- JWT tokens expire after 7 days (configurable)
- Passwords are bcrypt-hashed
- OCR runs on every ID document upload

## Support

For issues:
1. Check backend logs (`npm run dev` terminal)
2. Check frontend console (F12)
3. Verify PostgreSQL is running
4. Ensure `.env` files are configured correctly
5. Check network requests in browser DevTools

## Future Enhancements

- [ ] WebSocket for real-time messaging
- [ ] Payment processing (M-Pesa integration)
- [ ] Push notifications
- [ ] Admin dashboard
- [ ] Email notifications
- [ ] SMS notifications
- [ ] Analytics dashboard
