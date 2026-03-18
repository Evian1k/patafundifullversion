import express from 'express';
import { query } from '../db.js';
import { AppError } from '../utils/errors.js';
import { optionalAuth } from '../middlewares/auth.js';

const router = express.Router();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

// Create a support ticket (public)
router.post('/ticket', optionalAuth, async (req, res, next) => {
  try {
    const {
      name,
      email,
      subject,
      message,
      category = 'general',
      priority,
    } = req.body || {};

    const msg = String(message || '').trim();
    if (!msg) throw new AppError('Message is required', 400);

    const userId = req.user?.userId || null;
    const safeName = name ? String(name).trim().slice(0, 255) : null;
    const safeEmail = email ? String(email).trim().slice(0, 255) : null;
    const safeSubject = subject ? String(subject).trim().slice(0, 255) : null;
    const safeCategory = String(category || 'general').trim().slice(0, 80) || 'general';

    if (safeEmail && !isValidEmail(safeEmail)) throw new AppError('Invalid email address', 400);

    const inferredPriority = (() => {
      const p = String(priority || '').toLowerCase().trim();
      if (p === 'high' || p === 'urgent') return p;
      if (['fraud', 'abuse', 'payment', 'fake-fundi', 'security'].includes(safeCategory.toLowerCase())) return 'high';
      return 'normal';
    })();

    const ticket = await query(
      `INSERT INTO support_tickets (user_id, name, email, subject, message, category, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
       RETURNING id, status, priority, created_at`,
      [userId, safeName, safeEmail, safeSubject, msg, safeCategory, inferredPriority]
    );

    await query(
      `INSERT INTO support_ticket_events (ticket_id, actor_user_id, actor_role, event_type, message, metadata)
       VALUES ($1, $2, $3, 'created', $4, $5)`,
      [
        ticket.rows[0].id,
        userId,
        req.user?.role || null,
        safeSubject || 'Ticket created',
        { category: safeCategory, priority: inferredPriority },
      ]
    );

    res.status(201).json({ success: true, ticket: ticket.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;

