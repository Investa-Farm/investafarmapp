/**
 * PesaPal v3 API integration
 *
 * Supports: M-Pesa (KE/TZ/MZ), MTN Mobile Money (UG/RW/GH/ZM),
 *           Airtel Money, Visa/Mastercard cards, and more — via
 *           PesaPal's unified hosted checkout.
 *
 * Docs: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production";
export const BASE = IS_PRODUCTION
  ? "https://pay.pesapal.com/v3"
  : "https://cybqa.pesapal.com/pesapalv3";

// Token cache — PesaPal tokens last ~5 minutes
let _cachedToken: { token: string; expiresAt: number } | null = null;

export function isConfigured(): boolean {
  return !!(process.env.PESAPAL_CONSUMER_KEY && process.env.PESAPAL_CONSUMER_SECRET);
}

async function getAccessToken(): Promise<string> {
  if (_cachedToken && _cachedToken.expiresAt > Date.now() + 30_000) {
    return _cachedToken.token;
  }
  const res = await fetch(`${BASE}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      consumer_key: process.env.PESAPAL_CONSUMER_KEY!,
      consumer_secret: process.env.PESAPAL_CONSUMER_SECRET!,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PesaPal auth failed (${res.status}): ${text}`);
  }
  const data = await res.json() as any;
  if (data.error) throw new Error(`PesaPal auth error: ${JSON.stringify(data.error)}`);
  const token = data.token as string;
  if (!token) throw new Error("PesaPal returned no token");
  _cachedToken = { token, expiresAt: Date.now() + 4 * 60 * 1000 }; // conservative 4 min
  return token;
}

// IPN registration — only needs to happen once per server lifecycle
let _registeredIpnId: string | null = null;

export async function ensureIpnRegistered(ipnUrl: string): Promise<string> {
  if (_registeredIpnId) return _registeredIpnId;
  const token = await getAccessToken();
  const res = await fetch(`${BASE}/api/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url: ipnUrl, ipn_notification_type: "POST" }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PesaPal IPN registration failed (${res.status}): ${text}`);
  }
  const data = await res.json() as any;
  if (data.error) throw new Error(`PesaPal IPN error: ${JSON.stringify(data.error)}`);
  _registeredIpnId = (data.ipn_id ?? data.id) as string;
  if (!_registeredIpnId) throw new Error("PesaPal returned no IPN id");
  return _registeredIpnId;
}

export interface PesaPalOrderResult {
  orderTrackingId: string;
  merchantReference: string;
  redirectUrl: string;
}

export async function submitOrder(opts: {
  /** Unique merchant reference (our internal ref) */
  reference: string;
  amount: number;
  /** ISO 4217 currency — "KES", "UGX", "RWF", "GHS", "ZMW", "USD", etc. */
  currency: string;
  description: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  ipnId: string;
  /** URL PesaPal redirects to after payment */
  callbackUrl: string;
  /**
   * Optional PesaPal payment method code to pre-select on the hosted checkout.
   * Known codes: "mpesa" | "MTN" | "Airtel" | "card"
   * When supplied, PesaPal auto-selects the provider so users skip the method-picker screen.
   */
  paymentMethodCode?: string;
}): Promise<PesaPalOrderResult> {
  if (!isConfigured()) throw new Error("PesaPal not configured — set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET");
  const token = await getAccessToken();

  const body: Record<string, unknown> = {
    id: opts.reference,
    currency: opts.currency,
    amount: opts.amount,
    description: opts.description.slice(0, 100),
    callback_url: opts.callbackUrl,
    notification_id: opts.ipnId,
    billing_address: {
      email_address: opts.email,
      phone_number: opts.phone ?? "",
      // account_number pre-fills the phone field on PesaPal's mobile money checkout
      account_number: opts.phone ?? "",
      country_code: "",
      first_name: opts.firstName ?? "",
      last_name: opts.lastName ?? "",
      line_1: "",
      city: "",
      state: "",
      postal_code: "",
      zip_code: "",
    },
  };

  // Pass payment method hint so PesaPal auto-selects without showing the picker
  if (opts.paymentMethodCode) {
    body["payment_method"] = opts.paymentMethodCode;
  }

  const res = await fetch(`${BASE}/api/Transactions/SubmitOrderRequest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PesaPal order submission failed (${res.status}): ${text}`);
  }
  const data = await res.json() as any;
  if (data.error) throw new Error(`PesaPal order error: ${JSON.stringify(data.error)}`);

  return {
    orderTrackingId: data.order_tracking_id as string,
    merchantReference: data.merchant_reference as string,
    redirectUrl: data.redirect_url as string,
  };
}

export interface PesaPalTransactionStatus {
  orderTrackingId: string;
  merchantReference: string;
  /** e.g. "Completed", "Failed", "Pending", "Invalid" */
  statusCode: string;
  paid: boolean;
  amount: number;
  currency: string;
  paymentMethod: string;
  confirmationCode: string;
  message: string;
}

export async function getTransactionStatus(orderTrackingId: string): Promise<PesaPalTransactionStatus> {
  if (!isConfigured()) throw new Error("PesaPal not configured");
  const token = await getAccessToken();
  const res = await fetch(
    `${BASE}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PesaPal status check failed (${res.status}): ${text}`);
  }
  const data = await res.json() as any;
  const statusCode = (data.payment_status_description ?? data.status ?? "Pending") as string;
  const paid = statusCode === "Completed" || statusCode === "COMPLETED";
  return {
    orderTrackingId: data.order_tracking_id ?? orderTrackingId,
    merchantReference: data.merchant_reference ?? "",
    statusCode,
    paid,
    amount: Number(data.amount ?? 0),
    currency: data.currency ?? "KES",
    paymentMethod: data.payment_method ?? "",
    confirmationCode: data.confirmation_code ?? "",
    message: data.message ?? "",
  };
}
