import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyWhatsAppSignature } from "@/lib/channels/whatsapp/verify";

const SECRET = "test_secret";
const body = '{"object":"whatsapp_business_account","entry":[]}';
const goodSig = "sha256=" + crypto.createHmac("sha256", SECRET).update(body, "utf8").digest("hex");

describe("WhatsApp webhook signature verification", () => {
  it("accepts a correctly signed body", () => {
    expect(verifyWhatsAppSignature(body, goodSig, SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(verifyWhatsAppSignature(body + " ", goodSig, SECRET)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    expect(verifyWhatsAppSignature(body, goodSig, "other_secret")).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(verifyWhatsAppSignature(body, null, SECRET)).toBe(false);
    expect(verifyWhatsAppSignature(body, "deadbeef", SECRET)).toBe(false);
  });

  it("rejects when no app secret is configured", () => {
    expect(verifyWhatsAppSignature(body, goodSig, undefined)).toBe(false);
  });
});
