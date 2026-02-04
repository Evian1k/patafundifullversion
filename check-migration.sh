#!/bin/bash

echo "🔍 Checking for remaining Supabase references..."
echo ""

# Check for Supabase imports
echo "Checking for 'supabase' imports in frontend..."
IMPORTS=$(grep -r "from.*['\"]@/integrations/supabase" src --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "TestimonialsSection\|AdminLogin\|Admin" | wc -l)

if [ $IMPORTS -gt 0 ]; then
  echo "⚠️  Found $IMPORTS remaining Supabase imports:"
  grep -r "from.*['\"]@/integrations/supabase" src --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "TestimonialsSection\|AdminLogin\|Admin"
else
  echo "✅ No remaining Supabase imports in main pages"
fi

echo ""
echo "Checking for Supabase client instantiation..."
CLIENTS=$(grep -r "supabase\." src --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "TestimonialsSection\|AdminLogin\|Admin\|VerificationManagement\|JobManagement\|Dashboard" | wc -l)

if [ $CLIENTS -gt 0 ]; then
  echo "⚠️  Found $CLIENTS references to 'supabase.'"
else
  echo "✅ No remaining Supabase client calls in main pages"
fi

echo ""
echo "Checking for Supabase environment variables in .env..."
SUPABASE_VARS=$(grep -c "VITE_SUPABASE" .env 2>/dev/null || echo 0)

if [ $SUPABASE_VARS -gt 0 ]; then
  echo "❌ Found $SUPABASE_VARS Supabase environment variables"
  echo "   Please remove VITE_SUPABASE_* from .env"
else
  echo "✅ No Supabase environment variables in .env"
fi

echo ""
echo "Checking backend structure..."
if [ -d "backend" ]; then
  echo "✅ Backend directory exists"
  if [ -f "backend/src/index.js" ]; then
    echo "✅ Backend Express app exists"
  fi
  if [ -f "backend/src/db.js" ]; then
    echo "✅ Database connection module exists"
  fi
  if [ -f "backend/src/db/schema.js" ]; then
    echo "✅ Database schema exists"
  fi
fi

echo ""
echo "Checking API client..."
if [ -f "src/lib/api.ts" ]; then
  echo "✅ API client exists"
else
  echo "❌ API client missing"
fi

echo ""
echo "Checking package.json for Supabase..."
if grep -q "@supabase" package.json 2>/dev/null; then
  echo "⚠️  Supabase still in package.json dependencies"
  echo "   Run: npm uninstall @supabase/supabase-js"
else
  echo "✅ No Supabase in package dependencies"
fi

echo ""
echo "🎉 Migration check complete!"
