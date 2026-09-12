import { describe, it, expect, vi, afterEach } from "vitest";
import crypto from "node:crypto";
import { verifyWhatsAppSignature } from "@/lib/channels/whatsapp/verify";
import { sendWhatsAppText } from "@/lib/channels/whatsapp/send";

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

describe("WhatsApp outbound send", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns a demo result without a token (no network call)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await sendWhatsAppText({ to: "447700900123", body: "hi" });
    expect(res.demo).toBe(true);
    expect(res.externalId).toMatch(/^wamid\.DEMO_/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts to the Graph API and returns the provider id when configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.LIVE123" }] }), { status: 200 }),
    );
    const res = await sendWhatsAppText({ phoneNumberId: "PID", accessToken: "TOKEN", to: "447700900123", body: "hi" });
    expect(res).toEqual({ externalId: "wamid.LIVE123", demo: false });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/PID/messages");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer TOKEN");
  });

  it("throws on a non-OK provider response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad", { status: 400 }));
    await expect(sendWhatsAppText({ phoneNumberId: "PID", accessToken: "TOKEN", to: "x", body: "hi" })).rejects.toThrow(/send failed \(400\)/);
  });
});
