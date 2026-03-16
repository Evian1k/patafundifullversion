import crypto from 'crypto';

function otpSecret() {
  return process.env.OTP_SECRET || process.env.JWT_SECRET || 'dev-otp-secret-change-in-production';
}

export function generateOtpCode() {
  // 6-digit numeric
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function hashOtp(code, destination, purpose) {
  const secret = otpSecret();
  return crypto
    .createHash('sha256')
    .update(`${secret}|${purpose}|${destination}|${code}`)
    .digest('hex');
}

export function safeEqual(a, b) {
  if (!a || !b) return false;
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

