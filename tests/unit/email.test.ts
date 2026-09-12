import { describe, it, expect, vi, afterEach } from "vitest";
import crypto from "node:crypto";
import { verifySvixSignature } from "@/lib/channels/email/verify";
import { sendEmail } from "@/lib/channels/email/send";

const SECRET = "whsec_" + Buffer.from("email_secret").toString("base64");
const id = "msg_123";
const ts = "1700000000";
const body = '{"type":"email.delivered","data":{"email_id":"e1"}}';

function sign(secret: string) {
  const bytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return "v1," + crypto.createHmac("sha256", bytes).update(`${id}.${ts}.${body}`, "utf8").digest("base64");
}

describe("Resend/Svix signature verification", () => {
  it("accepts a correctly signed payload", () => {
    expect(verifySvixSignature(body, { id, timestamp: ts, signature: sign(SECRET) }, SECRET)).toBe(true);
  });
  it("accepts when multiple signatures are present", () => {
    const header = `v1,invalidsig ${sign(SECRET)}`;
    expect(verifySvixSignature(body, { id, timestamp: ts, signature: header }, SECRET)).toBe(true);
  });
  it("rejects a tampered body", () => {
    expect(verifySvixSignature(body + " ", { id, timestamp: ts, signature: sign(SECRET) }, SECRET)).toBe(false);
  });
  it("rejects a wrong secret", () => {
    expect(verifySvixSignature(body, { id, timestamp: ts, signature: sign(SECRET) }, "whsec_" + Buffer.from("other").toString("base64"))).toBe(false);
  });
  it("rejects missing headers or secret", () => {
    expect(verifySvixSignature(body, { id: null, timestamp: ts, signature: sign(SECRET) }, SECRET)).toBe(false);
    expect(verifySvixSignature(body, { id, timestamp: ts, signature: sign(SECRET) }, undefined)).toBe(false);
  });
});

describe("Resend outbound send", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns a demo result without an API key (no network call)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await sendEmail({ from: "a@b.com", to: "c@d.com", subject: "Hi", text: "yo" });
    expect(res.demo).toBe(true);
    expect(res.externalId).toMatch(/^email_DEMO_/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns demo when from-address is missing even with a key", async () => {
    const res = await sendEmail({ apiKey: "re_x", to: "c@d.com", subject: "Hi", text: "yo" });
    expect(res.demo).toBe(true);
  });

  it("posts to Resend and returns the id when configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "re_123" }), { status: 200 }));
    const res = await sendEmail({ apiKey: "re_x", from: "a@b.com", to: "c@d.com", subject: "Hi", text: "yo" });
    expect(res).toEqual({ externalId: "re_123", demo: false });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("api.resend.com/emails");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer re_x");
  });

  it("throws on a non-OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 422 }));
    await expect(sendEmail({ apiKey: "re_x", from: "a@b.com", to: "c@d.com", subject: "Hi", text: "yo" })).rejects.toThrow(/send failed \(422\)/);
  });
});
