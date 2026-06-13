const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY ?? "sk_test_56154fd9132773f6618e7e863fd3292887cf0a5e";
export const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY ?? "pk_test_REPLACE_WITH_YOUR_PUBLIC_KEY";
const BASE_URL = "https://api.paystack.co";

export interface PaystackInitResponse {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export async function initializePayment(opts: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackInitResponse> {
  if (!PAYSTACK_SECRET) throw new Error("Paystack not configured");
  const res = await fetch(`${BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      "Content-Type": "application/json",
    },
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
    const err = await res.json();
    throw new Error(err.message ?? "Paystack error");
  }
  const body = await res.json();
  return {
    authorizationUrl: body.data.authorization_url,
    accessCode: body.data.access_code,
    reference: body.data.reference,
  };
}

export async function verifyTransaction(reference: string): Promise<{ status: string; amount: number; paid: boolean }> {
  if (!PAYSTACK_SECRET) throw new Error("Paystack not configured");
  const res = await fetch(`${BASE_URL}/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
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
