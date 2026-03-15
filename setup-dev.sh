#!/usr/bin/env bash

# fixit-connect setup script for local development

set -e

echo "🚀 FixIt Connect - Local Development Setup"
echo "==========================================="
echo ""

# Check prerequisites
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js v18+"
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL not found. Ensure PostgreSQL is installed and running."
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Install dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install --legacy-peer-deps
cd ..

echo "📦 Installing frontend dependencies..."
npm install --legacy-peer-deps

echo ""
echo "🗄️  Setting up database..."

# Create database
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'fixit_connect'" | grep -q 1 || {
    psql -U postgres -c "CREATE DATABASE fixit_connect;"
    echo "✅ Database created"
}

# Setup backend
cd backend
echo "🔧 Running database schema..."
npm run setup-db

echo "👤 Creating admin account..."
npm run setup-admin

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env files with your configuration"
echo "2. Start backend: cd backend && npm run dev"
echo "3. Start frontend: npm run dev (in another terminal)"
echo "4. Visit http://localhost:3000"
echo ""
echo "Default admin credentials:"
echo "  Email: emmanuelevian@gmail.com"
echo "  Password: emmanuelevian12k@Q"
echo ""
