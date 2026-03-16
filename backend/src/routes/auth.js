import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateToken, decodeToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';
import { query } from '../db.js';
import { authMiddleware, adminOnly } from '../middlewares/auth.js';
import { sendMail, isSmtpConfigured, smtpMissingKeys } from '../services/mailer.js';
import { addMinutes } from '../utils/time.js';
import { generateOtpCode, hashOtp, safeEqual } from '../services/otp.js';
import { otpEmail } from '../services/emailTemplates.js';

const router = express.Router();

/**
 * Resend OTP (registration)
 * Rate limits per destination to prevent abuse.
 */
router.post('/otp-resend', async (req, res, next) => {
  try {
    const { email, purpose = 'register' } = req.body || {};
    if (!email) throw new AppError('Email is required', 400);
    if (!isSmtpConfigured()) {
      throw new AppError(`Email delivery is not configured (missing: ${smtpMissingKeys().join(', ')}). Set SMTP_* in backend/.env`, 503);
    }

    const userRes = await query('SELECT id, email_verified, role, fundi_otp_verified FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) throw new AppError('User not found', 404);
    const user = userRes.rows[0];

    if (purpose === 'register' && user.email_verified === true) {
      return res.json({ success: true, message: 'Account already verified' });
    }
    if (purpose === 'fundi_approval' && user.fundi_otp_verified === true) {
      return res.json({ success: true, message: 'Fundi OTP already verified' });
    }
    if (purpose === 'fundi_approval' && user.role !== 'fundi') {
      throw new AppError('Fundi OTP can only be sent after approval', 400);
    }

    // Basic rate limit:
    // - at most 1 OTP per 30 seconds
    // - at most 5 OTPs per 1 hour
    const recent = await query(
      `SELECT created_at FROM otp_codes
       WHERE destination = $1 AND purpose = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, purpose]
    );
    if (recent.rows.length > 0) {
      const createdAt = new Date(recent.rows[0].created_at);
      if (Date.now() - createdAt.getTime() < 30_000) {
        throw new AppError('Please wait before requesting another OTP', 429);
      }
    }

    const hourly = await query(
      `SELECT COUNT(*)::int as cnt FROM otp_codes
       WHERE destination = $1 AND purpose = $2 AND created_at >= NOW() - INTERVAL '60 minutes'`,
      [email, purpose]
    );
    const cnt = hourly.rows[0]?.cnt ?? 0;
    if (cnt >= 5) {
      throw new AppError('Too many OTP requests. Try again later.', 429);
    }

    const code = generateOtpCode();
    const echoOtp = process.env.DEV_ECHO_OTP === 'true' && process.env.NODE_ENV !== 'production';
    const expiresAt = addMinutes(new Date(), 10);
    const codeHash = hashOtp(code, email, purpose);

    await query(
      `INSERT INTO otp_codes (user_id, destination, channel, purpose, code_hash, expires_at)
       VALUES ($1, $2, 'email', $3, $4, $5)`,
      [user.id, email, purpose, codeHash, expiresAt]
    );

    const subject = 'FixIt Connect OTP Verification';
    const tpl = otpEmail({ code, purpose, toEmail: email });
    await sendMail(email, tpl.subject || subject, tpl.text, tpl.html);

    res.json({
      success: true,
      message: 'OTP resent',
      otp: { destination: email, channel: 'email', expiresAt: expiresAt.toISOString() },
      ...(echoOtp ? { debug: { code } } : {}),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Register with OTP (email/phone).
 * Creates the user, sends OTP, and requires /otp-verify before first login.
 */
router.post('/register', async (req, res, next) => {
  try {
    const { email, phone, password, fullName, role } = req.body;

    if (!email && !phone) {
      throw new AppError('Email or phone is required', 400);
    }
    if (!password || !fullName) {
      throw new AppError('Password and full name are required', 400);
    }
    if (!email) {
      throw new AppError('Email is required for now (phone-only registration not yet enabled)', 400);
    }

    // Prevent normal users from registering with the reserved admin email.
    const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (ADMIN_EMAIL && String(email).trim().toLowerCase() === ADMIN_EMAIL) {
      throw new AppError('This email is reserved for the admin account. Use a different email for customer/fundi registration.', 400);
    }

    if (!isSmtpConfigured()) {
      throw new AppError(`Email delivery is not configured (missing: ${smtpMissingKeys().join(', ')}). Set SMTP_* in backend/.env`, 503);
    }

    const requestedRole = (role || 'customer').toString().toLowerCase();
    const dbRole = requestedRole === 'fundi' ? 'fundi_pending' : 'customer';

    const existingUser = await query('SELECT id, email_verified, full_name, phone, role FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      const existing = existingUser.rows[0];
      if (existing.email_verified === true) {
        throw new AppError('User already exists', 400);
      }

      // Allow choosing fundi onboarding during OTP registration for unverified accounts.
      if (existing.role !== dbRole) {
        await query(
          `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [dbRole, existing.id]
        ).catch(() => {});
      }

      // Existing but unverified (common after refresh/back): resend OTP and let user continue.
      const destination = email;

      // Rate limit:
      // - at most 1 OTP per 30 seconds
      // - at most 5 OTPs per 1 hour
      const recent = await query(
        `SELECT created_at FROM otp_codes
         WHERE destination = $1 AND purpose = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [destination, 'register']
      );
      if (recent.rows.length > 0) {
        const createdAt = new Date(recent.rows[0].created_at);
        if (Date.now() - createdAt.getTime() < 30_000) {
          throw new AppError('Please wait before requesting another OTP', 429);
        }
      }

      const hourly = await query(
        `SELECT COUNT(*)::int as cnt FROM otp_codes
         WHERE destination = $1 AND purpose = $2 AND created_at >= NOW() - INTERVAL '60 minutes'`,
        [destination, 'register']
      );
      const cnt = hourly.rows[0]?.cnt ?? 0;
      if (cnt >= 5) {
        throw new AppError('Too many OTP requests. Try again later.', 429);
      }

      const code = generateOtpCode();
      const echoOtp = process.env.DEV_ECHO_OTP === 'true' && process.env.NODE_ENV !== 'production';
      const expiresAt = addMinutes(new Date(), 10);
      const codeHash = hashOtp(code, destination, 'register');

      await query(
        `INSERT INTO otp_codes (user_id, destination, channel, purpose, code_hash, expires_at)
         VALUES ($1, $2, 'email', 'register', $3, $4)`,
        [existing.id, destination, codeHash, expiresAt]
      );

      const tpl = otpEmail({ code, purpose: 'register', toEmail: destination, name: existing.full_name || fullName || '' });
      await sendMail(destination, tpl.subject, tpl.text, tpl.html);

      // Ensure profile exists (best-effort)
      await query(
        `INSERT INTO profiles (user_id, full_name, phone)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO NOTHING`,
        [existing.id, existing.full_name || fullName, existing.phone || phone || null]
      ).catch(() => {});

      return res.status(200).json({
        success: true,
        message: 'Account exists but is not verified. OTP resent.',
        user: {
          id: existing.id,
          email,
          fullName: existing.full_name || fullName,
          phone: existing.phone || phone || null,
          role: dbRole,
        },
        otp: { destination, channel: 'email', expiresAt: expiresAt.toISOString() },
        ...(echoOtp ? { debug: { code } } : {}),
      });
    }

    const passwordHash = await hashPassword(password);
    const userId = uuidv4();

    const result = await query(
      `INSERT INTO users (id, email, password_hash, full_name, phone, role, email_verified, phone_verified)
       VALUES ($1, $2, $3, $4, $5, $6, false, false)
       RETURNING id, email, full_name, role, phone`,
      [userId, email, passwordHash, fullName, phone || null, dbRole]
    );

    await query(`INSERT INTO profiles (user_id, full_name, phone) VALUES ($1, $2, $3)`, [userId, fullName, phone || null]);

    const code = generateOtpCode();
    const echoOtp = process.env.DEV_ECHO_OTP === 'true' && process.env.NODE_ENV !== 'production';
    const expiresAt = addMinutes(new Date(), 10);
    const destination = email;
    const codeHash = hashOtp(code, destination, 'register');

    await query(
      `INSERT INTO otp_codes (user_id, destination, channel, purpose, code_hash, expires_at)
       VALUES ($1, $2, 'email', 'register', $3, $4)`,
      [userId, destination, codeHash, expiresAt]
    );

    const tpl = otpEmail({ code, purpose: 'register', toEmail: destination, name: fullName || '' });
    await sendMail(destination, tpl.subject, tpl.text, tpl.html);

    // Audit (system event)
    await query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, metadata, created_at)
       VALUES (NULL, 'system', 'user.register_otp_started', 'users', $1, $2, NOW())`,
      [userId, JSON.stringify({ email })]
    ).catch(() => {});

    // Notify admin (best-effort)
    try {
      const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'emmanuelevian@gmail.com';
      const asText = `${fullName} (${email}) started registration as ${dbRole} (OTP sent).`;
      const subject = dbRole === 'fundi_pending' ? 'New fundi registration started' : 'New customer registration started';
      await sendMail(ADMIN_EMAIL, subject, asText, `<p>${asText}</p>`);
    } catch (err) {
      console.error('Failed to notify admin of registration:', err.message);
    }

    res.status(201).json({
      success: true,
      message: 'OTP sent. Verify to complete registration.',
      user: {
        id: result.rows[0].id,
        email: result.rows[0].email,
        fullName: result.rows[0].full_name,
        phone: result.rows[0].phone,
        role: result.rows[0].role,
      },
      otp: { destination, channel: 'email', expiresAt: expiresAt.toISOString() },
      ...(echoOtp ? { debug: { code } } : {}),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * OTP verify (registration)
 */
router.post('/otp-verify', async (req, res, next) => {
  try {
    const { email, code, purpose = 'register' } = req.body;
    if (!email || !code) throw new AppError('Email and OTP code are required', 400);

    const userRes = await query('SELECT id, email, role, email_verified, fundi_otp_verified FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) throw new AppError('User not found', 404);
    const user = userRes.rows[0];

    const otpRes = await query(
      `SELECT * FROM otp_codes
       WHERE user_id = $1 AND purpose = $2 AND used = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id, purpose]
    );
    if (otpRes.rows.length === 0) throw new AppError('OTP not found', 400);
    const otp = otpRes.rows[0];
    if (new Date(otp.expires_at) < new Date()) throw new AppError('OTP expired', 400);
    if ((otp.attempts || 0) >= 5) throw new AppError('Too many attempts', 429);

    const expected = hashOtp(String(code), otp.destination, otp.purpose);
    const ok = safeEqual(expected, otp.code_hash);

    await query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [otp.id]).catch(() => {});

    if (!ok) throw new AppError('Invalid OTP', 400);

    await query('UPDATE otp_codes SET used = true WHERE id = $1', [otp.id]);
    if (purpose === 'register') {
      await query('UPDATE users SET email_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    }
    if (purpose === 'fundi_approval') {
      if (user.role !== 'fundi') {
        throw new AppError('Fundi OTP can only be verified after approval', 400);
      }
      await query('UPDATE users SET fundi_otp_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    }

    // Issue a token with the latest role (role can change after approval)
    const fresh = await query('SELECT role FROM users WHERE id = $1', [user.id]);
    const role = fresh.rows[0]?.role || user.role;
    const token = generateToken(user.id, user.email, role);

    res.json({
      success: true,
      message: 'OTP verified',
      user: { id: user.id, email: user.email, role },
      token,
    });
  } catch (error) {
    next(error);
  }
});

// Sign up
router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, fullName, role } = req.body;

    if (!email || !password || !fullName) {
      throw new AppError('Email, password, and full name are required', 400);
    }

    // Prevent normal users from registering with the reserved admin email.
    const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (ADMIN_EMAIL && String(email).trim().toLowerCase() === ADMIN_EMAIL) {
      throw new AppError('This email is reserved for the admin account. Use a different email for customer/fundi signup.', 400);
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
    // Support fundi onboarding without turning the user into a customer.
    // - customer (default)
    // - fundi -> fundi_pending (promoted to fundi after admin approval)
    const requestedRole = (role || 'customer').toString().toLowerCase();
    const dbRole = requestedRole === 'fundi' ? 'fundi_pending' : 'customer';
    const result = await query(
      `INSERT INTO users (id, email, password_hash, full_name, role, email_verified)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, email, full_name, role`,
      [userId, email, passwordHash, fullName, dbRole]
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.email, user.role);

    // Create profile
    await query(
      `INSERT INTO profiles (user_id, full_name)
       VALUES ($1, $2)`,
      [user.id, user.full_name]
    );

    // Audit (system event)
    await query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, metadata, created_at)
       VALUES (NULL, 'system', $1, 'users', $2, $3, NOW())`,
      [
        dbRole === 'fundi_pending' ? 'user.signup_fundi' : 'user.signup_customer',
        user.id,
        JSON.stringify({ email: user.email }),
      ]
    ).catch(() => {});

    // Notify admin (best-effort) for dashboard awareness
    try {
      const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'emmanuelevian@gmail.com';
      const subject = dbRole === 'fundi_pending' ? 'New fundi signup' : 'New customer signup';
      const text = `${fullName} (${email}) signed up as ${dbRole === 'fundi_pending' ? 'a fundi applicant' : 'a customer'}.`;
      const html = `<p><strong>${fullName}</strong> (${email}) signed up as <strong>${dbRole === 'fundi_pending' ? 'a fundi applicant' : 'a customer'}</strong>.</p>`;
      await sendMail(ADMIN_EMAIL, subject, text, html);
    } catch (err) {
      console.error('Failed to notify admin of signup:', err.message);
    }

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
      'SELECT id, email, password_hash, full_name, role, email_verified FROM users WHERE email = $1',
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

    // Enforce verification only when explicitly unverified; older accounts may have NULL
    if (user.email_verified === false) {
      throw new AppError('Account not verified. Please verify OTP.', 403);
    }

    // Enforce single admin account: only configured admin email may log in as admin
    const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'emmanuelevian@gmail.com').trim().toLowerCase();
    if (user.role === 'admin' && String(user.email).trim().toLowerCase() !== ADMIN_EMAIL) {
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
    const token = uuidv4();
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
