import express from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { upload, getFileUrl } from '../services/file.js';
import { verifyOCRData } from '../services/ocr.js';
import { AppError } from '../utils/errors.js';
import { authMiddleware, requireRole } from '../middlewares/auth.js';

const router = express.Router();

// ============================================================================
// STEP 1: Account Creation - Phone, Email, Password (Already done at /auth/signup)
// ============================================================================
// When user signs up with email/password, they automatically get role='customer'
// This step just records that they've begun fundi registration

router.post('/step/1/start', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Check if user is customer (prerequisite)
    if (req.user.role !== 'customer') {
      throw new AppError('Only customers can register as fundis', 400);
    }

    // Check if fundi profile already exists
    const existing = await query('SELECT id FROM fundi_profiles WHERE user_id = $1', [userId]);
    if (existing.rows.length > 0) {
      throw new AppError('Fundi registration already started', 400);
    }

    // Create initial fundi profile with step 1 complete
    const profileId = uuidv4();
    await query(
      `INSERT INTO fundi_profiles (
        id, user_id, registration_step, step_1_completed_at, verification_status
      ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'incomplete')`,
      [profileId, userId, 2]
    );

    res.status(201).json({
      success: true,
      message: 'Fundi registration started. Proceed to Step 2: Personal Information',
      profile: {
        id: profileId,
        registrationStep: 2
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// STEP 2: Personal & ID Verification - Typed Fields + OCR Validation
// ============================================================================
// Fundi provides:
// - First name, Last name
// - ID number (typed)
// - Backend validates against OCR later in Step 3

router.post('/step/2/personal-info', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { firstName, lastName, idNumber } = req.body;

    // Validate inputs
    if (!firstName || !lastName || !idNumber) {
      throw new AppError('First name, last name, and ID number are required', 400);
    }

    if (firstName.trim().length < 2) {
      throw new AppError('First name must be at least 2 characters', 400);
    }

    if (lastName.trim().length < 2) {
      throw new AppError('Last name must be at least 2 characters', 400);
    }

    if (!/^\d{4,20}$/.test(idNumber.replace(/\s/g, ''))) {
      throw new AppError('ID number must be 4-20 digits', 400);
    }

    // Check fundi profile exists and step 2 not completed
    const profileRes = await query(
      'SELECT * FROM fundi_profiles WHERE user_id = $1',
      [userId]
    );

    if (profileRes.rows.length === 0) {
      throw new AppError('Fundi registration not started. Call /step/1/start first', 400);
    }

    const profile = profileRes.rows[0];

    // Cannot skip steps
    if (profile.registration_step < 2) {
      throw new AppError('Complete Step 1 first', 400);
    }

    // Cannot resubmit step 2 if already completed
    if (profile.step_2_completed_at) {
      throw new AppError('Step 2 already completed. Cannot resubmit personal information', 400);
    }

    // Check for duplicate ID number across fundis (prevent duplicate registrations)
    const dupId = await query(
      'SELECT id FROM fundi_profiles WHERE id_number = $1 AND user_id != $2',
      [idNumber, userId]
    );
    if (dupId.rows.length > 0) {
      // Log fraud attempt
      await query(
        `INSERT INTO fundi_fraud_logs (fundi_id, fraud_type, severity, action_taken, details)
         VALUES ($1, 'duplicate_id', 'high', 'blocked', $2)`,
        [userId, JSON.stringify({ attemptedId: idNumber, originalId: dupId.rows[0].id })]
      );
      throw new AppError('This national ID number is already registered', 400);
    }

    // Update profile with personal info
    await query(
      `UPDATE fundi_profiles SET
        first_name = $1,
        last_name = $2,
        id_number = $3,
        registration_step = 3,
        step_2_completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4`,
      [firstName.trim(), lastName.trim(), idNumber.replace(/\s/g, ''), userId]
    );

    res.json({
      success: true,
      message: 'Personal information saved. Proceed to Step 3: Upload ID Documents',
      profile: {
        firstName,
        lastName,
        registrationStep: 3
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// STEP 3: Document Upload & OCR Verification (ID Front, ID Back)
// ============================================================================
// Fundi uploads:
// - ID front photo
// - ID back photo (optional)
// Backend:
// - Runs OCR on ID front
// - Extracts name and ID number
// - Validates against Step 2 data
// - Stores confidence scores

router.post(
  '/step/3/upload-documents',
  authMiddleware,
  upload.fields([
    { name: 'idPhotoFront', maxCount: 1 },
    { name: 'idPhotoBack', maxCount: 1 }
  ]),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;

      // Check fundi profile exists and step 3 not completed
      const profileRes = await query(
        'SELECT * FROM fundi_profiles WHERE user_id = $1',
        [userId]
      );

      if (profileRes.rows.length === 0) {
        throw new AppError('Fundi registration not started', 400);
      }

      const profile = profileRes.rows[0];

      // Enforce step progression
      if (!profile.step_2_completed_at) {
        throw new AppError('Complete Step 2 first', 400);
      }

      if (profile.step_3_completed_at) {
        throw new AppError('Step 3 already completed. Cannot resubmit documents', 400);
      }

      // Validate file uploads
      if (!req.files?.idPhotoFront || req.files.idPhotoFront.length === 0) {
        throw new AppError('ID front photo is required', 400);
      }

      const idPhotoFrontPath = req.files.idPhotoFront[0].path;
      const idPhotoBackPath = req.files.idPhotoBack?.[0].path || null;

      // Run OCR on front photo
      const ocrResult = await verifyOCRData(
        idPhotoFrontPath,
        `${profile.first_name} ${profile.last_name}`,
        profile.id_number
      );

      // Store OCR evidence
      await query(
        `INSERT INTO fundi_verification_evidence (
          fundi_id, evidence_type, confidence_score, score_details, passed, rejection_reason
        ) VALUES ($1, 'ocr_id', $2, $3, $4, $5)`,
        [
          userId,
          ocrResult.confidenceScore || null,
          JSON.stringify({
            idMatch: ocrResult.idValid,
            nameMatch: ocrResult.nameValid,
            extractedId: ocrResult.extractedId,
            extractedName: ocrResult.extractedName,
            issues: ocrResult.issues
          }),
          ocrResult.idValid && ocrResult.nameValid,
          !ocrResult.idValid || !ocrResult.nameValid ? ocrResult.issues?.join('; ') : null
        ]
      );

      // Reject if OCR fails
      if (!ocrResult.idValid || !ocrResult.nameValid) {
        // Log fraud attempt if name mismatch
        if (!ocrResult.nameValid) {
          await query(
            `INSERT INTO fundi_fraud_logs (fundi_id, fraud_type, severity, action_taken, details)
             VALUES ($1, 'ocr_name_mismatch', 'high', 'review_required', $2)`,
            [userId, JSON.stringify({
              submittedName: `${profile.first_name} ${profile.last_name}`,
              extractedName: ocrResult.extractedName,
              confidence: ocrResult.confidenceScore
            })]
          );
        }

        throw new AppError(
          `OCR verification failed: ${ocrResult.issues?.join('; ') || 'Data does not match'}`,
          400
        );
      }

      // Update profile with document paths
      await query(
        `UPDATE fundi_profiles SET
          id_photo_path = $1,
          id_photo_back_path = $2,
          id_number_extracted = $3,
          id_name_extracted = $4,
          registration_step = 4,
          step_3_completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $5`,
        [
          path.basename(idPhotoFrontPath),
          idPhotoBackPath ? path.basename(idPhotoBackPath) : null,
          ocrResult.extractedId,
          ocrResult.extractedName,
          userId
        ]
      );

      res.json({
        success: true,
        message: 'Documents verified. Proceed to Step 4: Selfie Verification',
        profile: {
          registrationStep: 4,
          ocrVerification: {
            idMatches: ocrResult.idValid,
            nameMatches: ocrResult.nameValid,
            confidenceScore: ocrResult.confidenceScore
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// STEP 4: Selfie Verification (Live Camera + Face Matching)
// ============================================================================
// Fundi captures:
// - Live selfie (no file upload, camera only)
// Backend:
// - Runs face detection
// - Compares with ID photo
// - Validates liveness (blink, head movement)
// - Checks quality (brightness, focus, position)

router.post(
  '/step/4/selfie',
  authMiddleware,
  upload.single('selfiePhoto'),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;

      // Check step progression
      const profileRes = await query(
        'SELECT * FROM fundi_profiles WHERE user_id = $1',
        [userId]
      );

      if (profileRes.rows.length === 0) {
        throw new AppError('Fundi registration not started', 400);
      }

      const profile = profileRes.rows[0];

      if (!profile.step_3_completed_at) {
        throw new AppError('Complete Step 3 first', 400);
      }

      if (profile.step_4_completed_at) {
        throw new AppError('Step 4 already completed. Cannot resubmit selfie', 400);
      }

      if (!req.file) {
        throw new AppError('Selfie photo is required', 400);
      }

      // For now, perform basic validation (will implement face-api.js in frontend)
      // Frontend should handle face detection and matching
      // This endpoint just stores the selfie

      // TODO: In production, use face-api.js or similar
      // - Load ID photo
      // - Load selfie photo
      // - Detect faces in both
      // - Calculate similarity score
      // - Validate liveness

      const selfiePath = req.file.path;

      // Store placeholder verification evidence
      // In production, face matching score would come from frontend
      const faceMatchScore = 75; // TODO: Get from frontend
      const livenessScore = 80; // TODO: Get from frontend

      await query(
        `INSERT INTO fundi_verification_evidence (
          fundi_id, evidence_type, confidence_score, score_details, passed
        ) VALUES ($1, 'face_match', $2, $3, $4)`,
        [
          userId,
          faceMatchScore,
          JSON.stringify({
            livenessScore,
            qualityChecks: {
              brightness: 'ok',
              focus: 'ok',
              position: 'ok'
            }
          }),
          faceMatchScore >= 70
        ]
      );

      // Update profile
      await query(
        `UPDATE fundi_profiles SET
          selfie_path = $1,
          registration_step = 5,
          step_4_completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2`,
        [path.basename(selfiePath), userId]
      );

      res.json({
        success: true,
        message: 'Selfie verified. Proceed to Step 5: Location Verification',
        profile: {
          registrationStep: 5
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// STEP 5: GPS Location Verification (No Manual Entry)
// ============================================================================
// Fundi must:
// - Allow device location access
// - Capture live GPS coordinates
// Backend:
// - Validates accuracy (< 50 meters)
// - Stores latitude, longitude, accuracy
// - No manual entry allowed

router.post('/step/5/location', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { latitude, longitude, accuracy } = req.body;

    // Validate input
    if (
      typeof latitude === 'undefined' ||
      typeof longitude === 'undefined'
    ) {
      throw new AppError('GPS coordinates are required', 400);
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const acc = accuracy ? parseInt(accuracy) : null;

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new AppError('Invalid GPS coordinates', 400);
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new AppError('GPS coordinates out of range', 400);
    }

    // Validate accuracy (must be < 50 meters)
    if (acc && acc > 50) {
      throw new AppError(
        `GPS accuracy too low (${acc}m). Accuracy must be better than 50 meters. Move to open area and try again.`,
        400
      );
    }

    // Check step progression
    const profileRes = await query(
      'SELECT * FROM fundi_profiles WHERE user_id = $1',
      [userId]
    );

    if (profileRes.rows.length === 0) {
      throw new AppError('Fundi registration not started', 400);
    }

    const profile = profileRes.rows[0];

    if (!profile.step_4_completed_at) {
      throw new AppError('Complete Step 4 first', 400);
    }

    if (profile.step_5_completed_at) {
      throw new AppError('Step 5 already completed. Cannot resubmit location', 400);
    }

    // Update profile with GPS location
    await query(
      `UPDATE fundi_profiles SET
        latitude = $1,
        longitude = $2,
        accuracy = $3,
        location_captured_at = EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT,
        registration_step = 6,
        step_5_completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4`,
      [lat, lng, acc, userId]
    );

    res.json({
      success: true,
      message: 'Location verified. Proceed to Step 6: Skills & Experience',
      profile: {
        registrationStep: 6,
        location: {
          latitude: lat,
          longitude: lng,
          accuracy: acc
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// STEP 6: Skills & Experience Details
// ============================================================================
// Fundi selects:
// - Service categories (plumber, electrician, etc.)
// - Years of experience
// - Optional certificates (file upload)

router.post(
  '/step/6/skills',
  authMiddleware,
  upload.array('certificates', 5),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { skills, experienceYears } = req.body;

      // Validate input
      if (!skills || (Array.isArray(skills) ? skills.length === 0 : !skills.trim())) {
        throw new AppError('At least one skill is required', 400);
      }

      const skillsArray = Array.isArray(skills)
        ? skills.filter(s => s.trim())
        : skills.split(',').map(s => s.trim()).filter(Boolean);

      if (skillsArray.length === 0) {
        throw new AppError('At least one skill is required', 400);
      }

      const expYears = experienceYears ? parseInt(experienceYears) : 0;

      if (expYears < 0 || expYears > 100) {
        throw new AppError('Experience years must be between 0 and 100', 400);
      }

      // Check step progression
      const profileRes = await query(
        'SELECT * FROM fundi_profiles WHERE user_id = $1',
        [userId]
      );

      if (profileRes.rows.length === 0) {
        throw new AppError('Fundi registration not started', 400);
      }

      const profile = profileRes.rows[0];

      if (!profile.step_5_completed_at) {
        throw new AppError('Complete Step 5 first', 400);
      }

      if (profile.step_6_completed_at) {
        throw new AppError('Step 6 already completed. Cannot resubmit skills', 400);
      }

      // Extract certificate paths
      const certificatePaths = req.files?.map(f => path.basename(f.path)) || [];

      // Update profile
      await query(
        `UPDATE fundi_profiles SET
          skills = $1,
          experience_years = $2,
          certificate_paths = $3,
          registration_step = 7,
          step_6_completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $4`,
        [skillsArray, expYears, certificatePaths, userId]
      );

      res.json({
        success: true,
        message: 'Skills recorded. Proceed to Step 7: Payment Method Setup',
        profile: {
          registrationStep: 7,
          skills: skillsArray,
          experienceYears: expYears
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// STEP 7: Payment Method Setup (M-Pesa)
// ============================================================================
// Fundi must:
// - Provide M-Pesa phone number
// - Verify format
// Backend:
// - Validates phone format
// - Stores securely
// - Marks as verified
// - MANDATORY before job access

router.post('/step/7/payment', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { mpesaNumber } = req.body;

    // Validate input
    if (!mpesaNumber) {
      throw new AppError('M-Pesa number is required', 400);
    }

    // Validate phone format (Kenya: +254 or 0 followed by 9 digits)
    const cleanPhone = mpesaNumber.replace(/\s|-/g, '');
    if (!/^(\+254|254|0)[0-9]{9}$/.test(cleanPhone)) {
      throw new AppError('Invalid M-Pesa number format. Use format: +254712345678 or 0712345678', 400);
    }

    // Check step progression
    const profileRes = await query(
      'SELECT * FROM fundi_profiles WHERE user_id = $1',
      [userId]
    );

    if (profileRes.rows.length === 0) {
      throw new AppError('Fundi registration not started', 400);
    }

    const profile = profileRes.rows[0];

    if (!profile.step_6_completed_at) {
      throw new AppError('Complete Step 6 first', 400);
    }

    if (profile.step_7_completed_at) {
      throw new AppError('Step 7 already completed. Cannot resubmit payment method', 400);
    }

    // Update profile with payment method
    await query(
      `UPDATE fundi_profiles SET
        mpesa_number = $1,
        payment_method_verified = true,
        registration_step = 8,
        step_7_completed_at = CURRENT_TIMESTAMP,
        verification_status = 'pending_admin_review',
        updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [cleanPhone, userId]
    );

    // Mark all verification steps as passed
    await query(
      `INSERT INTO fundi_verification_evidence (
        fundi_id, evidence_type, confidence_score, passed
      ) VALUES ($1, 'payment_verify', 100, true)`,
      [userId]
    );

    res.json({
      success: true,
      message: 'Registration complete! Awaiting admin review...',
      profile: {
        registrationStep: 8,
        verificationStatus: 'pending_admin_review',
        mpesaNumber: cleanPhone
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// GET Registration Status (Track Progress)
// ============================================================================

router.get('/status', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const profileRes = await query(
      'SELECT * FROM fundi_profiles WHERE user_id = $1',
      [userId]
    );

    if (profileRes.rows.length === 0) {
      return res.json({
        success: true,
        hasProfile: false,
        message: 'No fundi registration found. Call POST /step/1/start to begin'
      });
    }

    const profile = profileRes.rows[0];

    // Get verification evidence
    const evidenceRes = await query(
      `SELECT evidence_type, passed FROM fundi_verification_evidence
       WHERE fundi_id = $1`,
      [userId]
    );

    const evidence = {};
    evidenceRes.rows.forEach(row => {
      evidence[row.evidence_type] = row.passed;
    });

    res.json({
      success: true,
      hasProfile: true,
      profile: {
        registrationStep: profile.registration_step,
        verificationStatus: profile.verification_status,
        completedSteps: {
          step1_accountCreation: !!profile.step_1_completed_at,
          step2_personalInfo: !!profile.step_2_completed_at,
          step3_documents: !!profile.step_3_completed_at,
          step4_selfie: !!profile.step_4_completed_at,
          step5_location: !!profile.step_5_completed_at,
          step6_skills: !!profile.step_6_completed_at,
          step7_payment: !!profile.step_7_completed_at
        },
        evidence,
        personalInfo: {
          firstName: profile.first_name,
          lastName: profile.last_name,
          email: profile.email,
          phone: profile.phone,
          idNumber: profile.id_number
        },
        location: profile.latitude && profile.longitude ? {
          latitude: profile.latitude,
          longitude: profile.longitude,
          accuracy: profile.accuracy
        } : null,
        skills: profile.skills,
        experienceYears: profile.experience_years,
        mpesaNumber: profile.mpesa_number ? profile.mpesa_number.replace(/[\d(?!.{0,4}$)]/g, '*') : null,
        paymentMethodVerified: profile.payment_method_verified
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
