import express from 'express';
import { query } from '../db.js';
import { AppError } from '../utils/errors.js';
import { authMiddleware, requireRole } from '../middlewares/auth.js';
import { mpesaIsConfigured, mpesaStkPush } from '../services/mpesa.js';

const router = express.Router();

function normalizeKenyanPhone(phone) {
  if (!phone) return null;
  const raw = String(phone).trim().replace(/\s+/g, '');
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('254') && digits.length >= 12) return digits;
  if (digits.startsWith('+254') && digits.length >= 13) return digits.slice(1);
  if (digits.startsWith('07') && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith('01') && digits.length === 10) return `254${digits.slice(1)}`;
  return digits.replace(/^\+/, '');
}

router.get('/check', authMiddleware, requireRole('fundi'), async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const result = await query(
      'SELECT subscription_active, subscription_expires_at FROM fundi_profiles WHERE user_id = $1',
      [userId]
    );
    if (result.rows.length === 0) throw new AppError('Fundi profile not found', 404);

    const profile = result.rows[0];
    const now = new Date();
    const expiresAt = profile.subscription_expires_at ? new Date(profile.subscription_expires_at) : null;
    const active = profile.subscription_active && (!expiresAt || expiresAt > now);

    res.json({ success: true, subscription: { active, expiresAt: expiresAt?.toISOString() } });
  } catch (error) {
    next(error);
  }
});

router.post('/renew', authMiddleware, requireRole('fundi'), async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { plan = 'monthly', mpesaNumber } = req.body || {};

    const profileRes = await query(
      'SELECT verification_status, mpesa_number FROM fundi_profiles WHERE user_id = $1',
      [userId]
    );
    if (profileRes.rows.length === 0) throw new AppError('Fundi profile not found', 404);
    const profile = profileRes.rows[0];
    if (profile.verification_status !== 'approved') throw new AppError('Your account must be approved before subscribing', 403);

    const pricing = {
      monthly: { amount: 199 },
      quarterly: { amount: 499 },
      yearly: { amount: 1499 },
    };
    if (!pricing[plan]) throw new AppError('Invalid subscription plan', 400);

    if (!mpesaIsConfigured()) throw new AppError('M-Pesa is not configured on the server. Set MPESA_* env vars.', 503);
    const phone = normalizeKenyanPhone(mpesaNumber || profile.mpesa_number);
    if (!phone) throw new AppError('M-Pesa number is required on your profile', 400);

    const { amount } = pricing[plan];
    const spRes = await query(
      `INSERT INTO subscription_payments (fundi_id, plan, amount, payment_status)
       VALUES ($1,$2,$3,'processing')
       RETURNING *`,
      [userId, plan, amount]
    );
    const sp = spRes.rows[0];

    const mpesaRes = await mpesaStkPush({
      amount,
      phoneNumber: phone,
      accountReference: `SUB-${userId}`,
      transactionDesc: `FixIt subscription ${plan}`,
    });

    const merchantRequestId = mpesaRes.MerchantRequestID || null;
    const checkoutRequestId = mpesaRes.CheckoutRequestID || null;

    await query(
      `INSERT INTO mpesa_transactions (payment_id, job_id, kind, fundi_id, subscription_payment_id, plan, phone_number, amount, merchant_request_id, checkout_request_id, status, raw)
       VALUES (NULL, NULL, 'subscription', $1, $2, $3, $4, $5, $6, $7, 'initiated', $8)`,
      [userId, sp.id, plan, phone, amount, merchantRequestId, checkoutRequestId, JSON.stringify(mpesaRes)]
    ).catch(() => {});

    await query(
      `UPDATE subscription_payments SET transaction_id = $1 WHERE id = $2`,
      [checkoutRequestId, sp.id]
    ).catch(() => {});

    res.json({ success: true, subscriptionPayment: { id: sp.id, plan, amount, checkoutRequestId } });
  } catch (error) {
    next(error);
  }
});

export default router;

