import { createHmac } from "crypto";

const BASE = "https://sandbox.safaricom.co.ke";

function isConfigured() {
  return !!(process.env.DARAJA_CONSUMER_KEY && process.env.DARAJA_CONSUMER_SECRET);
}

async function getAccessToken(): Promise<string> {
  const key = process.env.DARAJA_CONSUMER_KEY!;
  const secret = process.env.DARAJA_CONSUMER_SECRET!;
  const credentials = Buffer.from(`${key}:${secret}`).toString("base64");

  const res = await fetch(`${BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Daraja OAuth failed (${res.status}): ${text}`);
  }

  const body = await res.json() as any;
  return body.access_token as string;
}

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

function getPassword(shortcode: string, passkey: string, timestamp: string): string {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
}

const SHORTCODE = process.env.DARAJA_SHORTCODE ?? "174379";
const PASSKEY = process.env.DARAJA_PASSKEY ?? "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
const CALLBACK_URL = process.env.DARAJA_CALLBACK_URL ?? `${process.env.APP_URL ?? "https://investafarm.com"}/api/wallet/daraja/callback`;

export function isDarajaConfigured() {
  return isConfigured();
}

export interface StkPushResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}

export async function initiateStkPush(opts: {
  phone: string;
  amountKES: number;
  reference: string;
  description?: string;
}): Promise<StkPushResult> {
  if (!isConfigured()) throw new Error("Daraja not configured — set DARAJA_CONSUMER_KEY and DARAJA_CONSUMER_SECRET");

  const token = await getAccessToken();
  const timestamp = getTimestamp();
  const password = getPassword(SHORTCODE, PASSKEY, timestamp);

  let phone = opts.phone.replace(/[\s\-().]/g, "");
  if (phone.startsWith("+")) phone = phone.slice(1);
  if (phone.startsWith("0")) phone = "254" + phone.slice(1);
  if (!phone.startsWith("254")) phone = "254" + phone;

  const amount = Math.ceil(opts.amountKES);

  const body = {
    BusinessShortCode: SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phone,
    PartyB: SHORTCODE,
    PhoneNumber: phone,
    CallBackURL: CALLBACK_URL,
    AccountReference: opts.reference.slice(0, 12),
    TransactionDesc: (opts.description ?? "Investa Farm deposit").slice(0, 13),
  };

  const res = await fetch(`${BASE}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as any;
  if (!res.ok || data.errorCode) {
    throw new Error(data.errorMessage ?? data.ResultDesc ?? `STK push failed (${res.status})`);
  }

  return {
    checkoutRequestId: data.CheckoutRequestID,
    merchantRequestId: data.MerchantRequestID,
    responseCode: data.ResponseCode,
    responseDescription: data.ResponseDescription,
    customerMessage: data.CustomerMessage,
  };
}

export async function queryStkStatus(checkoutRequestId: string): Promise<{
  resultCode: string;
  resultDesc: string;
  paid: boolean;
}> {
  if (!isConfigured()) throw new Error("Daraja not configured");

  const token = await getAccessToken();
  const timestamp = getTimestamp();
  const password = getPassword(SHORTCODE, PASSKEY, timestamp);

  const res = await fetch(`${BASE}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });

  const data = await res.json() as any;

  if (data.errorCode === "500.001.1001") {
    return { resultCode: "pending", resultDesc: "Transaction pending", paid: false };
  }

  if (!res.ok && !data.ResultCode) {
    throw new Error(data.errorMessage ?? `Query failed (${res.status})`);
  }

  const code = String(data.ResultCode ?? data.resultCode ?? "pending");
  return {
    resultCode: code,
    resultDesc: data.ResultDesc ?? data.resultDesc ?? "",
    paid: code === "0",
  };
}
