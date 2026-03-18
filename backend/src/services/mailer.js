import nodemailer from 'nodemailer';
import '../env.js';

const EMAIL_TRANSPORT = (process.env.EMAIL_TRANSPORT || 'auto').trim().toLowerCase();

const SMTP_HOST = (process.env.SMTP_HOST || '').trim();
const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = (process.env.SMTP_USER || '').trim();
// Common gotcha: Gmail app passwords are shown as "xxxx xxxx xxxx xxxx" but must be used without spaces.
const SMTP_PASS = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
const FROM_EMAIL = (process.env.FROM_EMAIL || SMTP_USER || 'no-reply@fixitconnect.com').trim();
const REQUIRE_SMTP = process.env.REQUIRE_SMTP === 'true' || process.env.NODE_ENV === 'production';
const SMTP_DEBUG = process.env.SMTP_DEBUG === 'true';

const RESEND_API_KEY = (process.env.RESEND_API_KEY || '').trim();
const SENDGRID_API_KEY = (process.env.SENDGRID_API_KEY || '').trim();

let transporter = null;

function isSmtpEnvConfigured() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

function smtpMissingKeysInternal() {
  return [!SMTP_HOST ? 'SMTP_HOST' : null, !SMTP_USER ? 'SMTP_USER' : null, !SMTP_PASS ? 'SMTP_PASS' : null].filter(
    Boolean
  );
}

export function emailMissingKeys() {
  const transport = EMAIL_TRANSPORT === 'auto' ? (isSmtpEnvConfigured() ? 'smtp' : 'log') : EMAIL_TRANSPORT;
  if (transport === 'smtp') return smtpMissingKeysInternal();
  if (transport === 'resend') return [!RESEND_API_KEY ? 'RESEND_API_KEY' : null].filter(Boolean);
  if (transport === 'sendgrid') return [!SENDGRID_API_KEY ? 'SENDGRID_API_KEY' : null].filter(Boolean);
  return [];
}

export function isEmailConfigured() {
  const transport = EMAIL_TRANSPORT === 'auto' ? (isSmtpEnvConfigured() ? 'smtp' : 'log') : EMAIL_TRANSPORT;
  if (transport === 'smtp') return isSmtpEnvConfigured();
  if (transport === 'resend') return Boolean(RESEND_API_KEY);
  if (transport === 'sendgrid') return Boolean(SENDGRID_API_KEY);
  if (transport === 'log') return !REQUIRE_SMTP;
  return false;
}

// Backwards-compat exports (older routes refer to SMTP)
export function isSmtpConfigured() {
  return isEmailConfigured();
}

export function smtpMissingKeys() {
  return emailMissingKeys();
}

async function resendSend(msg) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: msg.from,
      to: Array.isArray(msg.to) ? msg.to : [msg.to],
      subject: msg.subject,
      text: msg.text,
      html: msg.html || undefined,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend email failed (${res.status}): ${body || res.statusText}`);
  }
  return res.json().catch(() => ({}));
}

async function sendgridSend(msg) {
  const fromEmail = (() => {
    const raw = String(msg.from || '').trim();
    const m = raw.match(/<([^>]+)>/);
    return (m ? m[1] : raw).trim();
  })();

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: msg.to }], subject: msg.subject }],
      from: { email: fromEmail },
      content: [
        { type: 'text/plain', value: msg.text || '' },
        ...(msg.html ? [{ type: 'text/html', value: msg.html }] : []),
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SendGrid email failed (${res.status}): ${body || res.statusText}`);
  }
  return { accepted: [msg.to] };
}

const effectiveTransport = EMAIL_TRANSPORT === 'auto' ? (isSmtpEnvConfigured() ? 'smtp' : 'log') : EMAIL_TRANSPORT;

if (effectiveTransport === 'smtp' && isSmtpEnvConfigured()) {
  const shouldRequireTls = !SMTP_SECURE && SMTP_PORT === 587;
  const connectionTimeout = process.env.SMTP_CONNECTION_TIMEOUT
    ? parseInt(process.env.SMTP_CONNECTION_TIMEOUT, 10)
    : 8000;
  const greetingTimeout = process.env.SMTP_GREETING_TIMEOUT
    ? parseInt(process.env.SMTP_GREETING_TIMEOUT, 10)
    : 8000;
  const socketTimeout = process.env.SMTP_SOCKET_TIMEOUT
    ? parseInt(process.env.SMTP_SOCKET_TIMEOUT, 10)
    : 15000;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    // Port 587 should upgrade via STARTTLS; this avoids some provider quirks.
    requireTLS: shouldRequireTls,
    connectionTimeout,
    greetingTimeout,
    socketTimeout,
    logger: SMTP_DEBUG,
    debug: SMTP_DEBUG,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
} else {
  // Non-SMTP transports.
  transporter = {
    sendMail: async (msg) => {
      if (effectiveTransport === 'resend') {
        if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured.');
        return resendSend(msg);
      }
      if (effectiveTransport === 'sendgrid') {
        if (!SENDGRID_API_KEY) throw new Error('SENDGRID_API_KEY is not configured.');
        return sendgridSend(msg);
      }
      if (effectiveTransport !== 'log' && effectiveTransport !== 'auto') {
        throw new Error(`Unsupported EMAIL_TRANSPORT: ${effectiveTransport}`);
      }

      // Log transport (dev/testing only).
      if (REQUIRE_SMTP) {
        const missing = emailMissingKeys().join(', ');
        throw new Error(
          `Email delivery is not configured (missing: ${missing || 'EMAIL_TRANSPORT config'}). Emails cannot be delivered.`
        );
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
