import express from 'express';
import { query } from '../db.js';
import { AppError } from '../utils/errors.js';
import { authMiddleware } from '../middlewares/auth.js';
import { comparePassword, hashPassword } from '../utils/password.js';

const router = express.Router();

function toBool(v, fallback) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  return fallback;
}

async function audit(actor, action, entityType = null, entityId = null, metadata = null, req = null) {
  try {
    await query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      [
        actor?.userId || null,
        actor?.role || null,
        action,
        entityType,
        entityId,
        metadata ? JSON.stringify(metadata) : null,
        req?.ip || null,
        req?.headers?.['user-agent'] || null,
      ],
    );
  } catch {
    // ignore audit failures
  }
}

// Get current user (expanded profile fields for settings UI)
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const r = await query(
      `SELECT id, email, full_name, phone, role, status, email_verified, phone_verified, fundi_otp_verified
       FROM users
       WHERE id = $1`,
      [userId],
    );
    if (r.rows.length === 0) throw new AppError('User not found', 404);
    const u = r.rows[0];
    res.json({
      success: true,
      user: {
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        phone: u.phone,
        role: u.role,
        status: u.status,
        emailVerified: u.email_verified,
        phoneVerified: u.phone_verified,
        fundiOtpVerified: u.fundi_otp_verified,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Update personal info (name/phone)
router.put('/me', authMiddleware, async (req, res, next) => {
  try {
    const { fullName, phone } = req.body || {};
    if (!fullName && !phone) throw new AppError('Nothing to update', 400);

    const userId = req.user.userId;
    const updated = await query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, email, full_name, phone, role, status, email_verified, phone_verified`,
      [fullName || null, phone || null, userId],
    );
    if (updated.rows.length === 0) throw new AppError('User not found', 404);

    // Keep profiles table in sync (best-effort)
    await query(
      `INSERT INTO profiles (user_id, full_name, phone)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         phone = EXCLUDED.phone,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, fullName || updated.rows[0].full_name || null, phone || updated.rows[0].phone || null],
    ).catch(() => {});

    await audit(req.user, 'user.update_profile', 'users', userId, { fullName: !!fullName, phone: !!phone }, req);
    res.json({ success: true, user: updated.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Get settings
router.get('/settings', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const s = await query('SELECT * FROM user_settings WHERE user_id = $1', [userId]);
    if (s.rows.length === 0) {
      // create defaults
      await query('INSERT INTO user_settings (user_id) VALUES ($1)', [userId]).catch(() => {});
      const s2 = await query('SELECT * FROM user_settings WHERE user_id = $1', [userId]);
      return res.json({ success: true, settings: s2.rows[0] });
    }
    res.json({ success: true, settings: s.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Update settings
router.put('/settings', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const {
      safetyAlerts,
      shareEmergencyContact,
      hideProfile,
      marketingOptIn,
      shareLocation,
    } = req.body || {};

    const updated = await query(
      `INSERT INTO user_settings (user_id, safety_alerts, share_emergency_contact, hide_profile, privacy_marketing_opt_in, privacy_share_location, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         safety_alerts = COALESCE(EXCLUDED.safety_alerts, user_settings.safety_alerts),
         share_emergency_contact = COALESCE(EXCLUDED.share_emergency_contact, user_settings.share_emergency_contact),
         hide_profile = COALESCE(EXCLUDED.hide_profile, user_settings.hide_profile),
         privacy_marketing_opt_in = COALESCE(EXCLUDED.privacy_marketing_opt_in, user_settings.privacy_marketing_opt_in),
         privacy_share_location = COALESCE(EXCLUDED.privacy_share_location, user_settings.privacy_share_location),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        userId,
        typeof safetyAlerts === 'undefined' ? null : toBool(safetyAlerts, null),
        typeof shareEmergencyContact === 'undefined' ? null : toBool(shareEmergencyContact, null),
        typeof hideProfile === 'undefined' ? null : toBool(hideProfile, null),
        typeof marketingOptIn === 'undefined' ? null : toBool(marketingOptIn, null),
        typeof shareLocation === 'undefined' ? null : toBool(shareLocation, null),
      ],
    );

    await audit(req.user, 'user.update_settings', 'user_settings', userId, req.body || {}, req);
    res.json({ success: true, settings: updated.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Saved places
router.get('/saved-places', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const r = await query(
      `SELECT id, type, label, address, latitude, longitude, created_at, updated_at
       FROM saved_places
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    res.json({ success: true, places: r.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/saved-places', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { type, label = null, address, latitude = null, longitude = null } = req.body || {};
    if (!type || !['home', 'work', 'other'].includes(type)) throw new AppError('Invalid place type', 400);
    if (!address) throw new AppError('Address is required', 400);

    const r = await query(
      `INSERT INTO saved_places (user_id, type, label, address, latitude, longitude)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, type, label, address, latitude, longitude, created_at, updated_at`,
      [userId, type, label, address, latitude, longitude],
    );
    await audit(req.user, 'user.saved_place.create', 'saved_places', r.rows[0].id, { type }, req);
    res.status(201).json({ success: true, place: r.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/saved-places/:id', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { label, address, latitude, longitude } = req.body || {};
    if (!label && !address && typeof latitude === 'undefined' && typeof longitude === 'undefined') {
      throw new AppError('Nothing to update', 400);
    }

    const r = await query(
      `UPDATE saved_places
       SET label = COALESCE($1, label),
           address = COALESCE($2, address),
           latitude = COALESCE($3, latitude),
           longitude = COALESCE($4, longitude),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND user_id = $6
       RETURNING id, type, label, address, latitude, longitude, created_at, updated_at`,
      [label || null, address || null, latitude ?? null, longitude ?? null, id, userId],
    );
    if (r.rows.length === 0) throw new AppError('Saved place not found', 404);
    await audit(req.user, 'user.saved_place.update', 'saved_places', id, req.body || {}, req);
    res.json({ success: true, place: r.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/saved-places/:id', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const r = await query('DELETE FROM saved_places WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
    if (r.rows.length === 0) throw new AppError('Saved place not found', 404);
    await audit(req.user, 'user.saved_place.delete', 'saved_places', id, null, req);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Change password
router.post('/change-password', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) throw new AppError('Current password and new password are required', 400);
    if (String(newPassword).length < 8) throw new AppError('New password must be at least 8 characters', 400);

    const u = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (u.rows.length === 0) throw new AppError('User not found', 404);

    const ok = await comparePassword(currentPassword, u.rows[0].password_hash);
    if (!ok) throw new AppError('Current password is incorrect', 400);

    const hash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hash, userId]);
    await audit(req.user, 'user.change_password', 'users', userId, null, req);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Delete account (hard delete)
router.post('/delete-account', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { password } = req.body || {};
    if (!password) throw new AppError('Password is required', 400);

    const u = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (u.rows.length === 0) throw new AppError('User not found', 404);

    const ok = await comparePassword(password, u.rows[0].password_hash);
    if (!ok) throw new AppError('Password is incorrect', 400);

    await audit(req.user, 'user.delete_account', 'users', userId, null, req);
    await query('DELETE FROM users WHERE id = $1', [userId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
