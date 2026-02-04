# Quick Start Guide - FixIt Connect (Post-Migration)

## Prerequisites
- Node.js 16+ installed
- PostgreSQL installed and running
- Git

## 1️⃣ Clone and Setup

```bash
# Clone the repository
git clone <repo-url>
cd fixit-connect

# Install frontend dependencies
npm install
```

## 2️⃣ Setup Backend

```bash
cd backend

# Install backend dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env if needed (defaults work for local dev)
# DB_USER, DB_PASSWORD, etc.

# Create PostgreSQL database
createdb fixit_connect

# Initialize database schema
npm run setup-db

# Start backend (development mode)
npm run dev
```

✅ Backend should be running on `http://localhost:5000`

## 3️⃣ Setup Frontend

```bash
# Go back to root directory
cd ..

# Ensure .env exists with API URL
# (already configured in .env file)

# Start frontend development server
npm run dev
```

✅ Frontend should be running on `http://localhost:5173`

## 4️⃣ Test the Application

### Register as Customer
1. Open `http://localhost:5173`
2. Click "Sign In" → "Create Account"
3. Enter email, password, full name
4. Go to Dashboard

### Register as Fundi
1. From landing page, click "Register as Service Professional"
2. Fill in personal information:
   - First name, last name
   - Email, phone
   - ID number
3. Upload ID documents:
   - ID photo (front)
   - ID photo (back) - optional
   - Selfie
4. Grant GPS permission (location auto-captured)
5. Select skills and enter experience
6. Submit registration

✅ Registration saved to database with OCR verification

### Create a Job Request
1. Go to Dashboard
2. Click "Create Job Request"
3. Select service category
4. Enter job description
5. Pick location on map (or auto-detect)
6. Upload photos of the area
7. Submit job request

✅ Job saved to database and ready for fundis to bid

## 📁 Project Structure

```
fixit-connect/
├── backend/                    # Node.js Express backend
│   ├── src/
│   │   ├── index.js           # Express app
│   │   ├── db.js              # Database connection
│   │   ├── routes/            # API endpoints
│   │   ├── services/          # Business logic (OCR, file upload)
│   │   └── db/schema.js       # Database schema
│   ├── uploads/               # User uploaded files
│   └── package.json
│
├── src/                        # Frontend (React + TypeScript)
│   ├── lib/api.ts             # API client
│   ├── pages/                 # Page components
│   ├── components/            # Reusable components
│   └── modules/fundis/        # Fundi registration logic
│
├── .env                        # Frontend environment
└── package.json               # Frontend dependencies
```

## 🔧 Environment Variables

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000/api
```

### Backend (.env)
```
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fixit_connect
DB_USER=postgres
DB_PASSWORD=postgres

# JWT
JWT_SECRET=dev-secret-key
JWT_EXPIRY=7d

# File serving
BACKEND_URL=http://localhost:5000
```

## 🚀 Common Commands

### Backend
```bash
cd backend

# Development (with hot reload)
npm run dev

# Production
npm start

# Setup database
npm run setup-db
```

### Frontend
```bash
# Development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check if port 5000 is in use
lsof -i :5000

# Check PostgreSQL is running
psql -U postgres -d fixit_connect

# Verify database exists
createdb fixit_connect  # or drop and recreate if needed
npm run setup-db
```

### Frontend can't connect to backend
- Check backend is running on http://localhost:5000
- Check `.env` has correct `VITE_API_URL`
- Check browser console (F12) for network errors
- Check backend logs for error messages

### Database errors
- Ensure PostgreSQL is running: `psql` to verify
- Check credentials in backend `.env`
- Run `npm run setup-db` to initialize tables
- Check backend logs for SQL errors

### File uploads not working
- Check `backend/uploads` directory exists (created automatically)
- Verify user has write permissions
- Check file size limit (10MB default)
- Look for errors in backend logs

## 📚 Documentation

- [Migration Guide](./MIGRATION_COMPLETE.md) - Complete migration details
- [Backend README](./backend/README.md) - Backend API documentation
- [API Endpoints](#) - Full API reference

## ✨ Features Status

| Feature | Status | Notes |
|---------|--------|-------|
| User Authentication | ✅ | JWT-based, stored in localStorage |
| Fundi Registration | ✅ | With OCR verification |
| Document Upload | ✅ | ID, selfie, certificates |
| OCR Verification | ✅ | Tesseract.js, server-side |
| Job Management | ✅ | Create, view, update jobs |
| Photo Uploads | ✅ | Store photos with jobs |
| GPS Tracking | ✅ | Location capture on fundi registration |
| Real-time Updates | ✅ | Polling-based (WebSocket ready) |
| M-Pesa Integration | ✅ | Phone field ready, payment pending |
| Admin Dashboard | ⚠️ | Partially implemented, needs backend update |

## 🎯 Next Steps

1. **Test all flows** - Register fundi, create job, upload files
2. **Check database** - View records: `psql -U postgres -d fixit_connect`
3. **Review logs** - Check backend terminal for any issues
4. **Deploy** - Update `.env` values for production databases

## 📞 Support

Check logs:
- **Frontend**: Browser console (F12)
- **Backend**: Terminal running `npm run dev`
- **Database**: `psql` CLI

For detailed error info:
- Check application error messages
- Review full backend output
- Enable debug mode if available

## ✅ You're Ready!

The application is now running with a custom backend. All Supabase dependencies have been completely removed and replaced with a robust Express API and PostgreSQL database.

Enjoy! 🎉
