import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@fixitconnect.com';

let transporter = null;

if (SMTP_HOST && SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
} else {
  // Fallback transporter that logs emails to console
  transporter = {
    sendMail: async (msg) => {
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
