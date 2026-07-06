/**
 * Circle API integration — USDC payments
 * Docs: https://developers.circle.com/circle-mint/docs
 *
 * Uses Circle's Payments API to:
 *  - Accept USDC on-chain deposits (manual or via Circle USDC address)
 *  - Convert USDC → KES and credit the user's wallet
 *
 * Circle API key format: TEST_API_KEY:keyId:keySecret
 * The FULL string is used as the Bearer token.
 */

const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY ?? "";
const BASE = "https://api-sandbox.circle.com/v1";

export function isCircleConfigured(): boolean {
  return CIRCLE_API_KEY.length > 10;
}

function headers() {
  return {
    Authorization: `Bearer ${CIRCLE_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/** KES per 1 USDC — approximate live rate (falls back to a sensible default) */
let _rateCache: { rate: number; ts: number } | null = null;
export async function getKesUsdcRate(): Promise<number> {
  const now = Date.now();
  if (_rateCache && now - _rateCache.ts < 5 * 60 * 1000) return _rateCache.rate;
  try {
    const r = await fetch("https://api.exchangerate-api.com/v4/latest/USD", { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const data = await r.json() as any;
      const rate = (data.rates?.KES ?? 130) as number;
      _rateCache = { rate, ts: now };
      return rate;
    }
  } catch { /* fall through */ }
  return _rateCache?.rate ?? 130;
}

export interface CirclePaymentIntent {
  id: string;
  status: string;
  amount: { amount: string; currency: string };
  settlementCurrency: string;
}

/** Create a Circle payment intent for USDC on-chain */
export async function createPaymentIntent(opts: {
  amountUSDC: string;
  idempotencyKey: string;
}): Promise<{ id: string; depositAddress: { address: string; chain: string; currency: string } }> {
  if (!isCircleConfigured()) throw new Error("Circle not configured");
  const res = await fetch(`${BASE}/paymentIntents`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      idempotencyKey: opts.idempotencyKey,
      amount: { amount: opts.amountUSDC, currency: "USD" },
      settlementCurrency: "USD",
      paymentMethods: [{ type: "blockchain", chain: "MATIC" }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message ?? `Circle error ${res.status}`);
  }
  const body = await res.json() as any;
  const data = body.data ?? body;
  const address = (data.paymentMethods?.[0]?.address) ?? (data.depositAddress?.address) ?? "";
  const chain = (data.paymentMethods?.[0]?.chain) ?? "MATIC";
  return {
    id: data.id,
    depositAddress: { address, chain, currency: "USDC" },
  };
}

/** Get status of a payment intent */
export async function getPaymentIntentStatus(id: string): Promise<{
  status: string;
  paid: boolean;
  amountUsdc: string;
}> {
  if (!isCircleConfigured()) throw new Error("Circle not configured");
  const res = await fetch(`${BASE}/paymentIntents/${id}`, { headers: headers() });
  if (!res.ok) throw new Error("Status fetch failed");
  const body = await res.json() as any;
  const data = body.data ?? body;
  const paid = data.status === "complete" || data.status === "paid";
  return {
    status: data.status ?? "pending",
    paid,
    amountUsdc: data.amount?.amount ?? "0",
  };
}

/** Generate a static USDC deposit address per user */
export function getStaticUsdcAddress(userId: number): { address: string; chain: string; memo: string } {
  const platformAddress = process.env.USDC_DEPOSIT_ADDRESS ?? "0x742d35Cc6634C0532925a3b8D4C9E28E4b9A5bEf";
  return {
    address: platformAddress,
    chain: "Polygon (MATIC)",
    memo: `IF-${String(userId).padStart(6, "0")}`,
  };
}
