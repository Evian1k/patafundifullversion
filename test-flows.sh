#!/bin/bash

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API="http://localhost:5000/api"
ADMIN_EMAIL="emmanuelevian@gmail.com"
ADMIN_PASSWORD="emmanuelevian12k@Q"
RUN_ID=$(date +%s)
CUSTOMER_EMAIL="customer+$RUN_ID@test.com"
FUNDI_EMAIL="fundi+$RUN_ID@test.com"

echo -e "${YELLOW}=== FixIt Connect E2E Tests ===${NC}\n"

# Test 1: Customer signup
echo -e "${YELLOW}[1/8] Customer Signup...${NC}"
CUSTOMER=$(curl -s -X POST $API/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$CUSTOMER_EMAIL\",\"password\":\"Password123\",\"fullName\":\"Test Customer\"}")
CUSTOMER_ID=$(echo $CUSTOMER | jq -r '.user.id')
CUSTOMER_TOKEN=$(echo $CUSTOMER | jq -r '.token')
CUSTOMER_ROLE=$(echo $CUSTOMER | jq -r '.user.role')

if [ "$CUSTOMER_ROLE" == "customer" ]; then
  echo -e "${GREEN}✓ Customer created with role: $CUSTOMER_ROLE${NC}"
else
  echo -e "${RED}✗ Customer role incorrect: $CUSTOMER_ROLE${NC}"
fi

# Test 2: Fundi signup
echo -e "\n${YELLOW}[2/8] Fundi Signup...${NC}"
FUNDI=$(curl -s -X POST $API/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$FUNDI_EMAIL\",\"password\":\"Password123\",\"fullName\":\"Test Fundi\"}")
FUNDI_ID=$(echo $FUNDI | jq -r '.user.id')
FUNDI_TOKEN=$(echo $FUNDI | jq -r '.token')
FUNDI_ROLE=$(echo $FUNDI | jq -r '.user.role')

if [ "$FUNDI_ROLE" == "customer" ]; then
  echo -e "${GREEN}✓ Fundi created with initial role: $FUNDI_ROLE (will become fundi after registration+approval)${NC}"
else
  echo -e "${RED}✗ Fundi initial role incorrect: $FUNDI_ROLE${NC}"
fi

# Test 3: Verify /auth/me returns role
echo -e "\n${YELLOW}[3/8] Verify /auth/me endpoint...${NC}"
ME=$(curl -s -X GET $API/auth/me -H "Authorization: Bearer $FUNDI_TOKEN")
ME_ROLE=$(echo $ME | jq -r '.user.role')

if [ "$ME_ROLE" == "customer" ]; then
  echo -e "${GREEN}✓ /auth/me returns user role: $ME_ROLE${NC}"
else
  echo -e "${RED}✗ /auth/me role incorrect: $ME_ROLE${NC}"
fi

# Test 4: Fundi cannot go online without approval
echo -e "\n${YELLOW}[4/8] Fundi Online Status (before approval)...${NC}"
ONLINE_FAIL=$(curl -s -X POST $API/fundi/status/online \
  -H "Authorization: Bearer $FUNDI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitude":-1.2921,"longitude":36.8219,"accuracy":15}')
ONLINE_ERR=$(echo $ONLINE_FAIL | jq -r '.message // .success')

if [[ "$ONLINE_ERR" == *"Required roles"* ]] || [[ "$ONLINE_ERR" == *"not yet approved"* ]] || [[ "$ONLINE_ERR" == "false" ]]; then
  echo -e "${GREEN}✓ Unverified fundi blocked from going online${NC}"
else
  echo -e "${RED}✗ Unverified fundi should not go online: $ONLINE_ERR${NC}"
fi

# Test 5: Create a job as customer
echo -e "\n${YELLOW}[5/8] Create Job as Customer...${NC}"
JOB=$(curl -s -X POST $API/jobs \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Fix my plumbing",
    "description":"Leaky pipe",
    "category":"plumbing",
    "location":"Nairobi",
    "latitude":-1.2921,
    "longitude":36.8219,
    "estimatedPrice":500
  }')
JOB_ID=$(echo $JOB | jq -r '.job.id')
JOB_STATUS=$(echo $JOB | jq -r '.job.status')

if [ ! -z "$JOB_ID" ] && [ "$JOB_ID" != "null" ]; then
  echo -e "${GREEN}✓ Job created: $JOB_ID (status: $JOB_STATUS)${NC}"
else
  echo -e "${RED}✗ Job creation failed${NC}"
fi

# Test 6: Fundi registration (with mock files simulation)
echo -e "\n${YELLOW}[6/8] Fundi Registration (verification status check)...${NC}"
# Note: Real registration needs actual file uploads; we're just verifying endpoint exists
FUNDI_PROFILE=$(curl -s -X GET $API/fundi/profile -H "Authorization: Bearer $FUNDI_TOKEN")
PROFILE_STATUS=$(echo $FUNDI_PROFILE | jq -r '.success // false')

if [[ "$PROFILE_STATUS" == "false" ]]; then
  echo -e "${GREEN}✓ Fundi has no profile yet (as expected before registration)${NC}"
else
  echo -e "${YELLOW}⚠ Fundi profile check: $PROFILE_STATUS${NC}"
fi

# Test 7: Admin login (configure via env)
echo -e "\n${YELLOW}[7/8] Admin Login...${NC}"
ADMIN=$(curl -s -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ADMIN_ROLE=$(echo $ADMIN | jq -r '.user.role // "error"')

if [ "$ADMIN_ROLE" == "admin" ]; then
  echo -e "${GREEN}✓ Admin authenticated with role: $ADMIN_ROLE${NC}"
elif [ "$ADMIN_ROLE" == "null" ] || [[ "$ADMIN_ROLE" == *"error"* ]]; then
  echo -e "${YELLOW}⚠ Admin user may not exist (initialize via database setup)${NC}"
else
  echo -e "${RED}✗ Admin role incorrect: $ADMIN_ROLE${NC}"
fi

# Test 8: Verify GPS accuracy rejection
echo -e "\n${YELLOW}[8/8] GPS Accuracy Threshold Check...${NC}"
POOR_GPS=$(curl -s -X POST $API/fundi/status/online \
  -H "Authorization: Bearer $FUNDI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitude":-1.2921,"longitude":36.8219,"accuracy":500}')
GPS_ERR=$(echo $POOR_GPS | jq -r '.message // "ok"')

if [[ "$GPS_ERR" == *"poor"* ]]; then
  echo -e "${GREEN}✓ Poor GPS accuracy (>150m) rejected${NC}"
else
  echo -e "${YELLOW}⚠ GPS accuracy check: $GPS_ERR${NC}"
fi

echo -e "\n${GREEN}=== E2E Tests Complete ===${NC}"
echo -e "${YELLOW}Summary:${NC}"
echo "  Customer ID: $CUSTOMER_ID"
echo "  Fundi ID: $FUNDI_ID"
echo "  Job ID: $JOB_ID"
echo "  Backend: http://localhost:5000"
echo "  Frontend: http://localhost:8080"
