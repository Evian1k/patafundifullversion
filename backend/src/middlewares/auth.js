import { verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';
import { query } from '../db.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      throw new AppError('Invalid or expired token', 401);
    }

    // Check token blacklist
    try {
      const black = await query('SELECT id FROM token_blacklist WHERE token = $1 AND (expires_at IS NULL OR expires_at > NOW())', [token]);
      if (black.rows.length > 0) {
        throw new AppError('Token revoked', 401);
      }
    } catch (err) {
      // If DB check fails, log and continue to avoid locking out users on transient DB errors
      console.error('Token blacklist check failed:', err.message);
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(error.statusCode || 401).json({
      success: false,
      message: error.message
    });
  }
};

export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      if (decoded) {
        req.user = decoded;
      }
    }

    next();
  } catch (error) {
    next();
  }
};

/**
 * Role-based access control middleware
 * @param {...string} allowedRoles - List of roles that can access the route
 */
export const requireRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      // Trust DB role over JWT role claim (role can change after admin approval).
      const r = await query('SELECT role, status FROM users WHERE id = $1', [req.user.userId]);
      if (r.rows.length === 0) throw new AppError('User not found', 401);
      const dbRole = r.rows[0].role;
      const dbStatus = r.rows[0].status;

      if (dbStatus && dbStatus !== 'active') {
        throw new AppError('Account is not active', 403);
      }

      // Keep req.user.role up to date for downstream handlers/audit logs
      req.user.role = dbRole;

      if (!allowedRoles.includes(dbRole)) {
        throw new AppError(`Access denied. Required roles: ${allowedRoles.join(', ')}`, 403);
      }

      next();
    } catch (error) {
      res.status(error.statusCode || 403).json({
        success: false,
        message: error.message
      });
    }
  };
};

/**
 * Fundi access guard: user must be an approved fundi and must have verified the fundi-approval OTP.
 * Used for fundi dashboard + job-taking features.
 */
export const requireFundiAccess = () => {
  return async (req, res, next) => {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);

      const userRes = await query(
        'SELECT role, status, fundi_otp_verified FROM users WHERE id = $1',
        [req.user.userId]
      );
      if (userRes.rows.length === 0) throw new AppError('User not found', 401);

      const u = userRes.rows[0];
      req.user.role = u.role;

      if (u.status && u.status !== 'active') throw new AppError('Account is not active', 403);

      // Must be promoted to fundi by admin
      if (u.role !== 'fundi') {
        throw new AppError('Fundi access denied. Account is not approved yet.', 403);
      }

      // Must have approved profile
      const profRes = await query(
        `SELECT verification_status FROM fundi_profiles WHERE user_id = $1`,
        [req.user.userId]
      );
      const verificationStatus = profRes.rows[0]?.verification_status || null;
      if (verificationStatus !== 'approved') {
        throw new AppError('Fundi access denied. Verification not approved.', 403);
      }

      if (u.fundi_otp_verified !== true) {
        const err = new AppError('OTP required. Please verify the code sent after approval.', 403);
        // Attach a small machine-readable hint for the frontend.
        err.meta = { code: 'FUNDI_OTP_REQUIRED' };
        throw err;
      }

      next();
    } catch (error) {
      res.status(error.statusCode || 403).json({
        success: false,
        message: error.message,
        ...(error.meta ? { meta: error.meta } : {}),
      });
    }
  };
};

/**
 * Admin-only middleware
 */
export const adminOnly = (req, res, next) => {
  return requireRole('admin')(req, res, next);
};
