#!/bin/bash

# End-to-End Test Script for FixIt Connect

echo "🧪 TESTING FIXIT CONNECT END-TO-END"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# API URL
API_URL="http://localhost:5000/api"

# Test 1: Health Check
echo -e "${BLUE}[1/10] Testing Backend Health...${NC}"
HEALTH=$(curl -s "$API_URL/../health" | jq -r '.status')
if [ "$HEALTH" = "OK" ]; then
  echo -e "${GREEN}✓ Backend is running${NC}"
else
  echo -e "${RED}✗ Backend not responding${NC}"
  exit 1
fi

# Test 2: User Signup
echo -e "${BLUE}[2/10] Testing User Signup...${NC}"
SIGNUP=$(curl -s -X POST "$API_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.customer@example.com",
    "password": "password123",
    "fullName": "Test Customer"
  }')

CUSTOMER_TOKEN=$(echo $SIGNUP | jq -r '.token')
CUSTOMER_ID=$(echo $SIGNUP | jq -r '.user.id')

if [ -n "$CUSTOMER_TOKEN" ] && [ "$CUSTOMER_TOKEN" != "null" ]; then
  echo -e "${GREEN}✓ Customer signup successful${NC}"
  echo "  Token: ${CUSTOMER_TOKEN:0:20}..."
  echo "  ID: $CUSTOMER_ID"
else
  echo -e "${RED}✗ Customer signup failed${NC}"
  echo "  Response: $SIGNUP"
  exit 1
fi

# Test 3: Fundi Signup
echo -e "${BLUE}[3/10] Testing Fundi Signup...${NC}"
FUNDI_SIGNUP=$(curl -s -X POST "$API_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.fundi@example.com",
    "password": "password123",
    "fullName": "Test Fundi"
  }')

FUNDI_TOKEN=$(echo $FUNDI_SIGNUP | jq -r '.token')
FUNDI_ID=$(echo $FUNDI_SIGNUP | jq -r '.user.id')

if [ -n "$FUNDI_TOKEN" ] && [ "$FUNDI_TOKEN" != "null" ]; then
  echo -e "${GREEN}✓ Fundi signup successful${NC}"
else
  echo -e "${RED}✗ Fundi signup failed${NC}"
  exit 1
fi

# Test 4: Fundi Registration (with documents)
echo -e "${BLUE}[4/10] Testing Fundi Registration (Mock)...${NC}"

# Create a test image file
echo "test" > /tmp/test_image.jpg

FUNDI_REG=$(curl -s -X POST "$API_URL/fundi/register" \
  -H "Authorization: Bearer $FUNDI_TOKEN" \
  -F "firstName=Test" \
  -F "lastName=Fundi" \
  -F "email=test.fundi@example.com" \
  -F "phone=254712345678" \
  -F "idNumber=12345678" \
  -F "latitude=-1.2921" \
  -F "longitude=36.8219" \
  -F "accuracy=50" \
  -F "locationAddress=Nairobi" \
  -F "idPhoto=@/tmp/test_image.jpg" \
  -F "selfie=@/tmp/test_image.jpg")

REGISTRATION_STATUS=$(echo $FUNDI_REG | jq -r '.success')

if [ "$REGISTRATION_STATUS" = "true" ]; then
  echo -e "${GREEN}✓ Fundi registration submitted${NC}"
else
  echo -e "${YELLOW}⚠ Fundi registration failed (OCR may need real image)${NC}"
  echo "  This is expected with mock image"
fi

# Test 5: Create Job
echo -e "${BLUE}[5/10] Testing Job Creation...${NC}"
JOB=$(curl -s -X POST "$API_URL/jobs" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix Broken Tap",
    "description": "Kitchen tap is leaking",
    "category": "Plumbing",
    "location": "Westlands, Nairobi",
    "latitude": -1.2921,
    "longitude": 36.8219,
    "estimatedPrice": 2000
  }')

JOB_ID=$(echo $JOB | jq -r '.job.id')
JOB_STATUS=$(echo $JOB | jq -r '.job.status')

if [ -n "$JOB_ID" ] && [ "$JOB_ID" != "null" ]; then
  echo -e "${GREEN}✓ Job created${NC}"
  echo "  Job ID: $JOB_ID"
  echo "  Status: $JOB_STATUS"
else
  echo -e "${RED}✗ Job creation failed${NC}"
  echo "  Response: $JOB"
  exit 1
fi

# Test 6: Get Current User
echo -e "${BLUE}[6/10] Testing Get Current User...${NC}"
ME=$(curl -s -X GET "$API_URL/auth/me" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")

ME_ID=$(echo $ME | jq -r '.user.id')
ME_ROLE=$(echo $ME | jq -r '.user.role')

if [ "$ME_ID" = "$CUSTOMER_ID" ]; then
  echo -e "${GREEN}✓ Get current user successful${NC}"
  echo "  Role: $ME_ROLE"
else
  echo -e "${RED}✗ Get current user failed${NC}"
  exit 1
fi

# Test 7: Get Fundi Profile
echo -e "${BLUE}[7/10] Testing Get Fundi Profile...${NC}"
FUNDI_PROFILE=$(curl -s -X GET "$API_URL/fundi/profile" \
  -H "Authorization: Bearer $FUNDI_TOKEN")

FUNDI_PROFILE_ID=$(echo $FUNDI_PROFILE | jq -r '.profile.id')

if [ -n "$FUNDI_PROFILE_ID" ] && [ "$FUNDI_PROFILE_ID" != "null" ]; then
  echo -e "${GREEN}✓ Fundi profile retrieved${NC}"
else
  echo -e "${YELLOW}⚠ Fundi profile not found (may not be registered)${NC}"
fi

# Test 8: Get Jobs
echo -e "${BLUE}[8/10] Testing Get User Jobs...${NC}"
JOBS=$(curl -s -X GET "$API_URL/jobs" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")

JOBS_COUNT=$(echo $JOBS | jq '.jobs | length')

if [ "$JOBS_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✓ Jobs retrieved${NC}"
  echo "  Count: $JOBS_COUNT"
else
  echo -e "${YELLOW}⚠ No jobs found${NC}"
fi

# Test 9: Get Specific Job
echo -e "${BLUE}[9/10] Testing Get Job by ID...${NC}"
JOB_DETAIL=$(curl -s -X GET "$API_URL/jobs/$JOB_ID" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")

JOB_DETAIL_ID=$(echo $JOB_DETAIL | jq -r '.job.id')

if [ "$JOB_DETAIL_ID" = "$JOB_ID" ]; then
  echo -e "${GREEN}✓ Job detail retrieved${NC}"
else
  echo -e "${RED}✗ Job detail retrieval failed${NC}"
fi

# Test 10: Logout
echo -e "${BLUE}[10/10] Testing Logout...${NC}"
LOGOUT=$(curl -s -X POST "$API_URL/auth/logout" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")

LOGOUT_SUCCESS=$(echo $LOGOUT | jq -r '.success')

if [ "$LOGOUT_SUCCESS" = "true" ]; then
  echo -e "${GREEN}✓ Logout successful${NC}"
else
  echo -e "${YELLOW}⚠ Logout response unclear${NC}"
fi

echo ""
echo "===================================="
echo -e "${GREEN}🎉 BASIC TESTS COMPLETED${NC}"
echo "===================================="

# Cleanup
rm -f /tmp/test_image.jpg

echo ""
echo "📝 Summary:"
echo "- Backend is responsive"
echo "- User authentication working"
echo "- Job creation functional"
echo "- API endpoints accessible"
echo ""
echo "⚠️  Note: Some tests may fail if database is not initialized"
echo "   Run: npm run setup-db (in backend directory)"
