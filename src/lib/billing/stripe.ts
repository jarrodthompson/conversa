import Stripe from "stripe";

/** True when Stripe secret + webhook are configured on the server. */
export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let cached: Stripe | null = null;

/** Returns a Stripe client, or throws if not configured. Server-only. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  if (!cached) cached = new Stripe(key);
  return cached;
}
