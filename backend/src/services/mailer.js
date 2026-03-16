import nodemailer from 'nodemailer';
import '../env.js';

const SMTP_HOST = (process.env.SMTP_HOST || '').trim();
const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = (process.env.SMTP_USER || '').trim();
// Common gotcha: Gmail app passwords are shown as "xxxx xxxx xxxx xxxx" but must be used without spaces.
const SMTP_PASS = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
const FROM_EMAIL = (process.env.FROM_EMAIL || SMTP_USER || 'no-reply@fixitconnect.com').trim();
const REQUIRE_SMTP = process.env.REQUIRE_SMTP === 'true' || process.env.NODE_ENV === 'production';
const SMTP_DEBUG = process.env.SMTP_DEBUG === 'true';

let transporter = null;

export function isSmtpConfigured() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

export function smtpMissingKeys() {
  return [
    !SMTP_HOST ? 'SMTP_HOST' : null,
    !SMTP_USER ? 'SMTP_USER' : null,
    !SMTP_PASS ? 'SMTP_PASS' : null,
  ].filter(Boolean);
}

if (isSmtpConfigured()) {
  const shouldRequireTls = !SMTP_SECURE && SMTP_PORT === 587;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    // Port 587 should upgrade via STARTTLS; this avoids some provider quirks.
    requireTLS: shouldRequireTls,
    logger: SMTP_DEBUG,
    debug: SMTP_DEBUG,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
} else {
  // Fallback transporter that logs emails to console (dev only).
  // In production we require SMTP to avoid silently "sending" OTPs.
  transporter = {
    sendMail: async (msg) => {
      if (REQUIRE_SMTP) {
        const missing = smtpMissingKeys().join(', ');
        throw new Error(`SMTP is not configured (${missing}). OTP emails cannot be delivered.`);
      }
      console.log('\n---- Email (logged) ----');
      console.log('From:', msg.from);
      console.log('To:', msg.to);
      console.log('Subject:', msg.subject);
      console.log('Text:', msg.text);
      if (msg.html) console.log('HTML:', msg.html);
      console.log('---- End Email ----\n');
      return Promise.resolve({ accepted: [msg.to] });
    }
  };
}

export async function sendMail(to, subject, text, html = null) {
  const msg = {
    from: FROM_EMAIL,
    to,
    subject,
    text,
    html
  };

  try {
    const result = await transporter.sendMail(msg);
    return result;
  } catch (err) {
    console.error('Error sending email:', err.message);
    throw err;
  }
}
