#!/usr/bin/env node
import nodemailer from 'nodemailer';
import '../src/env.js';

const SMTP_HOST = (process.env.SMTP_HOST || '').trim();
const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = (process.env.SMTP_USER || '').trim();
const SMTP_PASS = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

function missing() {
  return [
    !SMTP_HOST ? 'SMTP_HOST' : null,
    !SMTP_USER ? 'SMTP_USER' : null,
    !SMTP_PASS ? 'SMTP_PASS' : null,
  ].filter(Boolean);
}

async function main() {
  const miss = missing();
  if (miss.length) {
    console.error(`❌ SMTP not configured (missing: ${miss.join(', ')})`);
    process.exit(1);
  }

  const shouldRequireTls = !SMTP_SECURE && SMTP_PORT === 587;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    requireTLS: shouldRequireTls,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified');
    console.log(`   host=${SMTP_HOST} port=${SMTP_PORT} secure=${SMTP_SECURE}`);
    console.log(`   user=${SMTP_USER}`);
  } catch (err) {
    console.error('❌ SMTP verification failed:', err?.message || String(err));
    process.exit(1);
  }
}

main();

