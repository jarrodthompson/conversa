import crypto from "node:crypto";

const LIVE = process.env.PEACH_MODE === "live";
const AUTH_BASE = LIVE ? "https://dashboard.peachpayments.com" : "https://sandbox-dashboard.peachpayments.com";
const CHECKOUT_BASE = LIVE ? "https://secure.peachpayments.com" : "https://testsecure.peachpayments.com";

/** True when Peach Payments Checkout credentials are configured. */
export function peachConfigured(): boolean {
  return Boolean(
    process.env.PEACH_CLIENT_ID &&
      process.env.PEACH_CLIENT_SECRET &&
      process.env.PEACH_MERCHANT_ID &&
      process.env.PEACH_ENTITY_ID,
  );
}

/** OAuth: exchange client credentials for a short-lived access token (JWT). */
async function getAccessToken(): Promise<string> {
  const res = await fetch(`${AUTH_BASE}/api/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      clientId: process.env.PEACH_CLIENT_ID,
      clientSecret: process.env.PEACH_CLIENT_SECRET,
      merchantId: process.env.PEACH_MERCHANT_ID,
    }),
  });
  if (!res.ok) throw new Error(`Peach auth failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Peach auth returned no access_token");
  return data.access_token;
}

export interface CreateCheckoutInput {
  amount: string; // major units, e.g. "499.00"
  currency: string; // e.g. "ZAR"
  merchantTransactionId: string; // 8-16 chars
  shopperResultUrl: string;
  notificationUrl: string;
}

export interface CreateCheckoutResult {
  checkoutId: string;
  redirectUrl: string;
}

/** Creates a Hosted Checkout (V2) and returns the redirect URL for the customer. */
export async function createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
  const token = await getAccessToken();
  const res = await fetch(`${CHECKOUT_BASE}/v2/checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      entityId: process.env.PEACH_ENTITY_ID,
      amount: input.amount,
      currency: input.currency,
      nonce: crypto.randomUUID(),
      shopperResultUrl: input.shopperResultUrl,
      merchantTransactionId: input.merchantTransactionId,
      notificationUrl: input.notificationUrl,
    }),
  });
  if (!res.ok) throw new Error(`Peach checkout failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { checkoutId?: string; redirectUrl?: string };
  if (!data.checkoutId || !data.redirectUrl) throw new Error("Peach checkout response missing checkoutId/redirectUrl");
  return { checkoutId: data.checkoutId, redirectUrl: data.redirectUrl };
}

export interface WebhookHeaders {
  algorithm: string | null;
  timestamp: string | null;
  id: string | null;
  signature: string | null;
}

/**
 * Verifies a Peach webhook (HMAC-SHA256, hex). The signed message is
 * `${timestamp}.${webhookId}.${url}.${rawBody}`, where `url` is the exact
 * notification URL registered for the webhook. Timing-safe comparison.
 */
export function verifyWebhook(rawBody: string, url: string, headers: WebhookHeaders): boolean {
  const secret = process.env.PEACH_WEBHOOK_SECRET;
  if (!secret || !headers.timestamp || !headers.id || !headers.signature) return false;
  const message = `${headers.timestamp}.${headers.id}.${url}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(message, "utf8").digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(headers.signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** OPPWA-style success result codes. */
export function isSuccessCode(code: string | undefined): boolean {
  return Boolean(code) && /^(000\.000\.|000\.100\.1|000\.[36])/.test(code!);
}
