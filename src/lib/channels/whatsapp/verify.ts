import crypto from "node:crypto";

/**
 * Verifies Meta's `X-Hub-Signature-256` header against the raw request body
 * using the app secret (HMAC-SHA256), with a timing-safe comparison.
 */
export function verifyWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | undefined,
): boolean {
  if (!appSecret) return false;
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
