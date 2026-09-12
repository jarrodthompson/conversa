import crypto from "node:crypto";

export interface SvixHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

/**
 * Verifies a Resend/Svix webhook signature. The signing secret has the form
 * `whsec_<base64>`; the signed content is `${id}.${timestamp}.${body}`, and the
 * `svix-signature` header is a space-separated list of `v1,<base64sig>` entries.
 * Comparison is timing-safe.
 */
export function verifySvixSignature(
  rawBody: string,
  headers: SvixHeaders,
  secret: string | undefined,
): boolean {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secretBytes).update(signedContent, "utf8").digest("base64");
  const expectedBuf = Buffer.from(expected);

  // Header may contain multiple space-separated "v1,<sig>" values.
  for (const part of headers.signature.split(" ")) {
    const sig = part.includes(",") ? part.split(",")[1] : part;
    const sigBuf = Buffer.from(sig);
    if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return true;
    }
  }
  return false;
}
