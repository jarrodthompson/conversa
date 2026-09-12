/**
 * Simulates a WhatsApp Business Cloud API inbound webhook against the local
 * endpoint: ensures the demo WhatsApp channel is mapped to the test phone id,
 * builds a realistic payload, signs it with WHATSAPP_APP_SECRET, and POSTs it.
 *
 *   npm run wa:sim            # inbound text message
 *   npm run wa:sim status     # a delivery-status update for the last message
 *
 * Requires the dev server running and WHATSAPP_* set in .env.local.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "TESTPHONE100";
const SECRET = process.env.WHATSAPP_APP_SECRET!;
const waId = "447700900123";

async function ensureMapping() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: org } = await admin.from("organisations").select("id").eq("slug", "grovefield").single();
  const { data: channel } = await admin.from("channels").select("id").eq("organisation_id", org!.id).eq("type", "whatsapp").limit(1).single();
  await admin.from("channel_connections")
    .update({ config: { phone_number_id: PHONE_ID, note: "Demo/test mapping for the webhook simulator" }, status: "connected" })
    .eq("channel_id", channel!.id);
  console.log(`Mapped WhatsApp channel ${channel!.id} → phone_number_id ${PHONE_ID}`);
}

function sign(body: string) {
  return "sha256=" + crypto.createHmac("sha256", SECRET).update(body, "utf8").digest("hex");
}

async function post(payload: unknown) {
  const body = JSON.stringify(payload);
  const res = await fetch(`${APP_URL}/api/webhooks/whatsapp`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": sign(body) },
    body,
  });
  console.log(`POST ${res.status}:`, await res.text());
}

const messageId = `wamid.TEST${Date.now()}`;

function textPayload() {
  return {
    object: "whatsapp_business_account",
    entry: [{
      id: "WABA_TEST",
      changes: [{
        field: "messages",
        value: {
          messaging_product: "whatsapp",
          metadata: { display_phone_number: "15550000000", phone_number_id: PHONE_ID },
          contacts: [{ profile: { name: "Test Customer" }, wa_id: waId }],
          messages: [{
            from: waId, id: messageId, timestamp: String(Math.floor(Date.now() / 1000)),
            type: "text", text: { body: "Hi! This came in via the WhatsApp Cloud API webhook." },
          }],
        },
      }],
    }],
  };
}

function statusPayload(msgId: string) {
  return {
    object: "whatsapp_business_account",
    entry: [{
      id: "WABA_TEST",
      changes: [{
        field: "messages",
        value: {
          messaging_product: "whatsapp",
          metadata: { display_phone_number: "15550000000", phone_number_id: PHONE_ID },
          statuses: [{ id: msgId, status: "read", timestamp: String(Math.floor(Date.now() / 1000)), recipient_id: waId }],
        },
      }],
    }],
  };
}

async function main() {
  if (!SECRET) { console.error("WHATSAPP_APP_SECRET not set in .env.local"); process.exit(1); }
  await ensureMapping();

  const mode = process.argv[2];
  if (mode === "status") {
    // Send a message first, then a read status for it.
    const p = textPayload();
    const id = p.entry[0].changes[0].value.messages![0].id;
    await post(p);
    await post(statusPayload(id));
  } else {
    await post(textPayload());
    console.log("\nDuplicate check (same message id should be ignored):");
    await post(textPayload()); // same module-level messageId → treated as duplicate
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
