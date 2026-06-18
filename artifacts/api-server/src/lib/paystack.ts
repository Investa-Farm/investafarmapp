const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY ?? "";
export const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY ?? "";
const BASE = "https://api.paystack.co";

function headers() {
  return {
    Authorization: `Bearer ${PAYSTACK_SECRET}`,
    "Content-Type": "application/json",
  };
}

export function isConfigured() {
  return PAYSTACK_SECRET.startsWith("sk_");
}

export interface PaystackInitResponse {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

/** Initialize a card/bank/general transaction — returns access_code for Popup v2 */
export async function initializePayment(opts: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackInitResponse> {
  if (!isConfigured()) throw new Error("Paystack not configured");
  const res = await fetch(`${BASE}/transaction/initialize`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      email: opts.email,
      amount: opts.amountKobo,
      reference: opts.reference,
      callback_url: opts.callbackUrl,
      metadata: opts.metadata ?? {},
      currency: "KES",
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message ?? `Paystack error ${res.status}`);
  }
  const body = await res.json();
  return {
    authorizationUrl: body.data.authorization_url,
    accessCode: body.data.access_code,
    reference: body.data.reference,
  };
}

/** Verify a transaction by reference */
export async function verifyTransaction(reference: string): Promise<{ status: string; amount: number; paid: boolean }> {
  if (!isConfigured()) throw new Error("Paystack not configured");
  const res = await fetch(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error("Verification failed");
  const body = await res.json();
  const data = body.data;
  return {
    status: data.status,
    amount: data.amount / 100,
    paid: data.status === "success",
  };
}

/** Initiate M-Pesa mobile money charge (STK push via Paystack) */
export async function initiateMpesaCharge(opts: {
  email: string;
  amountKobo: number;
  reference: string;
  phone: string; // "07XXXXXXXX" or "+2547XXXXXXXX"
}): Promise<{ reference: string; status: string; displayText: string }> {
  if (!isConfigured()) throw new Error("Paystack not configured");
  // Normalize phone: Paystack wants "07XXXXXXXX" format for Kenya
  const rawPhone = opts.phone.replace(/\s+/g, "");
  const phone = rawPhone.startsWith("+254")
    ? "0" + rawPhone.slice(4)
    : rawPhone.startsWith("254")
    ? "0" + rawPhone.slice(3)
    : rawPhone;

  const res = await fetch(`${BASE}/charge`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      email: opts.email,
      amount: opts.amountKobo,
      currency: "KES",
      reference: opts.reference,
      mobile_money: { phone, provider: "mpesa" },
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message ?? "M-Pesa charge failed");
  }
  const data = body.data ?? {};
  return {
    reference: data.reference ?? opts.reference,
    status: data.status ?? "pending",
    displayText: data.display_text ?? "STK push sent — check your phone",
  };
}

/** Check current charge status (poll after M-Pesa STK push) */
export async function checkChargeStatus(reference: string): Promise<{ status: string; paid: boolean; amount: number }> {
  if (!isConfigured()) throw new Error("Paystack not configured");
  const res = await fetch(`${BASE}/charge/${encodeURIComponent(reference)}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error("Status check failed");
  const body = await res.json();
  const data = body.data ?? {};
  return {
    status: data.status ?? "pending",
    paid: data.status === "success",
    amount: (data.amount ?? 0) / 100,
  };
}
