import express from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query, getClient } from '../db.js';
import { upload, getFileUrl } from '../services/file.js';
import { verifyOCRData } from '../services/ocr.js';
import { AppError } from '../utils/errors.js';
import { authMiddleware, requireRole } from '../middlewares/auth.js';
import { sendMail } from '../services/mailer.js';
import fs from 'fs';

const router = express.Router();

/**
 * Submit fundi registration
 */
router.post('/register', authMiddleware, upload.fields([
  { name: 'idPhoto', maxCount: 1 },
  { name: 'idPhotoBack', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
  { name: 'certificates', maxCount: 5 }
]), async (req, res, next) => {
  try {
    // Debug: log incoming body and file keys to help diagnose multipart issues
    console.log('Fundi register body keys:', Object.keys(req.body || {}));
    console.log('Fundi register files keys:', req.files ? Object.keys(req.files) : []);

    const {
      firstName, lastName, email, phone,
      idNumber,
      latitude, longitude, accuracy, altitude,
      locationAddress, locationArea, locationCity,
      skills, experienceYears, mpesaNumber
    } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !phone || !idNumber) {
      throw new AppError('Missing required personal information', 400);
    }

    if (!latitude || !longitude) {
      throw new AppError('GPS coordinates are required', 400);
    }

    if (!req.files?.idPhoto || !req.files?.selfie) {
      throw new AppError('ID photo and selfie are required', 400);
    }

    // Check if fundi already registered for this user
    const existing = await query('SELECT id FROM fundi_profiles WHERE user_id = $1', [req.user.userId]);
    if (existing.rows.length > 0) {
      throw new AppError('Fundi already registered', 400);
    }

    // Prevent duplicate ID number or phone across fundi_profiles
    const dupId = await query('SELECT id FROM fundi_profiles WHERE id_number = $1', [idNumber]);
    if (dupId.rows.length > 0) {
      throw new AppError('This national ID number is already registered', 400);
    }

    const dupPhone = await query('SELECT id FROM fundi_profiles WHERE phone = $1', [phone]);
    if (dupPhone.rows.length > 0) {
      throw new AppError('This phone number is already registered for a fundi', 400);
    }

    // Verify OCR data
    const idPhotoPath = req.files.idPhoto[0].path;
    const ocrResult = await verifyOCRData(
      idPhotoPath,
      `${firstName} ${lastName}`,
      idNumber
    );

    // OCR verification
    let idNumberExtracted = null;
    let idNameExtracted = null;

    if (ocrResult.extractedId) idNumberExtracted = ocrResult.extractedId;
    if (ocrResult.extractedName) idNameExtracted = ocrResult.extractedName;

    // Reject if OCR clearly mismatches beyond tolerance
    if (!ocrResult.idValid || !ocrResult.nameValid) {
      throw new AppError('OCR verification failed: extracted data does not match submitted data', 400);
    }

    // Parse skills
    const skillsArray = typeof skills === 'string'
      ? skills.split(',').map(s => s.trim()).filter(Boolean)
      : Array.isArray(skills) ? skills : [];

    // Create registration
    const registrationId = uuidv4();
    const locationCapturedAt = Date.now();

    const result = await query(
      `INSERT INTO fundi_profiles (
        id, user_id, first_name, last_name, email, phone,
        id_number, id_number_extracted, id_name_extracted,
        id_photo_path, id_photo_back_path, selfie_path,
        latitude, longitude, accuracy, altitude,
        location_address, location_area, location_city, location_captured_at,
        skills, experience_years, mpesa_number,
        verification_status
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20,
        $21, $22, $23,
        'pending'
      )
      RETURNING *`,
      [
        registrationId, req.user.userId,
        firstName, lastName, email, phone,
        idNumber, idNumberExtracted, idNameExtracted,
        path.basename(req.files.idPhoto[0].path),
        req.files.idPhotoBack?.[0].path ? path.basename(req.files.idPhotoBack[0].path) : null,
        path.basename(req.files.selfie[0].path),
        parseFloat(latitude), parseFloat(longitude),
        accuracy ? parseInt(accuracy) : null,
        altitude ? parseFloat(altitude) : null,
        locationAddress, locationArea, locationCity, locationCapturedAt,
        skillsArray, experienceYears ? parseInt(experienceYears) : 0,
        mpesaNumber || null
      ]
    );

    const registration = result.rows[0];

    // Do NOT update user role here. User becomes a fundi only after admin approval.

    // Send notification to admin to review this registration
    try {
      const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'emmanuelevian@gmail.com';
      const subject = 'New fundi verification submitted';
      const text = `A new fundi registration has been submitted by ${firstName} ${lastName} (email: ${email}, phone: ${phone}). Please review in the admin dashboard.`;
      const html = `<p>A new fundi registration has been submitted by <strong>${firstName} ${lastName}</strong> (email: ${email}, phone: ${phone}).</p><p><a href="/admin/fundis">Open Admin Pending Fundis</a></p>`;
      await sendMail(ADMIN_EMAIL, subject, text, html);
    } catch (err) {
      console.error('Failed to send fundi submission notification to admin:', err.message);
    }

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully',
      registration: {
        id: registration.id,
        firstName: registration.first_name,
        lastName: registration.last_name,
        email: registration.email,
        phone: registration.phone,
        verificationStatus: registration.verification_status,
        ocrVerification: {
          idMatches: ocrResult.idValid,
          nameMatches: ocrResult.nameValid,
          extractedId: ocrResult.extractedId,
          extractedName: ocrResult.extractedName,
          issues: ocrResult.issues
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get fundi profile
 */
router.get('/profile', authMiddleware, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM fundi_profiles WHERE user_id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Fundi profile not found', 404);
    }

    const profile = result.rows[0];

    res.json({
      success: true,
      profile: {
        id: profile.id,
        firstName: profile.first_name,
        lastName: profile.last_name,
        email: profile.email,
        phone: profile.phone,
        idNumber: profile.id_number,
        idNumberExtracted: profile.id_number_extracted,
        idNameExtracted: profile.id_name_extracted,
        idPhotoUrl: getFileUrl(profile.id_photo_path),
        idPhotoBackUrl: getFileUrl(profile.id_photo_back_path),
        selfieUrl: getFileUrl(profile.selfie_path),
        certificateUrls: profile.certificate_paths?.map(p => getFileUrl(p)) || [],
        latitude: profile.latitude,
        longitude: profile.longitude,
        accuracy: profile.accuracy,
        altitude: profile.altitude,
        locationAddress: profile.location_address,
        locationArea: profile.location_area,
        locationCity: profile.location_city,
        skills: profile.skills,
        experienceYears: profile.experience_years,
        mpesaNumber: profile.mpesa_number,
        verificationStatus: profile.verification_status,
        verificationNotes: profile.verification_notes,
        subscriptionActive: profile.subscription_active,
        subscriptionExpiresAt: profile.subscription_expires_at,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Fundi dashboard
 */
router.get('/dashboard', authMiddleware, requireRole('fundi'), async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Fundi profile
    const profileRes = await query('SELECT * FROM fundi_profiles WHERE user_id = $1', [userId]);
    if (profileRes.rows.length === 0) {
      throw new AppError('Fundi profile not found', 404);
    }
    const profile = profileRes.rows[0];

    // Wallet balance
    const walletRes = await query('SELECT balance FROM fundi_wallets WHERE user_id = $1', [userId]);
    const walletBalance = walletRes.rows.length > 0 ? parseFloat(walletRes.rows[0].balance) : 0.00;

    // Job stats
    const newRequestsRes = await query('SELECT COUNT(*) as count FROM job_bids WHERE fundi_id = $1 AND status = $2', [userId, 'pending']);
    const activeJobsRes = await query("SELECT COUNT(*) as count FROM jobs WHERE fundi_id = $1 AND status IN ('accepted','on_the_way','in_progress')", [userId]);
    const completedJobsRes = await query("SELECT COUNT(*) as count FROM jobs WHERE fundi_id = $1 AND status = 'completed'", [userId]);

    const newRequests = parseInt(newRequestsRes.rows[0].count) || 0;
    const activeJobs = parseInt(activeJobsRes.rows[0].count) || 0;
    const completedJobs = parseInt(completedJobsRes.rows[0].count) || 0;

    // Ratings & reviews summary
    const ratingsRes = await query('SELECT COALESCE(AVG(rating),0) as avg_rating, COUNT(*) as total_reviews FROM reviews WHERE reviewee_id = $1', [userId]);
    const avgRating = parseFloat(parseFloat(ratingsRes.rows[0].avg_rating).toFixed(2)) || 0;
    const totalReviews = parseInt(ratingsRes.rows[0].total_reviews) || 0;

    // Profile completion percent (basic heuristic)
    let completion = 0;
    const checks = [
      !!profile.first_name,
      !!profile.last_name,
      !!profile.email,
      !!profile.phone,
      !!profile.id_number,
      !!profile.id_photo_path,
      !!profile.selfie_path,
      (profile.skills && profile.skills.length > 0),
      profile.experience_years > 0
    ];
    const trueCount = checks.filter(Boolean).length;
    completion = Math.round((trueCount / checks.length) * 100);

    res.json({
      success: true,
      dashboard: {
        verificationStatus: profile.verification_status,
        profileCompletion: completion,
        online: null, // client should query /location or realtime
        walletBalance,
        jobStats: {
          newRequests,
          activeJobs,
          completedJobs
        },
        ratings: {
          average: avgRating,
          total: totalReviews
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Enhanced Fundi Dashboard (with registration steps, subscription, and action items)
 */
router.get('/dashboard/v2', authMiddleware, requireRole('fundi'), async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Fundi profile
    const profileRes = await query('SELECT * FROM fundi_profiles WHERE user_id = $1', [userId]);
    if (profileRes.rows.length === 0) {
      throw new AppError('Fundi profile not found', 404);
    }
    const profile = profileRes.rows[0];

    // Online status
    const locationRes = await query('SELECT * FROM fundi_locations WHERE user_id = $1', [userId]);
    const online = locationRes.rows.length > 0 && locationRes.rows[0].online;

    // Subscription status
    const now = new Date();
    const expiresAt = profile.subscription_expires_at ? new Date(profile.subscription_expires_at) : null;
    const subscriptionActive = profile.subscription_active && (!expiresAt || expiresAt > now);
    const daysUntilExpiry = expiresAt ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)) : null;

    // Registration steps
    const registrationSteps = {
      step1_accountCreation: {
        name: 'Account Created',
        completed: !!profile.step_1_completed_at,
        completedAt: profile.step_1_completed_at
      },
      step2_personalInfo: {
        name: 'Personal Information',
        completed: !!profile.step_2_completed_at,
        completedAt: profile.step_2_completed_at
      },
      step3_documents: {
        name: 'ID Documents',
        completed: !!profile.step_3_completed_at,
        completedAt: profile.step_3_completed_at
      },
      step4_selfie: {
        name: 'Selfie Verification',
        completed: !!profile.step_4_completed_at,
        completedAt: profile.step_4_completed_at
      },
      step5_location: {
        name: 'GPS Location',
        completed: !!profile.step_5_completed_at,
        completedAt: profile.step_5_completed_at
      },
      step6_skills: {
        name: 'Skills & Experience',
        completed: !!profile.step_6_completed_at,
        completedAt: profile.step_6_completed_at
      },
      step7_payment: {
        name: 'Payment Method',
        completed: !!profile.step_7_completed_at,
        completedAt: profile.step_7_completed_at
      }
    };

    const allStepsComplete = Object.values(registrationSteps).every(s => s.completed);

    // Wallet balance
    const walletRes = await query('SELECT balance FROM fundi_wallets WHERE user_id = $1', [userId]);
    const walletBalance = walletRes.rows.length > 0 ? parseFloat(walletRes.rows[0].balance) : 0;

    // Job stats
    const activeJobsRes = await query(
      "SELECT COUNT(*) as count FROM jobs WHERE fundi_id = $1 AND status IN ('accepted','on_the_way','in_progress')",
      [userId]
    );
    const completedJobsRes = await query(
      "SELECT COUNT(*) as count FROM jobs WHERE fundi_id = $1 AND status = 'completed'",
      [userId]
    );

    // Pending job requests
    const pendingRequestsRes = await query(
      'SELECT COUNT(*) as count FROM job_requests WHERE fundi_id = $1 AND status = $2',
      [userId, 'sent']
    );

    // Fraud flags
    const fraudRes = await query(
      'SELECT fraud_type, severity, action_taken FROM fundi_fraud_logs WHERE fundi_id = $1 ORDER BY created_at DESC LIMIT 5',
      [userId]
    );

    // Action items (things fundi needs to do)
    const actionItems = [];

    if (!allStepsComplete) {
      const nextIncompleteStep = Object.entries(registrationSteps).find(
        ([, step]) => !step.completed
      );
      if (nextIncompleteStep) {
        actionItems.push({
          type: 'complete_registration',
          priority: 'high',
          message: `Complete ${nextIncompleteStep[1].name} to activate your account`,
          step: parseInt(nextIncompleteStep[0].match(/\d+/)[0])
        });
      }
    }

    if (allStepsComplete && profile.verification_status === 'pending_admin_review') {
      actionItems.push({
        type: 'pending_admin_review',
        priority: 'medium',
        message: 'Your registration is under admin review. You\'ll be notified when approved.'
      });
    }

    if (allStepsComplete && profile.verification_status === 'verified' && !subscriptionActive) {
      actionItems.push({
        type: 'activate_subscription',
        priority: 'high',
        message: 'Subscribe to become visible to customers and receive job requests',
        plans: {
          monthly: 'KES 199/month',
          quarterly: 'KES 499/3 months',
          yearly: 'KES 1,499/year'
        }
      });
    }

    if (subscriptionActive && daysUntilExpiry && daysUntilExpiry <= 7) {
      actionItems.push({
        type: 'renew_subscription',
        priority: 'high',
        message: `Your subscription expires in ${daysUntilExpiry} days. Renew now to stay active.`
      });
    }

    if (fraudRes.rows.length > 0) {
      actionItems.push({
        type: 'fraud_alert',
        priority: 'critical',
        message: 'Your account has flagged activity. Please contact admin.',
        flags: fraudRes.rows.slice(0, 3)
      });
    }

    res.json({
      success: true,
      dashboard: {
        accountStatus: {
          verificationStatus: profile.verification_status,
          allStepsComplete,
          registrationStep: profile.registration_step,
          steps: registrationSteps
        },
        subscription: {
          active: subscriptionActive,
          expiresAt: expiresAt?.toISOString(),
          daysUntilExpiry,
          warningDaysLeft: daysUntilExpiry && daysUntilExpiry <= 7
        },
        availability: {
          online,
          canGoOnline: allStepsComplete && profile.verification_status === 'verified' && subscriptionActive,
          reasonIfCannot:
            !allStepsComplete ? 'Complete registration first' :
            profile.verification_status !== 'verified' ? 'Awaiting admin verification' :
            !subscriptionActive ? 'Subscribe to go online' : null
        },
        paymentMethod: {
          mpesaNumber: profile.mpesa_number ? profile.mpesa_number.replace(/[\d(?!.{0,4}$)]/g, '*') : null,
          verified: profile.payment_method_verified
        },
        earnings: {
          totalBalance: walletBalance,
          activeJobs: parseInt(activeJobsRes.rows[0].count) || 0,
          completedJobs: parseInt(completedJobsRes.rows[0].count) || 0,
          pendingRequests: parseInt(pendingRequestsRes.rows[0].count) || 0
        },
        actionItems
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get wallet transactions
 */
router.get('/wallet/transactions', authMiddleware, requireRole('fundi'), async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT id, amount, type, source, job_id, description, created_at
       FROM fundi_wallet_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countRes = await query('SELECT COUNT(*) as count FROM fundi_wallet_transactions WHERE user_id = $1', [userId]);
    const total = parseInt(countRes.rows[0].count) || 0;

    res.json({ success: true, transactions: result.rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
});

/**
 * Request withdrawal (M-Pesa ready)
 */
router.post('/wallet/withdraw-request', authMiddleware, requireRole('fundi'), async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { amount, mpesaNumber } = req.body;
    if (!amount || parseFloat(amount) <= 0) throw new AppError('Amount must be greater than zero', 400);

    // Get wallet balance
    const walletRes = await query('SELECT balance FROM fundi_wallets WHERE user_id = $1', [userId]);
    const balance = walletRes.rows.length > 0 ? parseFloat(walletRes.rows[0].balance) : 0;
    const requested = parseFloat(amount);
    if (requested > balance) throw new AppError('Insufficient balance', 400);

    // Use provided mpesa number or profile
    const profileRes = await query('SELECT mpesa_number FROM fundi_profiles WHERE user_id = $1', [userId]);
    const mpesa = mpesaNumber || (profileRes.rows.length > 0 ? profileRes.rows[0].mpesa_number : null);
    if (!mpesa) throw new AppError('M-Pesa number is required for withdrawal', 400);

    // Create withdrawal request and deduct balance atomically
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const insert = await client.query(
        `INSERT INTO fundi_withdrawals (user_id, amount, mpesa_number, status, created_at)
         VALUES ($1, $2, $3, 'requested', NOW()) RETURNING *`,
        [userId, requested, mpesa]
      );

      await client.query(
        `UPDATE fundi_wallets SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2`,
        [requested, userId]
      );

      await client.query(
        `INSERT INTO fundi_wallet_transactions (user_id, amount, type, source, description, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [userId, -Math.abs(requested), 'debit', 'withdrawal', `Withdrawal request ${insert.rows[0].id}`]
      );

      await client.query('COMMIT');
      res.json({ success: true, withdrawal: insert.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Get fundi ratings and recent reviews
 */
router.get('/ratings', authMiddleware, requireRole('fundi'), async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const recent = await query(
      `SELECT r.rating, r.comment, r.created_at, u.full_name as reviewer_name
       FROM reviews r
       JOIN users u ON u.id = r.reviewer_id
       WHERE r.reviewee_id = $1
       ORDER BY r.created_at DESC
       LIMIT 20`,
      [userId]
    );

    const summary = await query('SELECT COALESCE(AVG(rating),0) as avg_rating, COUNT(*) as total_reviews FROM reviews WHERE reviewee_id = $1', [userId]);

    res.json({ success: true, ratings: { average: parseFloat(parseFloat(summary.rows[0].avg_rating).toFixed(2)), total: parseInt(summary.rows[0].total_reviews) || 0, recent: recent.rows } });
  } catch (error) {
    next(error);
  }
});

/**
 * Update fundi profile
 */
router.put('/profile', authMiddleware, async (req, res, next) => {
  try {
    const { skills, experienceYears, mpesaNumber, locationCity } = req.body;

    const result = await query(
      `UPDATE fundi_profiles 
       SET skills = COALESCE($1, skills),
           experience_years = COALESCE($2, experience_years),
           mpesa_number = COALESCE($3, mpesa_number),
           location_city = COALESCE($4, location_city),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $5
       RETURNING *`,
      [
        skills ? JSON.stringify(skills) : null,
        experienceYears,
        mpesaNumber,
        locationCity,
        req.user.userId
      ]
    );

    if (result.rows.length === 0) {
      throw new AppError('Fundi profile not found', 404);
    }

    const profile = result.rows[0];

    res.json({
      success: true,
      profile: {
        id: profile.id,
        firstName: profile.first_name,
        lastName: profile.last_name,
        skills: profile.skills,
        experienceYears: profile.experience_years,
        mpesaNumber: profile.mpesa_number,
        locationCity: profile.location_city
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Set fundi Online (start location tracking) — fundi only
 */
router.post('/status/online', authMiddleware, requireRole('fundi'), async (req, res, next) => {
  try {
    const { latitude, longitude, accuracy } = req.body;
    if (typeof latitude === 'undefined' || typeof longitude === 'undefined') {
      throw new AppError('Latitude and longitude are required', 400);
    }

    // CRITICAL: Check fundi is approved before allowing online status
    const fundiCheck = await query(
      'SELECT verification_status FROM fundi_profiles WHERE user_id = $1',
      [req.user.userId]
    );

    if (fundiCheck.rows.length === 0 || fundiCheck.rows[0].verification_status !== 'approved') {
      throw new AppError('Your account must be approved before going online. Please wait for admin verification.', 403);
    }

    const acc = accuracy ? parseInt(accuracy) : null;
    // Block submission if GPS accuracy poor (> 150 meters)
    if (acc !== null && acc > 150) {
      throw new AppError('GPS accuracy is poor; please move to an open area and retry', 400);
    }

    // Ensure fundi_profiles exists for user
    const upsert = await query(
      `INSERT INTO fundi_locations (user_id, latitude, longitude, accuracy, online, updated_at)
       VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         accuracy = EXCLUDED.accuracy,
         online = true,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.user.userId, parseFloat(latitude), parseFloat(longitude), acc]
    );

    res.json({ success: true, message: 'Online', location: upsert.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * Set fundi Offline (stop tracking)
 */
router.post('/status/offline', authMiddleware, requireRole('fundi'), async (req, res, next) => {
  try {
    await query(
      `INSERT INTO fundi_locations (user_id, online, updated_at)
       VALUES ($1, false, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET online = false, updated_at = CURRENT_TIMESTAMP`,
      [req.user.userId]
    );

    res.json({ success: true, message: 'Offline' });
  } catch (error) {
    next(error);
  }
});

/**
 * Update location while online (fundi only)
 */
router.post('/location', authMiddleware, requireRole('fundi'), async (req, res, next) => {
  try {
    const { latitude, longitude, accuracy } = req.body;
    if (typeof latitude === 'undefined' || typeof longitude === 'undefined') {
      throw new AppError('Latitude and longitude are required', 400);
    }

    const acc = accuracy ? parseInt(accuracy) : null;
    if (acc !== null && acc > 500) {
      throw new AppError('GPS accuracy is poor; please recapture', 400);
    }

    const result = await query(
      `INSERT INTO fundi_locations (user_id, latitude, longitude, accuracy, online, updated_at)
       VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         accuracy = EXCLUDED.accuracy,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.user.userId, parseFloat(latitude), parseFloat(longitude), acc]
    );

    res.json({ success: true, location: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * Get fundi by ID (public, for matching)
 */
router.get('/:fundiId', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT fp.*, u.email
       FROM fundi_profiles fp
       JOIN users u ON u.id = fp.user_id
       WHERE fp.user_id = $1 AND fp.verification_status = 'approved'`,
      [req.params.fundiId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Fundi not found or not verified', 404);
    }

    const profile = result.rows[0];

    res.json({
      success: true,
      fundi: {
        id: profile.user_id,
        firstName: profile.first_name,
        lastName: profile.last_name,
        email: profile.email,
        phone: profile.phone,
        latitude: profile.latitude,
        longitude: profile.longitude,
        skills: profile.skills,
        experienceYears: profile.experience_years,
        locationCity: profile.location_city
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Search fundis by location and skills
 */
router.get('/search', async (req, res, next) => {
  try {
    const { latitude, longitude, skill, radius = 50 } = req.query;

    if (!latitude || !longitude) {
      throw new AppError('Latitude and longitude are required', 400);
    }

    let sqlQuery = `
      SELECT fp.*, u.email,
        (6371 * acos(
          cos(radians($1)) * cos(radians(fp.latitude)) *
          cos(radians(fp.longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(fp.latitude))
        )) AS distance
      FROM fundi_profiles fp
      JOIN users u ON u.id = fp.user_id
      WHERE fp.verification_status = 'approved'
        AND fp.subscription_active = true
    `;

    const params = [parseFloat(latitude), parseFloat(longitude)];

    if (skill) {
      sqlQuery += ` AND $3 = ANY(fp.skills)`;
      params.push(skill);
    }

    sqlQuery += ` HAVING distance <= $${params.length + 1}
                 ORDER BY distance ASC
                 LIMIT 20`;
    params.push(parseFloat(radius));

    const result = await query(sqlQuery, params);

    res.json({
      success: true,
      fundis: result.rows.map(fundi => ({
        id: fundi.user_id,
        firstName: fundi.first_name,
        lastName: fundi.last_name,
        email: fundi.email,
        phone: fundi.phone,
        latitude: fundi.latitude,
        longitude: fundi.longitude,
        skills: fundi.skills,
        experienceYears: fundi.experience_years,
        locationCity: fundi.location_city,
        distance: Math.round(fundi.distance, 2)
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get all fundis (admin only)
 */
router.get('/all', authMiddleware, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM fundi_profiles ORDER BY created_at DESC`,
      []
    );

    res.json({
      success: true,
      fundis: result.rows.map(fundi => ({
        id: fundi.id,
        user_id: fundi.user_id,
        first_name: fundi.first_name,
        last_name: fundi.last_name,
        email: fundi.email,
        phone: fundi.phone,
        id_number: fundi.id_number,
        id_photo_url: getFileUrl(fundi.id_photo_path),
        selfie_url: getFileUrl(fundi.selfie_path),
        verification_status: fundi.verification_status,
        skills: fundi.skills,
        created_at: fundi.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update fundi verification status (admin only)
 */
router.patch('/:fundiId/verify', authMiddleware, async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    const { fundiId } = req.params;

    if (!['verified', 'rejected'].includes(status)) {
      throw new AppError('Invalid verification status', 400);
    }

    const result = await query(
      `UPDATE fundi_profiles 
       SET verification_status = $1, 
           verification_notes = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, reason || null, fundiId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Fundi not found', 404);
    }

    const fundi = result.rows[0];

    res.json({
      success: true,
      message: `Fundi ${status} successfully`,
      fundi: {
        id: fundi.id,
        verification_status: fundi.verification_status,
        verification_notes: fundi.verification_notes
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update fundi live location
 */
router.post('/location', authMiddleware, async (req, res, next) => {
  try {
    const { latitude, longitude, accuracy, online = true } = req.body;

    if (typeof latitude === 'undefined' || typeof longitude === 'undefined') {
      throw new AppError('Latitude and longitude are required', 400);
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new AppError('Invalid GPS coordinates', 400);
    }

    // ensure table exists
    await query(`
      CREATE TABLE IF NOT EXISTS fundi_locations (
        user_id UUID PRIMARY KEY,
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        accuracy INTEGER,
        online BOOLEAN DEFAULT true,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // upsert location
    await query(
      `INSERT INTO fundi_locations (user_id, latitude, longitude, accuracy, online, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         accuracy = EXCLUDED.accuracy,
         online = EXCLUDED.online,
         updated_at = CURRENT_TIMESTAMP`,
      [req.user.userId, lat, lng, accuracy ? parseInt(accuracy) : null, online === false ? false : true]
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * Get fundi status (online/offline, location, subscription, etc)
 */
router.get('/status', authMiddleware, requireRole('fundi'), async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Get fundi profile
    const profileRes = await query('SELECT * FROM fundi_profiles WHERE user_id = $1', [userId]);
    if (profileRes.rows.length === 0) {
      throw new AppError('Fundi profile not found', 404);
    }
    const profile = profileRes.rows[0];

    // Get online status
    const locationRes = await query('SELECT * FROM fundi_locations WHERE user_id = $1', [userId]);
    const online = locationRes.rows.length > 0 && locationRes.rows[0].online;
    const location = locationRes.rows[0] || null;

    // Get subscription status
    const subscriptionActive = profile.subscription_active && (!profile.subscription_expires_at || new Date(profile.subscription_expires_at) > new Date());
    const subscriptionExpiresAt = profile.subscription_expires_at;
    const daysLeft = subscriptionExpiresAt ? Math.ceil((new Date(subscriptionExpiresAt) - new Date()) / (1000 * 60 * 60 * 24)) : null;

    // Get pending job requests
    const pendingRes = await query(
      'SELECT COUNT(*) as count FROM job_requests WHERE fundi_id = $1 AND status = $2',
      [userId, 'sent']
    );
    const pendingJobs = parseInt(pendingRes.rows[0].count) || 0;

    res.json({
      success: true,
      status: {
        online,
        verificationStatus: profile.verification_status,
        subscriptionActive,
        subscriptionExpiresAt,
        daysLeft,
        pendingJobs,
        location: location ? {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          updatedAt: location.updated_at
        } : null
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get fundi earnings
 */
router.get('/earnings', authMiddleware, requireRole('fundi'), async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Current balance
    const walletRes = await query('SELECT balance FROM fundi_wallets WHERE user_id = $1', [userId]);
    const totalEarnings = walletRes.rows.length > 0 ? parseFloat(walletRes.rows[0].balance) : 0;

    // This month earnings
    const thisMonthRes = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM fundi_wallet_transactions
       WHERE user_id = $1 AND type = 'earning' 
       AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`,
      [userId]
    );
    const thisMonth = parseFloat(thisMonthRes.rows[0].total) || 0;

    // Pending payments
    const pendingRes = await query(
      `SELECT COALESCE(SUM(fundi_earnings), 0) as total FROM payments
       WHERE fundi_id = $1 AND payment_status = 'pending'`,
      [userId]
    );
    const pending = parseFloat(pendingRes.rows[0].total) || 0;

    // Completed jobs this month
    const completedJobsRes = await query(
      `SELECT COUNT(*) as count FROM jobs
       WHERE fundi_id = $1 AND status = 'completed'
       AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', CURRENT_DATE)`,
      [userId]
    );
    const completedJobs = parseInt(completedJobsRes.rows[0].count) || 0;

    res.json({
      success: true,
      earnings: {
        totalEarnings,
        thisMonth,
        pending,
        completedJobs
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get subscription status
 */
router.get('/subscription/status', authMiddleware, requireRole('fundi'), async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const result = await query(
      'SELECT subscription_active, subscription_expires_at FROM fundi_profiles WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Fundi profile not found', 404);
    }

    const profile = result.rows[0];
    const now = new Date();
    const expiresAt = profile.subscription_expires_at ? new Date(profile.subscription_expires_at) : null;
    const active = profile.subscription_active && (!expiresAt || expiresAt > now);
    const daysLeft = expiresAt ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)) : null;

    res.json({
      success: true,
      subscription: {
        active,
        expiresAt: expiresAt?.toISOString(),
        daysLeft
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Activate/extend subscription (placeholder - would integrate with payment system)
 */
router.post('/subscription/activate', authMiddleware, requireRole('fundi'), async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { plan = 'monthly' } = req.body;

    // Calculate expiry based on plan
    const expiryDate = new Date();
    switch (plan) {
      case 'monthly':
        expiryDate.setMonth(expiryDate.getMonth() + 1);
        break;
      case 'quarterly':
        expiryDate.setMonth(expiryDate.getMonth() + 3);
        break;
      case 'yearly':
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        break;
      default:
        throw new AppError('Invalid subscription plan', 400);
    }

    // Update subscription
    const result = await query(
      `UPDATE fundi_profiles SET subscription_active = true, subscription_expires_at = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 RETURNING *`,
      [expiryDate, userId]
    );

    const fundi = result.rows[0];

    res.json({
      success: true,
      message: 'Subscription activated successfully',
      subscription: {
        active: true,
        expiresAt: expiryDate.toISOString(),
        plan
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get fundi subscription status
 */
router.get('/subscription', authMiddleware, requireRole('fundi'), async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const result = await query(
      'SELECT subscription_active, subscription_expires_at FROM fundi_profiles WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Fundi profile not found', 404);
    }

    const profile = result.rows[0];
    const now = new Date();
    const expiresAt = profile.subscription_expires_at ? new Date(profile.subscription_expires_at) : null;
    const active = profile.subscription_active && (!expiresAt || expiresAt > now);

    res.json({
      success: true,
      subscription: {
        active,
        expiresAt: expiresAt?.toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

