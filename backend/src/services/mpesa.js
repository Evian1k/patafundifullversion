import crypto from 'crypto';

function getMpesaBaseUrl() {
  if (process.env.MPESA_BASE_URL) return process.env.MPESA_BASE_URL;
  const env = (process.env.MPESA_ENV || 'sandbox').toLowerCase();
  return env === 'live' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function mpesaIsConfigured() {
  return Boolean(
    process.env.MPESA_CONSUMER_KEY &&
      process.env.MPESA_CONSUMER_SECRET &&
      process.env.MPESA_SHORTCODE &&
      process.env.MPESA_PASSKEY &&
      process.env.MPESA_CALLBACK_URL
  );
}

export function mpesaTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

export function mpesaPassword(shortCode, passkey, timestamp) {
  return Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');
}

export async function mpesaAccessToken() {
  const consumerKey = requireEnv('MPESA_CONSUMER_KEY');
  const consumerSecret = requireEnv('MPESA_CONSUMER_SECRET');

  const basic = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const baseUrl = getMpesaBaseUrl();
  const url = `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Basic ${basic}` },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`M-Pesa auth failed: ${data.errorMessage || data.error || res.statusText}`);
  }
  if (!data.access_token) throw new Error('M-Pesa auth failed: no access_token returned');

  return data.access_token;
}

export async function mpesaStkPush({
  amount,
  phoneNumber,
  accountReference,
  transactionDesc,
}) {
  const shortCode = requireEnv('MPESA_SHORTCODE');
  const passkey = requireEnv('MPESA_PASSKEY');
  const callbackUrl = requireEnv('MPESA_CALLBACK_URL');

  const ts = mpesaTimestamp();
  const password = mpesaPassword(shortCode, passkey, ts);
  const token = await mpesaAccessToken();

  const baseUrl = getMpesaBaseUrl();
  const url = `${baseUrl}/mpesa/stkpush/v1/processrequest`;

  const body = {
    BusinessShortCode: shortCode,
    Password: password,
    Timestamp: ts,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(Number(amount)),
    PartyA: phoneNumber,
    PartyB: shortCode,
    PhoneNumber: phoneNumber,
    CallBackURL: callbackUrl,
    AccountReference: accountReference,
    TransactionDesc: transactionDesc || 'FixIt Connect payment',
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`M-Pesa STK push failed: ${data.errorMessage || data.error || res.statusText}`);
  }

  return data;
}

export function parseMpesaStkCallback(payload) {
  // Expected shape: { Body: { stkCallback: { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata? } } }
  const cb = payload?.Body?.stkCallback;
  if (!cb) return null;

  const meta = cb.CallbackMetadata?.Item || [];
  const getMeta = (name) => meta.find((i) => i?.Name === name)?.Value;

  return {
    merchantRequestId: cb.MerchantRequestID || null,
    checkoutRequestId: cb.CheckoutRequestID || null,
    resultCode: typeof cb.ResultCode === 'number' ? cb.ResultCode : Number(cb.ResultCode),
    resultDesc: cb.ResultDesc || null,
    amount: getMeta('Amount') != null ? Number(getMeta('Amount')) : null,
    mpesaReceiptNumber: getMeta('MpesaReceiptNumber') || null,
    phoneNumber: getMeta('PhoneNumber') ? String(getMeta('PhoneNumber')) : null,
    transactionDate: getMeta('TransactionDate') ? String(getMeta('TransactionDate')) : null,
    raw: cb,
  };
}

export function makeIdempotencyKey(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

