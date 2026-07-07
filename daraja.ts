import { generateSecurityCredential } from "./mpesa-security";

const BASE_URL = process.env.MPESA_ENVIRONMENT === "production"
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke";

// ---------------------------------------------------------------------------
// FIX: OAuth token is valid for ~3600s per Daraja docs. The original code
// requested a brand-new token on every single API call, which is wasteful
// and risks hitting Safaricom's rate limits under load. We cache the token
// in memory and only refetch when it's close to expiring.
// ---------------------------------------------------------------------------
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(
    `${process.env.DARAJA_CONSUMER_KEY}:${process.env.DARAJA_CONSUMER_SECRET}`
  ).toString("base64");

  const response = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate OAuth token: ${errorText}`);
  }

  const data = await response.json();

  // expires_in is typically "3599" (seconds). Refresh 60s early to avoid
  // using a token that expires mid-request.
  const expiresInMs = (Number(data.expires_in) || 3600) * 1000;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + expiresInMs - 60_000,
  };

  return cachedToken.token;
}

// ---------------------------------------------------------------------------
// FIX: Daraja expects the timestamp in East Africa Time (UTC+3), formatted
// as yyyyMMddHHmmss. The original implementation used `toISOString()`, which
// is always UTC. If the server running this code isn't already in EAT, every
// request's Password (which is derived from this timestamp) would be
// computed against the wrong clock and Safaricom would reject it with an
// invalid password/timestamp error. We now explicitly compute EAT regardless
// of the server's local timezone.
// ---------------------------------------------------------------------------
function getTimestamp(): string {
  const now = new Date();
  const eatMs = now.getTime() + (now.getTimezoneOffset() * 60_000) + (3 * 60 * 60_000);
  const eat = new Date(eatMs);

  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    eat.getFullYear().toString() +
    pad(eat.getMonth() + 1) +
    pad(eat.getDate()) +
    pad(eat.getHours()) +
    pad(eat.getMinutes()) +
    pad(eat.getSeconds())
  );
}

export async function initiateStkPush(phone: string, amount: number, reference: string) {
  const token = await getAccessToken();
  const timestamp = getTimestamp();
  const password = Buffer.from(
    `${process.env.DARAJA_SHORTCODE}${process.env.DARAJA_PASSKEY}${timestamp}`
  ).toString("base64");

  const response = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: process.env.DARAJA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(amount),
      PartyA: phone,
      PartyB: process.env.DARAJA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: `${process.env.APP_URL}/api/mpesa/stk/callback?key=${process.env.MPESA_CALLBACK_SECRET}`,
      AccountReference: reference.slice(0, 12),
      TransactionDesc: "Investa Farm Payment",
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    // FIX: Daraja error payloads vary between validation-time errors
    // (errorMessage/errorCode) and async result errors. Check both shapes
    // instead of assuming errorMessage is always present.
    throw new Error(data.errorMessage || data.ResponseDescription || "STK Push failed");
  }
  return data;
}

export async function initiateB2CPayout(phone: string, amount: number, remarks: string) {
  const token = await getAccessToken();
  const securityCredential = generateSecurityCredential(process.env.MPESA_INITIATOR_PASSWORD!);

  const response = await fetch(`${BASE_URL}/mpesa/b2c/v1/paymentrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      InitiatorName: process.env.MPESA_INITIATOR_NAME,
      SecurityCredential: securityCredential,
      CommandID: "BusinessPayment",
      Amount: Math.floor(amount),
      PartyA: process.env.DARAJA_SHORTCODE,
      PartyB: phone,
      Remarks: remarks.slice(0, 100),
      QueueTimeOutURL: `${process.env.APP_URL}/api/mpesa/b2c/timeout`,
      ResultURL: `${process.env.APP_URL}/api/mpesa/b2c/result?key=${process.env.MPESA_CALLBACK_SECRET}`,
      Occasion: "Withdrawal",
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.errorMessage || data.ResponseDescription || "B2C Payout failed");
  }
  return data;
}

export async function queryAccountBalance() {
  const token = await getAccessToken();
  const securityCredential = generateSecurityCredential(process.env.MPESA_INITIATOR_PASSWORD!);

  const response = await fetch(`${BASE_URL}/mpesa/accountbalance/v1/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Initiator: process.env.MPESA_INITIATOR_NAME,
      SecurityCredential: securityCredential,
      CommandID: "AccountBalance",
      PartyA: process.env.DARAJA_SHORTCODE,
      IdentifierType: "4",
      Remarks: "Balance Query",
      QueueTimeOutURL: `${process.env.APP_URL}/api/mpesa/balance/timeout`,
      ResultURL: `${process.env.APP_URL}/api/mpesa/balance/result?key=${process.env.MPESA_CALLBACK_SECRET}`,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.errorMessage || data.ResponseDescription || "Balance query failed");
  }
  return data;
}
