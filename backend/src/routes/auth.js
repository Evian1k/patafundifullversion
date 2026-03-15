import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateToken, decodeToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';
import { query } from '../db.js';
import { authMiddleware, adminOnly } from '../middlewares/auth.js';
import { sendMail } from '../services/mailer.js';
import { v4 as uuidv4v } from 'uuid';
import { addMinutes } from '../utils/time.js';

const router = express.Router();

// Sign up
router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password || !fullName) {
      throw new AppError('Email, password, and full name are required', 400);
    }

    // Check if user exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      throw new AppError('User already exists', 400);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userId = uuidv4();
    // Always create as customer; fundi role is granted only after admin approval
    const result = await query(
      `INSERT INTO users (id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, role`,
      [userId, email, passwordHash, fullName, 'customer']
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.email, user.role);

    // Create profile
    await query(
      `INSERT INTO profiles (user_id, full_name)
       VALUES ($1, $2)`,
      [user.id, user.full_name]
    );

    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      },
      token
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const result = await query(
      'SELECT id, email, password_hash, full_name, role FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid email or password', 401);
    }

    const user = result.rows[0];
    const isValidPassword = await comparePassword(password, user.password_hash);

    if (!isValidPassword) {
      throw new AppError('Invalid email or password', 401);
    }

    // Enforce single admin account: only configured admin email may log in as admin
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'emmanuelevian@gmail.com';
    if (user.role === 'admin' && user.email !== ADMIN_EMAIL) {
      throw new AppError('Admin login is restricted', 403);
    }

    const token = generateToken(user.id, user.email, user.role);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      },
      token
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, email, full_name, role FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = result.rows[0];
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

// Create admin account (admin only)
router.post('/admin/create', authMiddleware, adminOnly, async (req, res, next) => {
  // Creating admin accounts via API is disabled to ensure only the configured admin exists.
  try {
    throw new AppError('Creating admin via API is disabled', 403);
  } catch (error) {
    next(error);
  }
});

// Logout (revoke token)
router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.substring(7);

    // decode token to get expiry
    const decoded = decodeToken(token);
    let expiresAt = null;
    if (decoded && decoded.exp) {
      // exp is in seconds
      expiresAt = new Date(decoded.exp * 1000);
    }

    await query('INSERT INTO token_blacklist (token, user_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT (token) DO NOTHING', [token, req.user.userId, expiresAt]);

    res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    next(error);
  }
});

/**
 * Password reset request
 */
router.post('/password/forgot', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw new AppError('Email is required', 400);

    const userResult = await query('SELECT id, email FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      // Do not reveal whether email exists
      return res.json({ success: true, message: 'If an account exists, a password reset email has been sent' });
    }

    const user = userResult.rows[0];
    const token = uuidv4v();
    const expiresAt = addMinutes(new Date(), 60); // 60 minutes

    await query(
      `INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, token, expiresAt]
    );

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${FRONTEND_URL}/auth/reset-password?token=${token}`;

    const subject = 'Reset your FixIt Connect password';
    const text = `We received a request to reset your password. If this was you, open the link: ${resetLink} . If not, ignore this message.`;
    const html = `<p>We received a request to reset your FixIt Connect password. If this was you, <a href="${resetLink}">click here to reset your password</a>. If not, ignore this message.</p>`;

    try {
      await sendMail(user.email, subject, text, html);
    } catch (err) {
      console.error('Error sending password reset email', err.message);
    }

    res.json({ success: true, message: 'If an account exists, a password reset email has been sent' });
  } catch (error) {
    next(error);
  }
});

/**
 * Password reset (use token)
 */
router.post('/password/reset', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) throw new AppError('Token and new password are required', 400);

    const tokenResult = await query(
      'SELECT id, user_id, expires_at, used FROM password_resets WHERE token = $1',
      [token]
    );

    if (tokenResult.rows.length === 0) {
      throw new AppError('Invalid or expired token', 400);
    }

    const reset = tokenResult.rows[0];
    if (reset.used) throw new AppError('Token already used', 400);
    if (new Date(reset.expires_at) < new Date()) throw new AppError('Token expired', 400);

    const passwordHash = await hashPassword(password);
    await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [passwordHash, reset.user_id]);

    // Mark token used and invalidate other tokens for this user
    await query('UPDATE password_resets SET used = true WHERE user_id = $1', [reset.user_id]);

    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
