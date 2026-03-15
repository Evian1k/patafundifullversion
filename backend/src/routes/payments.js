import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { AppError } from '../utils/errors.js';
import { authMiddleware } from '../middlewares/auth.js';
import { emitToUser } from '../services/realtime.js';

const router = express.Router();

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
 * Process payment for completed job
 * (This would integrate with M-Pesa or card processor in production)
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

    // In production, integrate with M-Pesa or Stripe here
    // For now, just mark as completed
    const transactionId = `TXN-${uuidv4()}`;

    const updateRes = await query(
      `UPDATE payments SET payment_method = $1, payment_status = 'completed', transaction_id = $2, created_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [paymentMethod, transactionId, payment.id]
    );

    const completedPayment = updateRes.rows[0];

    // Notify fundi that payment is received
    try {
      emitToUser(job.fundi_id, 'payment:received', {
        jobId,
        amount: completedPayment.fundi_earnings,
        transactionId,
        message: 'Payment received!'
      });
    } catch (err) {
      console.error('Error notifying fundi of payment:', err.message);
    }

    res.json({
      success: true,
      message: 'Payment processed successfully',
      payment: {
        id: completedPayment.id,
        status: completedPayment.payment_status,
        transactionId: completedPayment.transaction_id,
        amount: parseFloat(completedPayment.amount),
        fundiEarnings: parseFloat(completedPayment.fundi_earnings)
      }
    });
  } catch (error) {
    next(error);
  }
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
