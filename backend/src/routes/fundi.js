import express from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { upload, getFileUrl } from '../services/file.js';
import { verifyOCRData } from '../services/ocr.js';
import { AppError } from '../utils/errors.js';
import { authMiddleware } from '../middlewares/auth.js';

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

    // Check if fundi already registered
    const existing = await query(
      'SELECT id FROM fundi_profiles WHERE user_id = $1',
      [req.user.userId]
    );

    if (existing.rows.length > 0) {
      throw new AppError('Fundi already registered', 400);
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

    if (ocrResult.extractedId) {
      idNumberExtracted = ocrResult.extractedId;
    }
    if (ocrResult.extractedName) {
      idNameExtracted = ocrResult.extractedName;
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

    // Update user role to 'fundi' after successful registration
    await query(
      'UPDATE users SET role = $1 WHERE id = $2',
      ['fundi', req.user.userId]
    );

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

export default router;

