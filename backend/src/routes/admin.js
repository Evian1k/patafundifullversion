import express from 'express';
import { query } from '../db.js';
import { AppError } from '../utils/errors.js';
import { authMiddleware, adminOnly } from '../middlewares/auth.js';
import { logAdminAction, getAdminActionLogs } from '../services/adminLogger.js';
import { getFileUrl } from '../services/file.js';
import { sendMail } from '../services/mailer.js';
import { generateOtpCode, hashOtp } from '../services/otp.js';
import { addMinutes } from '../utils/time.js';
import { otpEmail } from '../services/emailTemplates.js';

const router = express.Router();

/**
 * Get dashboard statistics (admin only)
 */
router.get('/dashboard-stats', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    // Get total users
    const usersResult = await query(
      'SELECT COUNT(*) as count FROM users WHERE role = $1',
      ['customer']
    );
    const totalUsers = parseInt(usersResult.rows[0].count) || 0;

    // Get total fundis
    const fundisResult = await query(
      'SELECT COUNT(*) as count FROM fundi_profiles',
      []
    );
    const totalFundis = parseInt(fundisResult.rows[0].count) || 0;

    // Get pending verifications
    const pendingResult = await query(
      'SELECT COUNT(*) as count FROM fundi_profiles WHERE verification_status = $1',
      ['pending']
    );
    const pendingVerifications = parseInt(pendingResult.rows[0].count) || 0;

    // Get approved fundis
    const approvedResult = await query(
      'SELECT COUNT(*) as count FROM fundi_profiles WHERE verification_status = $1',
      ['approved']
    );
    const approvedFundis = parseInt(approvedResult.rows[0].count) || 0;

    // Get rejected fundis
    const rejectedResult = await query(
      'SELECT COUNT(*) as count FROM fundi_profiles WHERE verification_status = $1',
      ['rejected']
    );
    const rejectedFundis = parseInt(rejectedResult.rows[0].count) || 0;

    // Get suspended fundis
    const suspendedResult = await query(
      'SELECT COUNT(*) as count FROM fundi_profiles WHERE verification_status = $1',
      ['suspended']
    );
    const suspendedFundis = parseInt(suspendedResult.rows[0].count) || 0;

    // Get active jobs
    const activeJobsResult = await query(
      `SELECT COUNT(*) as count FROM jobs 
       WHERE status IN ($1, $2, $3)`,
      ['pending', 'in_progress', 'accepted']
    );
    const activeJobs = parseInt(activeJobsResult.rows[0].count) || 0;

    // Get completed jobs
    const completedJobsResult = await query(
      'SELECT COUNT(*) as count FROM jobs WHERE status = $1',
      ['completed']
    );
    const completedJobs = parseInt(completedJobsResult.rows[0].count) || 0;

    // Get total revenue from completed jobs
    const revenueResult = await query(
      'SELECT COALESCE(SUM(final_price), 0) as total FROM jobs WHERE status = $1',
      ['completed']
    );
    const totalRevenue = parseFloat(revenueResult.rows[0].total) || 0;

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalFundis,
        pendingVerifications,
        approvedFundis,
        rejectedFundis,
        suspendedFundis,
        activeJobs,
        completedJobs,
        totalRevenue: parseFloat(totalRevenue.toFixed(2))
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get pending fundi verifications (admin only)
 */
router.get('/pending-fundis', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT fp.*, u.email, u.phone
       FROM fundi_profiles fp
       JOIN users u ON fp.user_id = u.id
       WHERE fp.verification_status = 'pending'
       ORDER BY fp.created_at ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) as count FROM fundi_profiles WHERE verification_status = $1',
      ['pending']
    );
    const totalCount = countResult.rows && countResult.rows[0] ? parseInt(countResult.rows[0].count) : 0;

    res.json({
      success: true,
      fundis: result.rows.map(fundi => ({
        id: fundi.id,
        userId: fundi.user_id,
        firstName: fundi.first_name,
        lastName: fundi.last_name,
        email: fundi.email,
        phone: fundi.phone,
        idNumber: fundi.id_number,
        idNumberExtracted: fundi.id_number_extracted,
        idNameExtracted: fundi.id_name_extracted,
        idPhotoUrl: getFileUrl(fundi.id_photo_path),
        idPhotoBackUrl: getFileUrl(fundi.id_photo_back_path),
        selfieUrl: getFileUrl(fundi.selfie_path),
        certificateUrls: fundi.certificate_paths?.map(p => getFileUrl(p)) || [],
        latitude: fundi.latitude,
        longitude: fundi.longitude,
        accuracy: fundi.accuracy,
        locationAddress: fundi.location_address,
        locationArea: fundi.location_area,
        locationCity: fundi.location_city,
        skills: fundi.skills,
        experienceYears: fundi.experience_years,
        mpesaNumber: fundi.mpesa_number,
        verificationStatus: fundi.verification_status,
        verificationNotes: fundi.verification_notes,
        createdAt: fundi.created_at,
        updatedAt: fundi.updated_at
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Alias: Get pending fundi verifications (admin only)
 */
router.get('/fundis/pending', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    // Same behavior as /pending-fundis
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT fp.*, u.email, u.phone
       FROM fundi_profiles fp
       JOIN users u ON fp.user_id = u.id
       WHERE fp.verification_status = 'pending'
       ORDER BY fp.created_at ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) as count FROM fundi_profiles WHERE verification_status = $1',
      ['pending']
    );
    const totalCount = countResult.rows && countResult.rows[0] ? parseInt(countResult.rows[0].count) : 0;

    res.json({
      success: true,
      fundis: result.rows.map(fundi => ({
        id: fundi.id,
        userId: fundi.user_id,
        firstName: fundi.first_name,
        lastName: fundi.last_name,
        email: fundi.email,
        phone: fundi.phone,
        idNumber: fundi.id_number,
        idNumberExtracted: fundi.id_number_extracted,
        idNameExtracted: fundi.id_name_extracted,
        idPhotoUrl: getFileUrl(fundi.id_photo_path),
        idPhotoBackUrl: getFileUrl(fundi.id_photo_back_path),
        selfieUrl: getFileUrl(fundi.selfie_path),
        certificateUrls: fundi.certificate_paths?.map(p => getFileUrl(p)) || [],
        latitude: fundi.latitude,
        longitude: fundi.longitude,
        accuracy: fundi.accuracy,
        locationAddress: fundi.location_address,
        locationArea: fundi.location_area,
        locationCity: fundi.location_city,
        skills: fundi.skills,
        experienceYears: fundi.experience_years,
        mpesaNumber: fundi.mpesa_number,
        verificationStatus: fundi.verification_status,
        verificationNotes: fundi.verification_notes,
        createdAt: fundi.created_at,
        updatedAt: fundi.updated_at
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get single fundi verification details (admin only)
 */
/**
 * Get all fundis (admin only)
 */
router.get('/fundis', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT fp.*, u.email, u.phone
       FROM fundi_profiles fp
       JOIN users u ON fp.user_id = u.id
       ORDER BY fp.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await query('SELECT COUNT(*) as count FROM fundi_profiles');
    const totalCount = countResult.rows && countResult.rows[0] ? parseInt(countResult.rows[0].count) : 0;

    res.json({
      success: true,
      fundis: result.rows.map(fundi => ({
        id: fundi.id,
        userId: fundi.user_id,
        firstName: fundi.first_name,
        lastName: fundi.last_name,
        email: fundi.email,
        phone: fundi.phone,
        verificationStatus: fundi.verification_status,
        skills: fundi.skills,
        createdAt: fundi.created_at
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get single fundi by ID (admin only)
 */
router.get('/fundis/:fundiId', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT fp.*, u.email, u.phone
       FROM fundi_profiles fp
       JOIN users u ON fp.user_id = u.id
       WHERE fp.id = $1`,
      [req.params.fundiId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Fundi not found', 404);
    }

    const fundi = result.rows[0];

    res.json({
      success: true,
      fundi: {
        id: fundi.id,
        userId: fundi.user_id,
        firstName: fundi.first_name,
        lastName: fundi.last_name,
        email: fundi.email,
        phone: fundi.phone,
        idNumber: fundi.id_number,
        idNumberExtracted: fundi.id_number_extracted,
        idNameExtracted: fundi.id_name_extracted,
        idPhotoUrl: getFileUrl(fundi.id_photo_path),
        idPhotoBackUrl: getFileUrl(fundi.id_photo_back_path),
        selfieUrl: getFileUrl(fundi.selfie_path),
        certificateUrls: fundi.certificate_paths?.map(p => getFileUrl(p)) || [],
        latitude: fundi.latitude,
        longitude: fundi.longitude,
        accuracy: fundi.accuracy,
        altitude: fundi.altitude,
        locationAddress: fundi.location_address,
        locationArea: fundi.location_area,
        locationCity: fundi.location_city,
        locationCapturedAt: fundi.location_captured_at,
        skills: fundi.skills,
        experienceYears: fundi.experience_years,
        mpesaNumber: fundi.mpesa_number,
        verificationStatus: fundi.verification_status,
        verificationNotes: fundi.verification_notes,
        subscriptionActive: fundi.subscription_active,
        subscriptionExpiresAt: fundi.subscription_expires_at,
        createdAt: fundi.created_at,
        updatedAt: fundi.updated_at,
        ocrComparison: {
          idNumberMatch: fundi.id_number === fundi.id_number_extracted,
          idNumber: fundi.id_number,
          idNumberExtracted: fundi.id_number_extracted,
          fullName: `${fundi.first_name} ${fundi.last_name}`,
          idNameExtracted: fundi.id_name_extracted
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Search and filter fundis (admin only)
 */
router.get('/search-fundis', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const { q, status, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sqlQuery = `
      SELECT fp.*, u.email, u.phone
      FROM fundi_profiles fp
      JOIN users u ON fp.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Search by name, ID number, or phone
    if (q) {
      sqlQuery += ` AND (
        fp.first_name ILIKE $${paramIndex} OR
        fp.last_name ILIKE $${paramIndex} OR
        fp.id_number ILIKE $${paramIndex} OR
        fp.phone ILIKE $${paramIndex}
      )`;
      params.push(`%${q}%`);
      paramIndex++;
    }

    // Filter by status
    if (status) {
      sqlQuery += ` AND fp.verification_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Get total count
    const countSql = sqlQuery.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as count FROM');
    const countResult = await query(countSql, params);
    const totalCount = countResult.rows && countResult.rows[0] ? parseInt(countResult.rows[0].count) : 0;

    // Add sorting and pagination
    sqlQuery += ` ORDER BY fp.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await query(sqlQuery, params);

    res.json({
      success: true,
      fundis: result.rows.map(fundi => ({
        id: fundi.id,
        userId: fundi.user_id,
        firstName: fundi.first_name,
        lastName: fundi.last_name,
        email: fundi.email,
        phone: fundi.phone,
        idNumber: fundi.id_number,
        idPhotoUrl: getFileUrl(fundi.id_photo_path),
        selfieUrl: getFileUrl(fundi.selfie_path),
        verificationStatus: fundi.verification_status,
        skills: fundi.skills,
        createdAt: fundi.created_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Approve fundi (admin only)
 */
router.post('/fundis/:fundiId/approve', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const { fundiId } = req.params;
    const { notes } = req.body;

    const result = await query(
      `UPDATE fundi_profiles 
       SET verification_status = 'approved', 
           verification_notes = COALESCE($1, verification_notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [notes || null, fundiId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Fundi not found', 404);
    }

    const fundi = result.rows[0];

    // Log the action
    await logAdminAction(
      req.user.userId,
      'approve',
      'fundi',
      fundiId,
      { status: 'pending' },
      { status: 'approved' },
      notes || null,
      req.ip
    );

    // Fetch the user's email to notify
    const userResult = await query('SELECT id, email FROM users WHERE id = $1', [fundi.user_id]);
    const userEmail = userResult.rows.length > 0 ? userResult.rows[0].email : null;

    // Promote the user role to 'fundi' so they receive fundi dashboard and can be matched
    try {
      await query(
        `UPDATE users SET role = $1 WHERE id = (
           SELECT user_id FROM fundi_profiles WHERE id = $2
         )`,
        ['fundi', fundiId]
      );
    } catch (err) {
      console.error('Failed to set user role to fundi for fundi id', fundiId, err.message);
    }

    // Send OTP for fundi access (after approval)
    let otpInfo = null;
    const echoOtp = process.env.DEV_ECHO_OTP === 'true' && process.env.NODE_ENV !== 'production';
    let debugOtp = null;
    if (userEmail) {
      try {
        const code = generateOtpCode();
        const expiresAt = addMinutes(new Date(), 10);
        const codeHash = hashOtp(code, userEmail, 'fundi_approval');

        await query(
          `INSERT INTO otp_codes (user_id, destination, channel, purpose, code_hash, expires_at)
           VALUES ($1, $2, 'email', $3, $4, $5)`,
          [fundi.user_id, userEmail, 'fundi_approval', codeHash, expiresAt]
        );

        await query(
          `UPDATE users SET fundi_otp_verified = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [fundi.user_id]
        ).catch(() => {});

        const tpl = otpEmail({
          code,
          purpose: 'fundi_approval',
          toEmail: userEmail,
          name: fundi.first_name || '',
        });
        await sendMail(userEmail, tpl.subject, tpl.text, tpl.html);

        otpInfo = { destination: userEmail, channel: 'email', expiresAt: expiresAt.toISOString() };
        if (echoOtp) debugOtp = { code };
      } catch (err) {
        console.error('Failed to send fundi approval OTP to', userEmail, err.message);
      }
    }

    res.json({
      success: true,
      message: 'Fundi approved successfully',
      fundi: {
        id: fundi.id,
        firstName: fundi.first_name,
        lastName: fundi.last_name,
        verificationStatus: fundi.verification_status,
        verificationNotes: fundi.verification_notes
      },
      otp: otpInfo,
      ...(debugOtp ? { debug: { otp: debugOtp } } : {}),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Reject fundi (admin only)
 */
router.post('/fundis/:fundiId/reject', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const { fundiId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      throw new AppError('Rejection reason is required', 400);
    }

    const result = await query(
      `UPDATE fundi_profiles 
       SET verification_status = 'rejected', 
           verification_notes = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [reason, fundiId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Fundi not found', 404);
    }

    const fundi = result.rows[0];

    // Log the action
    await logAdminAction(
      req.user.userId,
      'reject',
      'fundi',
      fundiId,
      { status: 'pending' },
      { status: 'rejected' },
      reason,
      req.ip
    );

    res.json({
      success: true,
      message: 'Fundi rejected successfully',
      fundi: {
        id: fundi.id,
        firstName: fundi.first_name,
        lastName: fundi.last_name,
        verificationStatus: fundi.verification_status,
        verificationNotes: fundi.verification_notes
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Suspend fundi (admin only)
 */
router.post('/fundis/:fundiId/suspend', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const { fundiId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      throw new AppError('Suspension reason is required', 400);
    }

    const result = await query(
      `UPDATE fundi_profiles 
       SET verification_status = 'suspended', 
           verification_notes = $1,
           subscription_active = false,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [reason, fundiId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Fundi not found', 404);
    }

    const fundi = result.rows[0];

    // Log the action
    await logAdminAction(
      req.user.userId,
      'suspend',
      'fundi',
      fundiId,
      { status: fundi.verification_status },
      { status: 'suspended' },
      reason,
      req.ip
    );

    res.json({
      success: true,
      message: 'Fundi suspended successfully',
      fundi: {
        id: fundi.id,
        firstName: fundi.first_name,
        lastName: fundi.last_name,
        verificationStatus: fundi.verification_status
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Revoke fundi approval (admin only)
 */
router.post('/fundis/:fundiId/revoke', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const { fundiId } = req.params;
    const { reason } = req.body;

    // First get the current status
    const currentResult = await query(
      'SELECT verification_status FROM fundi_profiles WHERE id = $1',
      [fundiId]
    );

    if (currentResult.rows.length === 0) {
      throw new AppError('Fundi not found', 404);
    }

    const oldStatus = currentResult.rows[0].verification_status;

    if (oldStatus !== 'approved') {
      throw new AppError('Only approved fundis can have their approval revoked', 400);
    }

    const result = await query(
      `UPDATE fundi_profiles 
       SET verification_status = 'pending', 
           verification_notes = $1,
           subscription_active = false,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [reason || null, fundiId]
    );

    const fundi = result.rows[0];

    // Log the action
    await logAdminAction(
      req.user.userId,
      'revoke',
      'fundi',
      fundiId,
      { status: 'approved' },
      { status: 'pending' },
      reason || null,
      req.ip
    );

    res.json({
      success: true,
      message: 'Fundi approval revoked successfully',
      fundi: {
        id: fundi.id,
        firstName: fundi.first_name,
        lastName: fundi.last_name,
        verificationStatus: fundi.verification_status
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get admin action logs (admin only) - aliased endpoint
 */
router.get('/action-logs', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT * FROM admin_action_logs
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await query('SELECT COUNT(*) as count FROM admin_action_logs');
    const totalCount = countResult.rows && countResult.rows[0] ? parseInt(countResult.rows[0].count) : 0;

    res.json({
      success: true,
      logs: result.rows.map(log => ({
        id: log.id,
        adminId: log.admin_id,
        actionType: log.action_type,
        targetType: log.target_type,
        targetId: log.target_id,
        previousData: log.old_value ? JSON.parse(log.old_value) : null,
        newData: log.new_value ? JSON.parse(log.new_value) : null,
        reason: log.reason,
        ipAddress: log.ip_address,
        createdAt: log.created_at
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get admin action logs (admin only)
 */
router.get('/logs/actions', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const filters = {
      adminId: req.query.adminId || null,
      actionType: req.query.actionType || null,
      targetType: req.query.targetType || null,
      targetId: req.query.targetId || null
    };

    const logs = await getAdminActionLogs(limit, offset, filters);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM admin_action_logs WHERE 1=1';
    const countParams = [];
    let paramIndex = 1;

    if (filters.adminId) {
      countQuery += ` AND admin_id = $${paramIndex}`;
      countParams.push(filters.adminId);
      paramIndex++;
    }
    if (filters.actionType) {
      countQuery += ` AND action_type = $${paramIndex}`;
      countParams.push(filters.actionType);
      paramIndex++;
    }
    if (filters.targetType) {
      countQuery += ` AND target_type = $${paramIndex}`;
      countParams.push(filters.targetType);
      paramIndex++;
    }
    if (filters.targetId) {
      countQuery += ` AND target_id = $${paramIndex}`;
      countParams.push(filters.targetId);
      paramIndex++;
    }
    const countResult = await query(countQuery, countParams);
    const totalCount = countResult.rows && countResult.rows[0] ? parseInt(countResult.rows[0].count) : 0;

    res.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get all customers (admin read-only)
 */
router.get('/customers', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const params = [limit, offset];
    // Customers are users with role=customer AND no fundi application/profile.
    // This prevents fundi applicants from appearing under customers even if their role was not updated due to older builds.
    let where = `u.role = 'customer' AND NOT EXISTS (SELECT 1 FROM fundi_profiles fp WHERE fp.user_id = u.id)`;
    if (q) {
      where += ` AND (u.email ILIKE $3 OR u.full_name ILIKE $3 OR u.phone ILIKE $3)`;
      params.push(`%${q}%`);
    }

    const result = await query(
      `SELECT u.id, u.email, u.full_name, u.phone, u.status, u.email_verified, u.created_at,
              COUNT(DISTINCT j.id) as job_count
       FROM users u
       LEFT JOIN jobs j ON u.id = j.customer_id
       WHERE ${where}
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );

    const countParams = [];
    let countSql = `SELECT COUNT(*) as count FROM users u WHERE ${where}`;
    if (q) countParams.push(`%${q}%`);
    const countResult = await query(countSql, countParams);
    const totalCount = countResult.rows && countResult.rows[0] ? parseInt(countResult.rows[0].count) : 0;

    res.json({
      success: true,
      customers: result.rows.map(customer => ({
        id: customer.id,
        email: customer.email,
        fullName: customer.full_name || null,
        phone: customer.phone || null,
        jobCount: parseInt(customer.job_count) || 0,
        status: customer.status || null,
        emailVerified: customer.email_verified === true,
        createdAt: customer.created_at
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get all jobs with filtering (admin read-only)
 */
router.get('/jobs', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { status, customerId } = req.query;

    let sqlQuery = `
      SELECT j.*, 
             uc.full_name as customer_name,
             uf.full_name as fundi_name
       FROM jobs j
       LEFT JOIN users uc ON j.customer_id = uc.id
       LEFT JOIN users uf ON j.fundi_id = uf.id
       WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      sqlQuery += ` AND j.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (customerId) {
      sqlQuery += ` AND j.customer_id = $${paramIndex}`;
      params.push(customerId);
      paramIndex++;
    }

    // Get total count
    const countSql = sqlQuery.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as count FROM');
    const countResult = await query(countSql, params);
    const totalCount = countResult.rows && countResult.rows[0] ? parseInt(countResult.rows[0].count) : 0;

    sqlQuery += ` ORDER BY j.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(sqlQuery, params);

    res.json({
      success: true,
      jobs: result.rows.map(job => ({
        id: job.id,
        title: job.title,
        description: job.description,
        category: job.category,
        status: job.status,
        customerId: job.customer_id,
        customerName: job.customer_name,
        fundiId: job.fundi_id,
        fundiName: job.fundi_name,
        estimatedPrice: parseFloat(job.estimated_price) || 0,
        finalPrice: parseFloat(job.final_price) || 0,
        location: job.location,
        createdAt: job.created_at,
        updatedAt: job.updated_at
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get transactions for payments page (admin only)
 */
router.get('/transactions', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT j.id as job_id,
              uc.full_name as customer_name,
              uf.full_name as fundi_name,
              j.final_price as amount,
              j.platform_fee as commission,
              j.status,
              j.updated_at as created_at
       FROM jobs j
       LEFT JOIN users uc ON j.customer_id = uc.id
       LEFT JOIN users uf ON j.fundi_id = uf.id
       WHERE j.status = 'completed'
       ORDER BY j.updated_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await query(
      'SELECT COALESCE(COUNT(*), 0) as count, COALESCE(SUM(final_price), 0) as total_revenue FROM jobs WHERE status = $1',
      ['completed']
    );
    const totalCount = countResult.rows && countResult.rows[0] ? parseInt(countResult.rows[0].count) : 0;
    const totalRevenue = parseFloat(countResult.rows[0].total_revenue) || 0;
    const commissionSum = await query(`SELECT COALESCE(SUM(platform_fee),0) as total_commission FROM jobs WHERE status = $1`, ['completed']);
    const totalCommission = parseFloat(commissionSum.rows[0]?.total_commission) || 0;

    res.json({
      success: true,
      transactions: result.rows.map(row => ({
        id: row.job_id,
        jobId: row.job_id,
        customerId: null,
        customerName: row.customer_name,
        fundiId: null,
        fundiName: row.fundi_name,
        amount: parseFloat(row.amount) || 0,
        commission: parseFloat(row.commission) || 0,
        status: row.status,
        createdAt: row.created_at
      })),
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalCommission: parseFloat(totalCommission.toFixed(2)),
      count: totalCount,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Payments logs (admin only) - API contract alias
 */
router.get('/payments/logs', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT p.*,
              jc.title as job_title,
              uc.full_name as customer_name,
              uf.full_name as fundi_name
       FROM payments p
       LEFT JOIN jobs jc ON jc.id = p.job_id
       LEFT JOIN users uc ON uc.id = p.customer_id
       LEFT JOIN users uf ON uf.id = p.fundi_id
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countRes = await query('SELECT COUNT(*) as count FROM payments');
    const total = parseInt(countRes.rows[0]?.count || 0);

    res.json({
      success: true,
      payments: result.rows.map(p => ({
        id: p.id,
        jobId: p.job_id,
        jobTitle: p.job_title,
        customerId: p.customer_id,
        customerName: p.customer_name,
        fundiId: p.fundi_id,
        fundiName: p.fundi_name,
        amount: parseFloat(p.amount),
        platformFee: parseFloat(p.platform_fee),
        fundiEarnings: parseFloat(p.fundi_earnings),
        paymentMethod: p.payment_method,
        status: p.payment_status,
        transactionId: p.transaction_id,
        createdAt: p.created_at,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Audit logs (admin only)
 */
router.get('/audit/logs', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countRes = await query('SELECT COUNT(*) as count FROM audit_logs');
    const total = parseInt(countRes.rows[0]?.count || 0);

    res.json({
      success: true,
      logs: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get security alerts (admin only)
 */
router.get('/security-alerts', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    // Query actual security alerts from database when table is created
    res.json({
      success: true,
      alerts: []
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Resolve security alert (admin only)
 */
router.post('/security-alerts/:alertId/resolve', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    await logAdminAction(
      req.user.userId,
      'resolve_alert',
      'security_alert',
      req.params.alertId,
      null,
      { resolved: true },
      req.body.reason || 'Resolved',
      req.ip
    );

    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Force logout user (admin only)
 */
router.post('/users/:userId/force-logout', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const userId = req.params.userId;

    // Add token to blacklist (for active sessions)
    // In production, implement proper session management

    await logAdminAction(
      req.user.userId,
      'force_logout',
      'user',
      userId,
      null,
      { logged_out: true },
      req.body.reason || 'Admin forced logout',
      req.ip
    );

    res.json({
      success: true,
      message: 'User logged out successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Disable user account (admin only)
 */
router.post('/users/:userId/disable', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const userId = req.params.userId;

    // Update user status
    await query(
      'UPDATE users SET status = $1, disabled_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['disabled', userId]
    );

    await logAdminAction(
      req.user.userId,
      'disable_account',
      'user',
      userId,
      { status: 'active' },
      { status: 'disabled' },
      req.body.reason || 'Admin disabled account',
      req.ip
    );

    res.json({
      success: true,
      message: 'User account disabled successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get admin settings (admin only)
 */
router.get('/settings', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    // Return default settings - in production, store in database
    res.json({
      success: true,
      settings: {
        platformCommissionRate: 10,
        minimumJobPrice: 100,
        maximumJobPrice: 50000,
        maintenanceMode: false,
        newRegistrationsEnabled: true,
        emailNotificationsEnabled: true
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update admin settings (admin only)
 */
router.put('/settings', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    // In production, store settings in database
    await logAdminAction(
      req.user.userId,
      'update_settings',
      'admin_settings',
      'platform',
      null,
      req.body,
      'Updated platform settings',
      req.ip
    );

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: req.body
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get reports/analytics (admin only)
 */
router.get('/reports', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const range = req.query.range || '30d';
    const daysBack = range === '7d' ? 7 : range === '90d' ? 90 : 30;

    // Get chart data from database - daily aggregated stats
    const chartDataResult = await query(
      `SELECT 
         DATE(j.created_at) as date,
         COUNT(DISTINCT j.id) as jobs,
         COALESCE(SUM(CASE WHEN j.status = 'completed' THEN j.final_price ELSE 0 END), 0) as revenue,
         COUNT(DISTINCT j.customer_id) as customers,
         COUNT(DISTINCT CASE WHEN j.status IN ('in_progress', 'completed', 'accepted') THEN j.fundi_id END) as fundis
       FROM jobs j
       WHERE j.created_at >= CURRENT_DATE - INTERVAL '${daysBack} days'
       GROUP BY DATE(j.created_at)
       ORDER BY DATE(j.created_at) ASC`,
      []
    );

    const chartData = chartDataResult.rows.map(row => ({
      date: new Date(row.date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }),
      jobs: parseInt(row.jobs) || 0,
      revenue: parseFloat(row.revenue) || 0,
      customers: parseInt(row.customers) || 0,
      fundis: parseInt(row.fundis) || 0
    }));

    // Get top performing fundis from database
    const topFundisResult = await query(
      `SELECT 
         u.id,
         u.full_name as name,
         COUNT(j.id) as job_count
       FROM users u
       LEFT JOIN jobs j ON u.id = j.fundi_id AND j.status = 'completed'
       WHERE u.role = 'fundi'
       GROUP BY u.id, u.full_name
       ORDER BY job_count DESC
       LIMIT 10`,
      []
    );

    const topFundis = topFundisResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      jobCount: parseInt(row.job_count) || 0
    }));

    res.json({
      success: true,
      chartData,
      topFundis
    });
  } catch (error) {
    next(error);
  }
});

export default router;
