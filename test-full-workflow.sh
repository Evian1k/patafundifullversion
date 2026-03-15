#!/bin/bash

# Full fundi workflow test: from signup → registration → approval → online

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

API="http://localhost:5000/api"
ADMIN_EMAIL="emmanuelevian@gmail.com"
ADMIN_PASSWORD="emmanuelevian12k@Q"

echo -e "${YELLOW}=== Full Fundi Workflow Test ===${NC}\n"

# 1. Admin Login
echo -e "${YELLOW}[1] Admin Login...${NC}"
ADMIN=$(curl -s -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ADMIN_TOKEN=$(echo $ADMIN | jq -r '.token')
ADMIN_ROLE=$(echo $ADMIN | jq -r '.user.role')

if [ "$ADMIN_ROLE" == "admin" ]; then
  echo -e "${GREEN}✓ Admin authenticated${NC}"
else
  echo -e "${RED}✗ Admin login failed: $ADMIN_ROLE${NC}"
  exit 1
fi

# 2. Create test fundi account
echo -e "\n${YELLOW}[2] Create Fundi Account...${NC}"
FUNDI=$(curl -s -X POST $API/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"flowtest@fundi.com","password":"Password123","fullName":"Flow Test Fundi"}')
FUNDI_ID=$(echo $FUNDI | jq -r '.user.id')
FUNDI_TOKEN=$(echo $FUNDI | jq -r '.token')
FUNDI_ROLE=$(echo $FUNDI | jq -r '.user.role')

echo "  Fundi ID: $FUNDI_ID"
echo "  Initial Role: $FUNDI_ROLE"

# 3. Try to go online (should fail - not approved)
echo -e "\n${YELLOW}[3] Fundi Attempts to Go Online (Pre-Approval)...${NC}"
ONLINE_FAIL=$(curl -s -X POST $API/fundi/status/online \
  -H "Authorization: Bearer $FUNDI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitude":-1.2921,"longitude":36.8219,"accuracy":15}')
ONLINE_ERR=$(echo $ONLINE_FAIL | jq -r '.message // .success')

if [[ "$ONLINE_ERR" == *"Required role"* ]]; then
  echo -e "${GREEN}✓ Correctly blocked (no fundi role yet)${NC}"
else
  echo -e "${YELLOW}⚠ Result: $ONLINE_ERR${NC}"
fi

# 4. Create a fundi profile entry in database (simulate registration)
# In real flow, fundi would upload documents and OCR would verify
echo -e "\n${YELLOW}[4] Admin Approves Fundi (Simulating Registration)...${NC}"

# First, insert a fundi_profile (simulating registration submission)
psql -U postgres -h localhost -d fixit_connect -c "
INSERT INTO fundi_profiles (
  id, user_id, first_name, last_name, email, phone,
  id_number, verification_status, skills, experience_years
) VALUES (
  '${FUNDI_ID}-prof',
  '${FUNDI_ID}',
  'Flow',
  'Test',
  'flowtest@fundi.com',
  '+254712345678',
  'KE123456789',
  'pending',
  ARRAY['plumbing', 'electrical'],
  3
) ON CONFLICT (user_id) DO NOTHING;
" 2>&1 | grep -v "Password\|already"

# Then admin approves
echo -e "\n  Admin approves fundi..."
APPROVE=$(curl -s -X POST "$API/admin/fundis/${FUNDI_ID}-prof/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes":"Test approval"}')
APPROVE_SUCCESS=$(echo $APPROVE | jq -r '.success // false')

if [ "$APPROVE_SUCCESS" == "true" ]; then
  echo -e "${GREEN}✓ Fundi approved${NC}"
else
  echo -e "${YELLOW}⚠ Approval result: $(echo $APPROVE | jq -r '.message // .success')${NC}"
fi

# 5. Re-check fundi role after approval
echo -e "\n${YELLOW}[5] Verify Fundi Role Changed to 'fundi' after Approval...${NC}"
ME=$(curl -s -X GET $API/auth/me -H "Authorization: Bearer $FUNDI_TOKEN")
NEW_ROLE=$(echo $ME | jq -r '.user.role')

if [ "$NEW_ROLE" == "fundi" ]; then
  echo -e "${GREEN}✓ Fundi role successfully assigned after approval${NC}"
else
  echo -e "${YELLOW}⚠ Role is: $NEW_ROLE (may need to re-login)${NC}"
fi

# 6. Fundi tries to go online (should now succeed with new role)
echo -e "\n${YELLOW}[6] Fundi Goes Online (Post-Approval)...${NC}"

# Get fresh token after role change
FUNDI_REFRESH=$(curl -s -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"flowtest@fundi.com","password":"Password123"}')
FUNDI_TOKEN=$(echo $FUNDI_REFRESH | jq -r '.token')

ONLINE_OK=$(curl -s -X POST $API/fundi/status/online \
  -H "Authorization: Bearer $FUNDI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitude":-1.2921,"longitude":36.8219,"accuracy":15}')
ONLINE_SUCCESS=$(echo $ONLINE_OK | jq -r '.success')

if [ "$ONLINE_SUCCESS" == "true" ]; then
  echo -e "${GREEN}✓ Fundi successfully went online${NC}"
  echo $ONLINE_OK | jq '.location | {latitude, longitude, accuracy, online}'
else
  echo -e "${RED}✗ Online status failed: $(echo $ONLINE_OK | jq -r '.message // .success')${NC}"
fi

# 7. Job matching test
echo -e "\n${YELLOW}[7] Create Job and Test Matching...${NC}"
CUSTOMER=$(curl -s -X POST $API/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"customer2@test.com","password":"Password123","fullName":"Test Customer 2"}')
CUSTOMER_ID=$(echo $CUSTOMER | jq -r '.user.id')
CUSTOMER_TOKEN=$(echo $CUSTOMER | jq -r '.token')

JOB=$(curl -s -X POST $API/jobs \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Electrical repair",
    "description":"Fix wiring",
    "category":"electrical",
    "location":"Nairobi",
    "latitude":-1.2921,
    "longitude":36.8219,
    "estimatedPrice":800
  }')
JOB_ID=$(echo $JOB | jq -r '.job.id')
JOB_STATUS=$(echo $JOB | jq -r '.job.status')

if [ ! -z "$JOB_ID" ] && [ "$JOB_ID" != "null" ]; then
  echo -e "${GREEN}✓ Job created: $JOB_ID (status: $JOB_STATUS)${NC}"
else
  echo -e "${RED}✗ Job creation failed${NC}"
fi

echo -e "\n${GREEN}=== Workflow Test Complete ===${NC}"
echo -e "${YELLOW}Summary:${NC}"
echo "  Admin: $ADMIN_EMAIL (authenticated)"
echo "  Fundi: flowtest@fundi.com (ID: $FUNDI_ID)"
echo "  Fundi Role After Approval: $NEW_ROLE"
echo "  Fundi Online Status: $ONLINE_SUCCESS"
echo "  Job Created: $JOB_ID"
