import { verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';

export const authMiddleware = (req, res, next) => {
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
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      if (!allowedRoles.includes(req.user.role)) {
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
 * Admin-only middleware
 */
export const adminOnly = (req, res, next) => {
  return requireRole('admin')(req, res, next);
};
