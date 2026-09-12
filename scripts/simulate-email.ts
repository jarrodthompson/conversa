/**
 * Simulates a Resend inbound-email webhook against the local endpoint: ensures
 * the demo email channel has an inbound address, builds an inbound payload, signs
 * it with the Svix scheme using RESEND_WEBHOOK_SECRET, and POSTs it.
 *
 *   npm run email:sim
 *
 * Requires the dev server running and RESEND_WEBHOOK_SECRET in .env.local.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const SECRET = process.env.RESEND_WEBHOOK_SECRET!;
const INBOUND_ADDRESS = "support@grovefield.demo";
const FROM = "new.lead@example.com";

async function ensureMapping() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: org } = await admin.from("organisations").select("id").eq("slug", "grovefield").single();
  const { data: channel } = await admin.from("channels").select("id").eq("organisation_id", org!.id).eq("type", "email").limit(1).single();
  await admin.from("channel_connections")
    .update({ config: { inbound_address: INBOUND_ADDRESS, from_address: INBOUND_ADDRESS, note: "Demo/test mapping for the email webhook simulator" }, status: "connected" })
    .eq("channel_id", channel!.id);
  console.log(`Mapped email channel ${channel!.id} → inbound_address ${INBOUND_ADDRESS}`);
}

function svixHeaders(id: string, body: string) {
  const ts = String(Math.floor(Date.now() / 1000));
  const secretBytes = Buffer.from(SECRET.replace(/^whsec_/, ""), "base64");
  const sig = crypto.createHmac("sha256", secretBytes).update(`${id}.${ts}.${body}`, "utf8").digest("base64");
  return { "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,${sig}`, "content-type": "application/json" };
}

async function post(id: string, payload: unknown) {
  const body = JSON.stringify(payload);
  const res = await fetch(`${APP_URL}/api/webhooks/email`, { method: "POST", headers: svixHeaders(id, body), body });
  console.log(`POST ${res.status}:`, await res.text());
}

const eventId = `msg_${Date.now()}`;
const inboundPayload = {
  type: "inbound.email",
  created_at: new Date().toISOString(),
  data: {
    message_id: `email_in_${Date.now()}`,
    from: `New Lead <${FROM}>`,
    to: [INBOUND_ADDRESS],
    subject: "Question about bulk orders",
    text: "Hi team, do you offer discounts for orders over 100 units? Thanks!",
  },
};

async function main() {
  if (!SECRET) { console.error("RESEND_WEBHOOK_SECRET not set in .env.local"); process.exit(1); }
  await ensureMapping();
  await post(eventId, inboundPayload);
  console.log("\nDuplicate check (same svix-id should be ignored):");
  await post(eventId, inboundPayload);
}

main().catch((e) => { console.error(e); process.exit(1); });
