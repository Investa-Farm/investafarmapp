import Stripe from "stripe";

const SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
export const STRIPE_PUBLIC_KEY = process.env.STRIPE_PUBLIC_KEY ?? "";

export function isConfigured() {
  return SECRET_KEY.startsWith("sk_");
}

function getStripe() {
  if (!isConfigured()) throw new Error("Stripe not configured");
  return new Stripe(SECRET_KEY, { apiVersion: "2025-04-30" as any });
}

export async function createPaymentIntent(opts: {
  amountKES: number;
  userId: number;
  email: string;
}): Promise<{ clientSecret: string; id: string }> {
  const stripe = getStripe();
  const intent = await stripe.paymentIntents.create({
    amount: Math.round(opts.amountKES * 100),
    currency: "kes",
    metadata: { userId: String(opts.userId), email: opts.email, source: "investa-farm" },
    automatic_payment_methods: { enabled: true },
  });
  return { clientSecret: intent.client_secret!, id: intent.id };
}

export async function retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
  const stripe = getStripe();
  return stripe.paymentIntents.retrieve(id);
}

export function constructWebhookEvent(payload: string | Buffer, sig: string, secret: string): Stripe.Event {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(payload, sig, secret);
}
