import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { AppError } from '../utils/errors.js';
import { authMiddleware, adminOnly, requireRole } from '../middlewares/auth.js';
import { emitToUser } from '../services/realtime.js';
import { mpesaIsConfigured, mpesaStkPush, parseMpesaStkCallback } from '../services/mpesa.js';

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

/**
 * Get payment for a job
 */
router.get('/job/:jobId', authMiddleware, async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.userId;

    const result = await query(
      `SELECT p.* FROM payments p
       JOIN jobs j ON j.id = p.job_id
       WHERE p.job_id = $1 AND (j.customer_id = $2 OR j.fundi_id = $2)`,
      [jobId, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Payment not found', 404);
    }

    const payment = result.rows[0];

    res.json({
      success: true,
      payment: {
        id: payment.id,
        jobId: payment.job_id,
        amount: parseFloat(payment.amount),
        platformFee: parseFloat(payment.platform_fee),
        fundiEarnings: parseFloat(payment.fundi_earnings),
        paymentMethod: payment.payment_method,
        status: payment.payment_status,
        transactionId: payment.transaction_id,
        createdAt: payment.created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Wallet balance (fundi only) - API contract alias
 */
router.get('/wallet/balance', authMiddleware, requireRole('fundi'), async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const w = await query('SELECT balance FROM fundi_wallets WHERE user_id = $1', [userId]);
    const balance = w.rows.length > 0 ? parseFloat(w.rows[0].balance) : 0;
    res.json({ success: true, balance });
  } catch (error) {
    next(error);
  }
});

/**
 * Wallet credit (admin only) - manual adjustments
 */
router.post('/wallet/credit', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const { userId, amount, description } = req.body || {};
    if (!userId) throw new AppError('userId is required', 400);
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new AppError('amount must be > 0', 400);

    await query(
      `INSERT INTO fundi_wallets (user_id, balance, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET balance = fundi_wallets.balance + EXCLUDED.balance, updated_at = NOW()`,
      [userId, amt]
    );
    await query(
      `INSERT INTO fundi_wallet_transactions (user_id, amount, type, source, description, created_at)
       VALUES ($1, $2, 'credit', 'admin', $3, NOW())`,
      [userId, amt, description || 'Admin wallet credit']
    ).catch(() => {});

    res.json({ success: true, message: 'Wallet credited' });
  } catch (error) {
    next(error);
  }
});

/**
 * Process payment for completed job
 * Initiates an M-Pesa STK push (no fabricated transactions).
 */
router.post('/process/:jobId', authMiddleware, async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { paymentMethod = 'mpesa', mpesaNumber } = req.body;
    const userId = req.user.userId;

    // Get job
    const jobRes = await query('SELECT * FROM jobs WHERE id = $1', [jobId]);
    if (jobRes.rows.length === 0) {
      throw new AppError('Job not found', 404);
    }
    const job = jobRes.rows[0];

    // Verify caller is customer
    if (job.customer_id !== userId) {
      throw new AppError('Only job customer can process payment', 403);
    }

    if (job.status !== 'completed') {
      throw new AppError('Job must be completed before payment', 400);
    }
    if (!job.customer_completion_confirmed) {
      throw new AppError('Customer must confirm completion with OTP before payment', 403);
    }

    // Get existing payment record
    const paymentRes = await query(
      'SELECT * FROM payments WHERE job_id = $1',
      [jobId]
    );

    if (paymentRes.rows.length === 0) {
      throw new AppError('Payment record not found', 404);
    }

    const payment = paymentRes.rows[0];

    if (payment.payment_status !== 'pending') {
      throw new AppError(`Payment already ${payment.payment_status}`, 400);
    }

    if (paymentMethod !== 'mpesa') {
      throw new AppError('Unsupported payment method (only mpesa is implemented)', 400);
    }

    if (!mpesaIsConfigured()) {
      throw new AppError('M-Pesa is not configured on the server. Set MPESA_* env vars.', 503);
    }

    const phone = normalizeKenyanPhone(mpesaNumber || job.mpesa_number || job.phone);
    if (!phone) throw new AppError('mpesaNumber is required', 400);

    // Mark payment as processing before making the external call (prevents double-submits)
    await query(
      `UPDATE payments SET payment_method = 'mpesa', payment_status = 'processing' WHERE id = $1`,
      [payment.id]
    );

    let mpesaRes;
    try {
      mpesaRes = await mpesaStkPush({
        amount: payment.amount,
        phoneNumber: phone,
        accountReference: `JOB-${jobId}`,
        transactionDesc: `FixIt job payment ${jobId}`,
      });
    } catch (err) {
      await query(`UPDATE payments SET payment_status = 'pending' WHERE id = $1`, [payment.id]);
      throw new AppError(err.message || 'Failed to initiate M-Pesa payment', 502);
    }

    const merchantRequestId = mpesaRes.MerchantRequestID || null;
    const checkoutRequestId = mpesaRes.CheckoutRequestID || null;

    // Persist transaction request
    await query(
      `INSERT INTO mpesa_transactions (payment_id, job_id, phone_number, amount, merchant_request_id, checkout_request_id, status, raw)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [payment.id, jobId, phone, payment.amount, merchantRequestId, checkoutRequestId, 'initiated', JSON.stringify(mpesaRes)]
    );

    // Store checkout request id as transaction_id for easy lookup
    const updated = await query(
      `UPDATE payments SET transaction_id = $1 WHERE id = $2 RETURNING *`,
      [checkoutRequestId, payment.id]
    );

    res.json({
      success: true,
      message: 'M-Pesa STK push initiated',
      mpesa: {
        merchantRequestId,
        checkoutRequestId,
        responseCode: mpesaRes.ResponseCode,
        responseDescription: mpesaRes.ResponseDescription,
        customerMessage: mpesaRes.CustomerMessage,
      },
      payment: {
        id: updated.rows[0].id,
        status: updated.rows[0].payment_status,
        amount: parseFloat(updated.rows[0].amount),
        fundiEarnings: parseFloat(updated.rows[0].fundi_earnings),
        transactionId: updated.rows[0].transaction_id,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * M-Pesa callback (Daraja STK callback)
 * NOTE: This endpoint must be publicly reachable (use a reverse proxy / ngrok in dev).
 */
router.post('/mpesa/callback', express.json({ type: '*/*' }), async (req, res) => {
  // Always return quickly; M-Pesa expects an HTTP 200.
  try {
    const parsed = parseMpesaStkCallback(req.body);
    if (!parsed || !parsed.checkoutRequestId) {
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const txRes = await query(
      `SELECT * FROM mpesa_transactions WHERE checkout_request_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [parsed.checkoutRequestId]
    );
    if (txRes.rows.length === 0) {
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const tx = txRes.rows[0];
    const kind = tx.kind || 'job';

    // Update transaction record (idempotent)
    await query(
      `UPDATE mpesa_transactions
       SET result_code = $1, result_desc = $2, receipt_number = $3, status = $4, raw = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [
        parsed.resultCode,
        parsed.resultDesc,
        parsed.mpesaReceiptNumber,
        parsed.resultCode === 0 ? 'success' : 'failed',
        JSON.stringify(req.body),
        tx.id,
      ]
    );

    // Apply business effects on success/failure
    if (parsed.resultCode === 0) {
      if (kind === 'subscription') {
        const receipt = parsed.mpesaReceiptNumber || parsed.checkoutRequestId;
        await query(
          `UPDATE subscription_payments
           SET payment_status = 'completed', transaction_id = $1
           WHERE id = $2 AND payment_status != 'completed'`,
          [receipt, tx.subscription_payment_id]
        ).catch(() => {});

        const plan = tx.plan || 'monthly';
        const months = plan === 'quarterly' ? 3 : plan === 'yearly' ? 12 : 1;
        const profRes = await query(
          `SELECT subscription_expires_at FROM fundi_profiles WHERE user_id = $1`,
          [tx.fundi_id]
        );
        const now = new Date();
        const base = profRes.rows[0]?.subscription_expires_at && new Date(profRes.rows[0].subscription_expires_at) > now
          ? new Date(profRes.rows[0].subscription_expires_at)
          : now;
        const newExpiry = new Date(base);
        newExpiry.setMonth(newExpiry.getMonth() + months);

        await query(
          `UPDATE fundi_profiles
           SET subscription_active = true, subscription_expires_at = $1, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $2`,
          [newExpiry, tx.fundi_id]
        );

        try {
          emitToUser(tx.fundi_id, 'subscription:active', { plan, expiresAt: newExpiry.toISOString(), transactionId: receipt });
        } catch {
          // ignore
        }
      } else {
        const paymentRes = await query(
          `UPDATE payments
           SET payment_status = 'completed', transaction_id = $1
           WHERE id = $2 AND payment_status != 'completed'
           RETURNING *`,
          [parsed.mpesaReceiptNumber || parsed.checkoutRequestId, tx.payment_id]
        );

        if (paymentRes.rows.length > 0) {
          const payment = paymentRes.rows[0];

          // Credit fundi wallet exactly once per payment
          await query(
            `INSERT INTO fundi_wallets (user_id, balance, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (user_id) DO UPDATE SET balance = fundi_wallets.balance + EXCLUDED.balance, updated_at = NOW()`,
            [payment.fundi_id, payment.fundi_earnings]
          );

          await query(
            `INSERT INTO fundi_wallet_transactions (user_id, amount, type, source, job_id, description, created_at)
             VALUES ($1, $2, 'credit', 'payment', $3, $4, NOW())`,
            [payment.fundi_id, payment.fundi_earnings, payment.job_id, `Payment received for job ${payment.job_id}`]
          ).catch(() => {});

          // Mark job completed
          await query(
            `UPDATE jobs SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [payment.job_id]
          );

          // Notify both parties
          try {
            emitToUser(payment.fundi_id, 'payment:received', {
              jobId: payment.job_id,
              amount: parseFloat(payment.fundi_earnings),
              transactionId: payment.transaction_id,
            });
            emitToUser(payment.customer_id, 'payment:confirmed', {
              jobId: payment.job_id,
              amount: parseFloat(payment.amount),
              transactionId: payment.transaction_id,
            });
          } catch {
            // ignore
          }
        }
      }
    } else {
      if (kind === 'subscription') {
        await query(
          `UPDATE subscription_payments SET payment_status = 'pending' WHERE id = $1 AND payment_status = 'processing'`,
          [tx.subscription_payment_id]
        ).catch(() => {});
      } else {
        // Reset payment back to pending if it was marked processing
        await query(
          `UPDATE payments SET payment_status = 'pending' WHERE id = $1 AND payment_status = 'processing'`,
          [tx.payment_id]
        ).catch(() => {});
      }
    }
  } catch (err) {
    console.error('M-Pesa callback handling failed:', err.message);
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

/**
 * Get customer's payment history
 */
router.get('/history', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Check if customer or fundi
    const userRes = await query('SELECT role FROM users WHERE id = $1', [userId]);
    const role = userRes.rows[0]?.role;

    let sqlQuery, params;
    if (role === 'fundi') {
      // Fundi - show earnings
      sqlQuery = `
        SELECT p.* FROM payments p
        WHERE p.fundi_id = $1
        ORDER BY p.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [userId, limit, offset];
    } else {
      // Customer - show payments made
      sqlQuery = `
        SELECT p.* FROM payments p
        WHERE p.customer_id = $1
        ORDER BY p.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [userId, limit, offset];
    }

    const result = await query(sqlQuery, params);

    // Get total count
    const countRes = await query(
      role === 'fundi'
        ? 'SELECT COUNT(*) as count FROM payments WHERE fundi_id = $1'
        : 'SELECT COUNT(*) as count FROM payments WHERE customer_id = $1',
      [userId]
    );
    const totalCount = parseInt(countRes.rows[0].count) || 0;

    res.json({
      success: true,
      payments: result.rows.map(p => ({
        id: p.id,
        jobId: p.job_id,
        customerId: p.customer_id,
        fundiId: p.fundi_id,
        amount: parseFloat(p.amount),
        platformFee: parseFloat(p.platform_fee),
        fundiEarnings: parseFloat(p.fundi_earnings),
        paymentMethod: p.payment_method,
        status: p.payment_status,
        transactionId: p.transaction_id,
        createdAt: p.created_at
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
 * Get fundi's withdrawal requests
 */
router.get('/withdrawals', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Verify fundi
    const fundiRes = await query('SELECT id FROM fundi_profiles WHERE user_id = $1', [userId]);
    if (fundiRes.rows.length === 0) {
      throw new AppError('Not a fundi', 403);
    }

    const result = await query(
      'SELECT * FROM fundi_withdrawals WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json({
      success: true,
      withdrawals: result.rows.map(w => ({
        id: w.id,
        amount: parseFloat(w.amount),
        mpesaNumber: w.mpesa_number,
        status: w.status,
        processedAt: w.processed_at,
        createdAt: w.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
});

export default router;
