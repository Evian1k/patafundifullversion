# FUNDI LIFECYCLE - COMPREHENSIVE TEST CASES
**Production-Ready Test Suite for Service Provider Registration & Operations**

---

## 🧪 TEST EXECUTION FRAMEWORK

### Test Environment
- **Backend:** Node.js Express running on `http://localhost:5000`
- **Frontend:** React Vite running on `http://localhost:5173`
- **Database:** PostgreSQL with fresh schema initialization
- **API Client:** Custom REST API with JWT authentication

### Test Automation
```bash
# Reset database and run all tests
npm run setup-db
npm run test:fundi

# Run specific test suite
npm run test:fundi -- --testNamePattern="Step.*Registration"
npm run test:fundi -- --testNamePattern="Subscription"
npm run test:fundi -- --testNamePattern="Anti.*Fraud"
```

---

## 🧑‍🔧 STEP 1: ACCOUNT CREATION

### Test 1.1 - User Signup Creates Customer Account
**Precondition:** User not registered  
**Steps:**
1. POST `/api/auth/signup` with email, password, phone
2. Verify user created with `role='customer'`
3. Verify JWT token returned
4. Verify token stored in localStorage

**Expected Result:**
- ✅ User account created
- ✅ role = 'customer'
- ✅ JWT token valid for 7 days
- ✅ Password hashed with bcryptjs
- ✅ User can login with email/password

**Assertion Code:**
```typescript
const user = await signupUser('test@example.com', 'Pass123!');
expect(user.role).toBe('customer');
expect(user.id).toBeDefined();
expect(localStorage.getItem('auth_token')).toBeTruthy();
```

---

### Test 1.2 - Cannot Signup with Weak Password
**Precondition:** User not registered  
**Steps:**
1. POST `/api/auth/signup` with weak password (< 8 chars)
2. POST `/api/auth/signup` with password missing uppercase
3. POST `/api/auth/signup` with password missing special char

**Expected Result:**
- ✅ Signup rejected with validation error
- ✅ User not created
- ✅ Clear error message about password requirements

---

### Test 1.3 - Cannot Signup with Duplicate Email
**Precondition:** User already exists  
**Steps:**
1. Create first user with email test@example.com
2. Attempt second signup with same email
3. Verify error response

**Expected Result:**
- ✅ Signup rejected
- ✅ Error message: "Email already registered"
- ✅ First user still exists

---

## ✅ STEP 2: PERSONAL INFORMATION

### Test 2.1 - Submit Personal Information
**Precondition:** User signed up, logged in  
**Steps:**
1. POST `/api/fundi/registration/step/2/personal-info`
   - firstName: "John"
   - lastName: "Doe"
   - idNumber: "12345678"
2. Verify profile updated
3. Verify step 2 completed

**Expected Result:**
- ✅ Profile created with personal info
- ✅ `step_2_completed_at` set to current timestamp
- ✅ `registration_step` = 3
- ✅ Can now proceed to Step 3

**Assertion Code:**
```typescript
const response = await apiClient.submitPersonalInfo('John', 'Doe', '12345678');
expect(response.profile.registrationStep).toBe(3);
const status = await apiClient.getFundiRegistrationStatus();
expect(status.profile.completedSteps.step2_personalInfo).toBe(true);
```

---

### Test 2.2 - Cannot Skip Steps
**Precondition:** User signed up but NOT started registration  
**Steps:**
1. Attempt POST `/api/fundi/registration/step/2/personal-info` without step 1

**Expected Result:**
- ✅ Rejected with error: "Fundi registration not started. Call /step/1/start first"
- ✅ Data not saved

---

### Test 2.3 - Cannot Resubmit Step 2
**Precondition:** Step 2 already completed  
**Steps:**
1. Submit personal info first time
2. Attempt to submit personal info again

**Expected Result:**
- ✅ Rejected with error: "Step 2 already completed. Cannot resubmit personal information"
- ✅ Original data not modified

---

### Test 2.4 - Detect Duplicate ID Numbers
**Precondition:** First fundi registered with ID 12345678  
**Steps:**
1. Create second user account
2. Attempt to register as fundi with same ID 12345678

**Expected Result:**
- ✅ Rejected with error: "This national ID number is already registered"
- ✅ Fraud flag logged to `fundi_fraud_logs` table
- ✅ Severity = 'high'

**Assertion Code:**
```typescript
// First fundi uses ID 12345678
await apiClient.submitPersonalInfo('Alice', 'Smith', '12345678');

// Second fundi tries same ID
const error = await apiClient.submitPersonalInfo('Bob', 'Jones', '12345678');
expect(error.message).toContain('already registered');

// Verify fraud log
const fraudLogs = await getDatabase('fundi_fraud_logs')
  .select('*')
  .where('fraud_type', '=', 'duplicate_id');
expect(fraudLogs.length).toBeGreaterThan(0);
```

---

### Test 2.5 - Validate Name Format
**Precondition:** User in Step 2  
**Steps:**
1. Attempt with firstName = "A" (1 character)
2. Attempt with lastName = "" (empty)
3. Attempt with firstName = "123" (only numbers)

**Expected Result:**
- ✅ All rejected with validation error
- ✅ Error message: "Name must be at least 2 characters"
- ✅ Data not saved

---

## 📸 STEP 3: DOCUMENT UPLOAD & OCR

### Test 3.1 - Upload ID Documents and Pass OCR
**Precondition:** Step 2 completed, real ID photo with clear text  
**Steps:**
1. POST `/api/fundi/registration/step/3/upload-documents`
   - idPhotoFront: file with "JOHN DOE" and "12345678" visible
   - idPhotoBack: optional
2. Backend runs OCR on image
3. OCR extracts name and ID number
4. Backend compares with Step 2 data
5. Verify match passes

**Expected Result:**
- ✅ Documents stored securely in `/uploads`
- ✅ OCR data extracted and stored
- ✅ Confidence score recorded (should be > 70%)
- ✅ `step_3_completed_at` set
- ✅ `registration_step` = 4

**Assertion Code:**
```typescript
const response = await apiClient.uploadDocuments(idPhotoFile);
expect(response.profile.ocrVerification.idMatches).toBe(true);
expect(response.profile.ocrVerification.nameMatches).toBe(true);
expect(response.profile.ocrVerification.confidenceScore).toBeGreaterThan(70);
```

---

### Test 3.2 - Reject on Name Mismatch
**Precondition:** Step 2 completed with firstName="John", submitted "ALICE" in ID photo  
**Steps:**
1. POST `/api/fundi/registration/step/3/upload-documents`
   - idPhotoFront: file with "ALICE SMITH" visible
2. OCR extracts "ALICE SMITH" from image
3. Compare with submitted "John Doe"
4. Mismatch detected

**Expected Result:**
- ✅ Upload rejected with error: "OCR verification failed: Name does not match"
- ✅ Documents not saved
- ✅ Fraud flag logged with type='ocr_name_mismatch' and severity='high'
- ✅ Admin alert generated

**Assertion Code:**
```typescript
const error = await apiClient.uploadDocuments(idPhotoWithWrongName);
expect(error.message).toContain('Name does not match');

const fraudLogs = await getDatabase('fundi_fraud_logs')
  .select('*')
  .where('fraud_type', '=', 'ocr_name_mismatch');
expect(fraudLogs[0].severity).toBe('high');
```

---

### Test 3.3 - Reject on ID Number Mismatch
**Precondition:** Step 2 completed with idNumber="12345678", ID photo shows "87654321"  
**Steps:**
1. Upload ID document with different ID number
2. OCR detects mismatch

**Expected Result:**
- ✅ Upload rejected
- ✅ Fraud flag logged with type='ocr_id_mismatch'
- ✅ Clear error message

---

### Test 3.4 - Handle Blurry/Low Quality OCR
**Precondition:** ID photo too blurry, OCR confidence < 60%  
**Steps:**
1. Upload very blurry ID photo
2. OCR returns low confidence

**Expected Result:**
- ✅ Upload rejected with error: "Image quality too low. Please recapture clearly"
- ✅ Documents not saved
- ✅ Allow user to retry

---

### Test 3.5 - Cannot Skip to Step 4 Without Step 3
**Precondition:** Step 3 not completed  
**Steps:**
1. Attempt POST `/api/fundi/registration/step/4/selfie`

**Expected Result:**
- ✅ Rejected with error: "Complete Step 3 first"
- ✅ Data not saved

---

## 🤳 STEP 4: SELFIE VERIFICATION

### Test 4.1 - Upload Selfie Photo
**Precondition:** Step 3 completed  
**Steps:**
1. POST `/api/fundi/registration/step/4/selfie`
   - selfiePhoto: blob from camera capture
2. Backend stores selfie
3. Records verification evidence

**Expected Result:**
- ✅ Selfie saved to `/uploads`
- ✅ Face match score recorded (70%+ required)
- ✅ Liveness score recorded
- ✅ Quality checks passed
- ✅ `step_4_completed_at` set
- ✅ `registration_step` = 5

**Assertion Code:**
```typescript
const response = await apiClient.submitSelfie(selfieBlob);
expect(response.profile.registrationStep).toBe(5);
const status = await apiClient.getFundiRegistrationStatus();
expect(status.profile.evidence.face_match).toBe(true);
```

---

### Test 4.2 - Face Matching Score Required
**Precondition:** Selfie doesn't match ID photo  
**Steps:**
1. Upload selfie that's clearly a different person
2. Frontend should detect low face match score

**Expected Result:**
- ✅ Backend rejects if confidence < 70%
- ✅ Error message: "Face does not match ID. Please retake selfie."
- ✅ Clear retry button
- ✅ Fraud flag logged if pattern detected

---

### Test 4.3 - Liveness Detection (Head Movement)
**Precondition:** Selfie uploaded  
**Steps:**
1. Attempt to upload static photo (not live)
2. Liveness check detects no movement

**Expected Result:**
- ✅ Rejected if liveness score < 60%
- ✅ Error message: "Please take a live selfie with head movement"
- ✅ Allow retry

---

## 🗺️ STEP 5: GPS LOCATION VERIFICATION

### Test 5.1 - Capture Live GPS Coordinates
**Precondition:** Step 4 completed, device has GPS access  
**Steps:**
1. POST `/api/fundi/registration/step/5/location`
   - latitude: -1.2921 (Nairobi)
   - longitude: 36.8219 (Nairobi)
   - accuracy: 15 (meters)
2. Backend validates GPS data

**Expected Result:**
- ✅ Location stored: latitude, longitude, accuracy, timestamp
- ✅ Accuracy < 50 meters (validation passed)
- ✅ `location_captured_at` = current timestamp
- ✅ `step_5_completed_at` set
- ✅ `registration_step` = 6

**Assertion Code:**
```typescript
const response = await apiClient.submitLocation(-1.2921, 36.8219, 15);
expect(response.profile.location.latitude).toBeCloseTo(-1.2921, 4);
expect(response.profile.location.accuracy).toBe(15);
```

---

### Test 5.2 - Reject Poor GPS Accuracy
**Precondition:** Device GPS has poor accuracy (100 meters)  
**Steps:**
1. POST location with accuracy=100

**Expected Result:**
- ✅ Rejected with error: "GPS accuracy too low (100m). Accuracy must be better than 50 meters."
- ✅ Clear instruction: "Move to open area and try again"
- ✅ Allow retry

**Assertion Code:**
```typescript
const error = await apiClient.submitLocation(-1.2921, 36.8219, 100);
expect(error.message).toContain('GPS accuracy too low');
```

---

### Test 5.3 - Enforce Manual Location Entry Prevention
**Precondition:** Frontend should not allow manual entry  
**Steps:**
1. Verify UI has NO manual latitude/longitude fields
2. Verify "Use Device Location" button REQUIRED
3. UI should show accuracy meter in real-time

**Expected Result:**
- ✅ Only GPS/device location option available
- ✅ No input fields for coordinates
- ✅ Cannot submit without GPS permission granted
- ✅ Accuracy displayed to user

---

### Test 5.4 - Coordinate Validation
**Precondition:** User submits invalid coordinates  
**Steps:**
1. POST with latitude=95 (out of range -90 to 90)
2. POST with longitude=200 (out of range -180 to 180)
3. POST with non-numeric coordinates

**Expected Result:**
- ✅ All rejected with error: "GPS coordinates out of range"
- ✅ No data saved
- ✅ User prompted to retry

---

## 🔧 STEP 6: SKILLS & EXPERIENCE

### Test 6.1 - Submit Skills and Experience
**Precondition:** Step 5 completed  
**Steps:**
1. POST `/api/fundi/registration/step/6/skills`
   - skills: ["Plumbing", "Electrical"]
   - experienceYears: 5
   - certificates: [] (optional)
2. Backend validates and stores

**Expected Result:**
- ✅ Skills stored as array
- ✅ Experience years stored as integer
- ✅ `step_6_completed_at` set
- ✅ `registration_step` = 7

**Assertion Code:**
```typescript
const response = await apiClient.submitSkills(
  ['Plumbing', 'Electrical'],
  5,
  []
);
expect(response.profile.skills).toEqual(['Plumbing', 'Electrical']);
expect(response.profile.experienceYears).toBe(5);
```

---

### Test 6.2 - At Least One Skill Required
**Precondition:** User attempts no skills  
**Steps:**
1. POST with empty skills array
2. POST with skills = []

**Expected Result:**
- ✅ Rejected with error: "At least one skill is required"
- ✅ Data not saved

---

### Test 6.3 - Experience Years Validation
**Precondition:** User submits invalid experience  
**Steps:**
1. POST with experienceYears=-1
2. POST with experienceYears=150
3. POST with experienceYears="not a number"

**Expected Result:**
- ✅ All rejected with error: "Experience years must be between 0 and 100"
- ✅ Data not saved

---

### Test 6.4 - Upload Certificates (Optional)
**Precondition:** User has trade certificates  
**Steps:**
1. POST `/api/fundi/registration/step/6/skills`
   - skills: ["Electrical"]
   - experienceYears: 10
   - certificates: [file1.pdf, file2.pdf]
2. Files uploaded and stored

**Expected Result:**
- ✅ Certificates stored
- ✅ File paths saved in `certificate_paths` array
- ✅ Files accessible via `/uploads` endpoint
- ✅ Max 5 certificates enforced

---

## 💰 STEP 7: PAYMENT METHOD SETUP

### Test 7.1 - Submit M-Pesa Number
**Precondition:** Step 6 completed  
**Steps:**
1. POST `/api/fundi/registration/step/7/payment`
   - mpesaNumber: "+254712345678"
2. Backend validates format
3. Stores securely

**Expected Result:**
- ✅ M-Pesa number stored
- ✅ `payment_method_verified` = true
- ✅ `step_7_completed_at` set
- ✅ `verification_status` = 'pending_admin_review'
- ✅ `registration_step` = 8 (COMPLETE)

**Assertion Code:**
```typescript
const response = await apiClient.submitPaymentMethod('+254712345678');
expect(response.profile.verificationStatus).toBe('pending_admin_review');
expect(response.profile.registrationStep).toBe(8);
```

---

### Test 7.2 - M-Pesa Number Format Validation
**Precondition:** User submits invalid format  
**Steps:**
1. POST with "12345" (too short)
2. POST with "254712345678" (no country code)
3. POST with "invalid-number"
4. POST with "+254 712 345 678" (with spaces - should accept and normalize)

**Expected Result:**
- ✅ Invalid formats rejected
- ✅ Valid formats with spaces normalized and accepted
- ✅ Clear error message: "Invalid M-Pesa number format. Use format: +254712345678 or 0712345678"

---

### Test 7.3 - Payment Method Cannot Be Skipped
**Precondition:** User completed Steps 1-6  
**Steps:**
1. POST `/api/fundi/registration/step/8/complete` or try to access jobs
2. No payment method submitted

**Expected Result:**
- ✅ Access denied to job requests
- ✅ Error message: "Complete payment setup (Step 7) to access jobs"
- ✅ Dashboard shows "Go Online" button disabled with reason

---

### Test 7.4 - Cannot Submit Same Payment Method Twice
**Precondition:** Payment method already submitted  
**Steps:**
1. Submit M-Pesa number once
2. Attempt to submit again

**Expected Result:**
- ✅ Rejected with error: "Step 7 already completed. Cannot resubmit payment method"
- ✅ Original number not modified

---

## ✅ REGISTRATION COMPLETION

### Test 8.1 - All Steps Complete - Admin Review Pending
**Precondition:** All 7 steps completed successfully  
**Steps:**
1. GET `/api/fundi/registration/status`
2. Verify all steps marked as complete
3. Verify status = 'pending_admin_review'

**Expected Result:**
- ✅ All steps show `completed: true`
- ✅ `verificationStatus: 'pending_admin_review'`
- ✅ Dashboard shows "Awaiting admin review"
- ✅ User cannot go online yet
- ✅ Admin notification email sent to admin@domain.com

**Assertion Code:**
```typescript
const status = await apiClient.getFundiRegistrationStatus();
expect(status.profile.completedSteps).toMatchObject({
  step1_accountCreation: true,
  step2_personalInfo: true,
  step3_documents: true,
  step4_selfie: true,
  step5_location: true,
  step6_skills: true,
  step7_payment: true
});
expect(status.profile.verificationStatus).toBe('pending_admin_review');
```

---

## 🔐 ANTI-CHEATING RULES

### Test 9.1 - Name Cannot Be Changed After Step 2
**Precondition:** Step 2 completed with firstName="John", lastName="Doe"  
**Steps:**
1. Try to resubmit Step 2 with firstName="Jane"
2. Verify rejection

**Expected Result:**
- ✅ Rejected: "Step 2 already completed. Cannot resubmit"
- ✅ Name remains "John Doe"
- ✅ No fraud flag (attempted re-submission is allowed attempt)

---

### Test 9.2 - Location Cannot Be Changed After Step 5
**Precondition:** Step 5 completed with Nairobi coordinates  
**Steps:**
1. Try to resubmit Step 5 with Mombasa coordinates

**Expected Result:**
- ✅ Rejected: "Step 5 already completed. Cannot resubmit location"
- ✅ Location remains original
- ✅ No fraud flag for attempted change (they can't resubmit)

---

### Test 9.3 - Detect Duplicate Phone Attempts
**Precondition:** First fundi registered with phone +254712345678  
**Steps:**
1. Create second user account
2. Attempt Step 2 with same phone number

**Expected Result:**
- ✅ System checks for duplicate phone in fundi_profiles
- ✅ If found: Rejected with clear message
- ✅ Fraud flag logged with type='duplicate_phone'

---

### Test 9.4 - Document Resubmission with Different Name
**Precondition:** First attempt: submitted "John Doe" with ID 12345678  
**Steps:**
1. Fail OCR or reject for some reason
2. Create new attempt with same ID but name="Jane Doe"
3. Try to upload

**Expected Result:**
- ✅ Rejected: "ID number already used with different name"
- ✅ Fraud flag logged with type='name_change_attempt' severity='high'
- ✅ Admin alert triggered

---

### Test 9.5 - Multiple Registration Attempts Detection
**Precondition:** User attempts registration 3 times with different data  
**Steps:**
1. First attempt: John Doe, ID 11111111
2. Reject (document quality)
3. Second attempt: Jane Smith, ID 22222222
4. Reject (face mismatch)
5. Third attempt: Bob Jones, ID 33333333
6. Attempt to submit

**Expected Result:**
- ✅ System detects pattern of multiple attempts
- ✅ After 3 failed attempts, account flagged for review
- ✅ Admin notified with "Multiple registration attempts" alert
- ✅ User can still retry but under admin scrutiny

---

## 📊 SUBSCRIPTION ENFORCEMENT

### Test 10.1 - Cannot Accept Jobs Without Subscription
**Precondition:** Fundi verified but no subscription  
**Steps:**
1. Fundi verified and approved by admin
2. Fundi tries to accept a job
3. Check subscription_active = false

**Expected Result:**
- ✅ Job acceptance rejected with error: "Fundi subscription expired or inactive"
- ✅ Dashboard shows "Subscribe" call-to-action
- ✅ "Go Online" button disabled with reason: "Activate subscription"

**Assertion Code:**
```typescript
// Admin approves fundi
await approveFundi(fundiId);

// Fundi tries to accept job without subscription
const error = await apiClient.acceptJob(jobId);
expect(error.message).toContain('subscription');
```

---

### Test 10.2 - Expired Subscription Blocks Job Access
**Precondition:** Fundi has subscription that expired  
**Steps:**
1. Set `subscription_expires_at` to yesterday
2. Fundi tries to accept job
3. Check subscription validation logic

**Expected Result:**
- ✅ Job acceptance rejected
- ✅ Error: "Subscription expired. Please renew."
- ✅ Dashboard shows renewal prompt
- ✅ Fundi invisible in search results

**Assertion Code:**
```typescript
// Set subscription to expired
await database('fundi_profiles')
  .update({
    subscription_expires_at: new Date('2025-01-01')
  })
  .where('user_id', fundiId);

// Try to accept job
const error = await apiClient.acceptJob(jobId);
expect(error.message).toContain('subscription');
```

---

### Test 10.3 - Subscription Warning (Days Until Expiry)
**Precondition:** Subscription expiring in 5 days  
**Steps:**
1. Set `subscription_expires_at` to 5 days from now
2. GET `/api/fundi/dashboard/v2`
3. Check action items

**Expected Result:**
- ✅ Dashboard shows warning: "Your subscription expires in 5 days"
- ✅ "Renew now" button shown
- ✅ `warningDaysLeft: true`
- ✅ User can still work but knows to renew

**Assertion Code:**
```typescript
const dashboard = await apiClient.getFundiDashboardV2();
expect(dashboard.dashboard.subscription.daysUntilExpiry).toBe(5);
expect(dashboard.dashboard.subscription.warningDaysLeft).toBe(true);
```

---

### Test 10.4 - Cannot Go Online Without Subscription
**Precondition:** Fundi not subscribed  
**Steps:**
1. GET `/api/fundi/dashboard/v2`
2. Check `canGoOnline` flag

**Expected Result:**
- ✅ `canGoOnline: false`
- ✅ `reasonIfCannot: "Subscribe to go online"`
- ✅ UI disables "Go Online" button

---

## 🛡️ SECURITY TESTS

### Test 11.1 - Cannot Access Fundi APIs Without Authentication
**Precondition:** No JWT token  
**Steps:**
1. GET `/api/fundi/dashboard` without Authorization header
2. POST `/api/fundi/registration/step/2/personal-info` without token

**Expected Result:**
- ✅ Both rejected with 401 Unauthorized
- ✅ Error message: "No authorization token"
- ✅ No data leaked

---

### Test 11.2 - Cannot Access Another Fundi's Data
**Precondition:** Two fundis logged in  
**Steps:**
1. Fundi A gets dashboard
2. Fundi A tries to access Fundi B's profile directly

**Expected Result:**
- ✅ Dashboard only returns Fundi A's data
- ✅ Fundi A cannot see Fundi B's earnings/location/phone

---

### Test 11.3 - Fraud Logs Cannot Be Tampered
**Precondition:** Fraud log created  
**Steps:**
1. Fundi tries to DELETE or UPDATE fraud log directly
2. Fundi tries to ACCESS fraud logs via API

**Expected Result:**
- ✅ Fundi cannot access `/admin/*` endpoints
- ✅ Fraud logs are read-only
- ✅ Only admin can modify (with reason field)

---

### Test 11.4 - M-Pesa Number Masked in Responses
**Precondition:** M-Pesa number "+254712345678" submitted  
**Steps:**
1. GET `/api/fundi/registration/status`
2. Check mpesaNumber in response

**Expected Result:**
- ✅ mpesaNumber: "*****5678" (last 4 digits visible only)
- ✅ Full number never returned in responses
- ✅ Only used internally for withdrawal processing

---

## 📱 FUNDI DASHBOARD TESTS

### Test 12.1 - Dashboard Shows All Registration Steps
**Precondition:** Fundi in various stages of registration  
**Steps:**
1. Step 1: Dashboard shows step 2 required
2. Step 3: Dashboard shows step 4 (selfie) required
3. Step 7: Dashboard shows pending admin review

**Expected Result:**
- ✅ Dashboard always shows next required action
- ✅ "Complete X to proceed" messages
- ✅ Step indicators with checkmarks for completed

**Assertion Code:**
```typescript
const dashboard = await apiClient.getFundiDashboardV2();
expect(dashboard.dashboard.accountStatus.registrationStep).toBe(3);
expect(dashboard.dashboard.accountStatus.steps.step2_personalInfo.completed).toBe(true);
```

---

### Test 12.2 - "Go Online" Button Conditional States
**Precondition:** Various fundi states  
**Steps:**
1. Registration incomplete: "Go Online" disabled, reason: "Complete registration"
2. Verified but no subscription: "Go Online" disabled, reason: "Activate subscription"
3. All complete & subscribed: "Go Online" enabled, clickable
4. Subscription expired: "Go Online" disabled, reason: "Renew subscription"

**Expected Result:**
- ✅ Button state matches conditions
- ✅ Clear disabled reason always provided
- ✅ One-click action to fix issue (e.g., "Activate Subscription")

---

### Test 12.3 - Earnings Summary Displays
**Precondition:** Fundi completed 3 jobs (KES 1000, KES 1500, KES 2000)  
**Steps:**
1. GET `/api/fundi/dashboard/v2`
2. Check earnings section
3. Verify platform fee (15%) deducted

**Expected Result:**
- ✅ `totalBalance`: 3825 (sum of 85% of each)
- ✅ `completedJobs`: 3
- ✅ `activeJobs`: 0 or > 0 depending on current state
- ✅ Platform fee correctly calculated for each

---

## 🧪 EDGE CASES & BOUNDARY CONDITIONS

### Test 13.1 - Maximum Skills Selection
**Precondition:** User trying to select more than available  
**Steps:**
1. Frontend should limit to max skills available
2. Submit all 8 available skills

**Expected Result:**
- ✅ All 8 accepted (or configured max)
- ✅ No error on submission

---

### Test 13.2 - Very Long Name (>255 chars)
**Precondition:** User submits extremely long name  
**Steps:**
1. POST Step 2 with firstName = "A" * 300

**Expected Result:**
- ✅ Rejected with error: "Name too long (max 255 characters)"
- ✅ Database constraint enforced

---

### Test 13.3 - OCR on Non-English ID
**Precondition:** ID in Swahili or other language  
**Steps:**
1. Upload ID with non-English text
2. Run OCR

**Expected Result:**
- ✅ OCR extracts field values correctly (most OCR supports multiple languages)
- ✅ Comparison still works if ID structure clear
- ✅ If unreadable, rejected with: "Could not verify ID. Please submit clearer photo."

---

### Test 13.4 - Time Zone Handling
**Precondition:** Subscription expires at specific timestamp  
**Steps:**
1. Fundi in different timezone
2. Check subscription expiry countdown

**Expected Result:**
- ✅ Expiry calculated correctly regardless of timezone
- ✅ Time stored in UTC, displayed in local timezone
- ✅ Countdown accurate

---

## 📊 PERFORMANCE TESTS

### Test 14.1 - Dashboard Load Under Load
**Precondition:** Database with 1000+ fundis  
**Steps:**
1. GET `/api/fundi/dashboard/v2` while system handling traffic
2. Measure response time
3. Check database indexes

**Expected Result:**
- ✅ Response time < 200ms
- ✅ Proper indexes on `fundi_profiles(user_id)`, `fundi_locations(user_id)`, etc.
- ✅ No N+1 query problems

---

### Test 14.2 - OCR Processing Speed
**Precondition:** User uploads ID photo  
**Steps:**
1. Time OCR processing
2. Monitor CPU/memory

**Expected Result:**
- ✅ OCR completes in < 5 seconds
- ✅ Timeout set to 10 seconds for network issues
- ✅ User sees progress indicator

---

## ✅ FINAL VERIFICATION CHECKLIST

Before production deployment, verify:

- [ ] All 14 test categories execute successfully
- [ ] No SQL injection vulnerabilities (parameterized queries used)
- [ ] No sensitive data leaked in logs
- [ ] Fraud detection working (test with actual fraud attempts)
- [ ] Email notifications sent to admin
- [ ] Database migrations applied successfully
- [ ] No console.log statements in production code
- [ ] All error messages user-friendly
- [ ] Mobile-friendly forms for registration steps
- [ ] Camera permission handling graceful
- [ ] GPS permission handling graceful
- [ ] File upload security checked (file size, type, virus scan)
- [ ] Rate limiting on registration endpoints
- [ ] Session timeout (7 days for JWT)
- [ ] Logout invalidates token properly

---

**Test Plan Version:** 1.0  
**Last Updated:** February 5, 2026  
**Status:** 🟢 READY FOR EXECUTION
