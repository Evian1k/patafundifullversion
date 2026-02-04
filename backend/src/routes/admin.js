import express from 'express';
import { query } from '../db.js';
import { AppError } from '../utils/errors.js';
import { authMiddleware, adminOnly } from '../middlewares/auth.js';
import { logAdminAction, getAdminActionLogs } from '../services/adminLogger.js';
import { getFileUrl } from '../services/file.js';

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
    const totalCount = parseInt(countResult.rows[0].count);

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
    const totalCount = parseInt(countResult.rows[0].count);

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

    res.json({
      success: true,
      message: 'Fundi approved successfully',
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
    const totalCount = parseInt(countResult.rows[0].count);

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

    const result = await query(
      `SELECT u.id, u.email, u.full_name, u.phone, u.created_at,
              COUNT(DISTINCT j.id) as job_count
       FROM users u
       LEFT JOIN jobs j ON u.id = j.customer_id
       WHERE u.role = 'customer'
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) as count FROM users WHERE role = $1',
      ['customer']
    );
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      customers: result.rows.map(customer => ({
        id: customer.id,
        email: customer.email,
        fullName: customer.full_name,
        phone: customer.phone,
        jobCount: parseInt(customer.job_count) || 0,
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
    const totalCount = parseInt(countResult.rows[0].count);

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

export default router;

