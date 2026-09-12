import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  WhatsAppWebhookPayload, WhatsAppValue, WhatsAppMessage, WhatsAppStatus,
} from "@/lib/channels/whatsapp/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>;

export interface IngestResult {
  messages: number;
  statuses: number;
  duplicates: number;
  unmatched: number;
}

/** Extract a human-readable body from any supported message type. */
function messageBody(m: WhatsAppMessage): string {
  if (m.text?.body) return m.text.body;
  if (m.interactive?.button_reply?.title) return m.interactive.button_reply.title;
  if (m.interactive?.list_reply?.title) return m.interactive.list_reply.title;
  if (m.button?.text) return m.button.text;
  if (m.image) return m.image.caption ? `[image] ${m.image.caption}` : "[image]";
  return `[${m.type ?? "unsupported"} message]`;
}

async function resolveChannel(db: DB, phoneNumberId: string) {
  const { data } = await db
    .from("channel_connections")
    .select("organisation_id, channel_id, channel:channels(inbox_id)")
    .eq("config->>phone_number_id", phoneNumberId)
    .maybeSingle();
  if (!data) return null;
  // The embedded to-one relation may be typed as an object or array depending on
  // generated types; normalise both shapes.
  const ch = Array.isArray(data.channel) ? data.channel[0] : data.channel;
  return {
    orgId: data.organisation_id as string,
    channelId: data.channel_id as string,
    inboxId: ((ch?.inbox_id ?? null) as string | null),
  };
}

async function resolveContact(db: DB, orgId: string, waId: string, name: string | undefined) {
  const { data: link } = await db
    .from("contact_channels")
    .select("contact_id")
    .eq("organisation_id", orgId)
    .eq("channel_type", "whatsapp")
    .eq("identifier", waId)
    .maybeSingle();
  if (link) return link.contact_id as string;

  const [first, ...rest] = (name ?? "").trim().split(/\s+/);
  const { data: contact } = await db
    .from("contacts")
    .insert({
      organisation_id: orgId,
      first_name: first || "WhatsApp",
      last_name: rest.join(" ") || null,
      phone: `+${waId}`,
      whatsapp_number: `+${waId}`,
      consent_status: "unknown",
    })
    .select("id").single();
  const contactId = contact!.id as string;
  await db.from("contact_channels").insert({
    organisation_id: orgId, contact_id: contactId, channel_type: "whatsapp", identifier: waId, display_name: name ?? null, verified: true,
  });
  return contactId;
}

async function resolveConversation(db: DB, orgId: string, channelId: string, inboxId: string | null, contactId: string) {
  const { data: open } = await db
    .from("conversations")
    .select("id")
    .eq("organisation_id", orgId)
    .eq("contact_id", contactId)
    .eq("channel_type", "whatsapp")
    .not("status", "in", "(resolved,spam)")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open) return open.id as string;

  const { data: conv } = await db
    .from("conversations")
    .insert({
      organisation_id: orgId, channel_id: channelId, inbox_id: inboxId, channel_type: "whatsapp",
      contact_id: contactId, subject: "WhatsApp conversation", status: "open", priority: "normal",
      last_message_at: new Date().toISOString(),
    })
    .select("id").single();
  return conv!.id as string;
}

async function handleMessage(db: DB, value: WhatsAppValue, m: WhatsAppMessage): Promise<"ok" | "duplicate" | "unmatched"> {
  const phoneNumberId = value.metadata?.phone_number_id;
  if (!phoneNumberId || !m.id || !m.from) return "unmatched";

  const channel = await resolveChannel(db, phoneNumberId);
  if (!channel) return "unmatched";

  // Idempotency: the provider message id is unique across webhook_events.
  const { error: dupErr } = await db.from("webhook_events").insert({
    organisation_id: channel.orgId, channel_type: "whatsapp",
    idempotency_key: `wa_msg_${m.id}`, payload: value, signature_valid: true, status: "received",
  });
  if (dupErr) return "duplicate"; // unique violation → already processed

  const profileName = value.contacts?.find((c) => c.wa_id === m.from)?.profile?.name;
  const contactId = await resolveContact(db, channel.orgId, m.from, profileName);
  const conversationId = await resolveConversation(db, channel.orgId, channel.channelId, channel.inboxId, contactId);
  const body = messageBody(m);
  const ts = m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString();

  const { error: msgErr } = await db.from("messages").insert({
    organisation_id: channel.orgId, conversation_id: conversationId, direction: "inbound",
    author_type: "contact", contact_id: contactId, body, content_type: "text",
    external_id: m.id, delivery_status: "delivered", sent_at: ts, created_at: ts,
  });
  if (msgErr) return "duplicate";

  await db.from("conversations").update({
    last_message_at: ts, last_message_preview: body.slice(0, 80),
  }).eq("id", conversationId);

  await db.from("webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("idempotency_key", `wa_msg_${m.id}`);
  return "ok";
}

async function handleStatus(db: DB, value: WhatsAppValue, s: WhatsAppStatus): Promise<"ok" | "unmatched"> {
  const phoneNumberId = value.metadata?.phone_number_id;
  if (!phoneNumberId || !s.id || !s.status) return "unmatched";
  const channel = await resolveChannel(db, phoneNumberId);
  if (!channel) return "unmatched";

  const { data: msg } = await db
    .from("messages")
    .select("id")
    .eq("organisation_id", channel.orgId)
    .eq("external_id", s.id)
    .maybeSingle();
  if (!msg) return "unmatched";

  const ts = s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : new Date().toISOString();
  await db.from("message_status_events").insert({ message_id: msg.id, status: s.status, provider_ts: ts });
  await db.from("messages").update({ delivery_status: s.status }).eq("id", msg.id);
  return "ok";
}

/** Processes a full WhatsApp webhook payload. Idempotent per provider message id. */
export async function ingestWhatsAppPayload(db: DB, payload: WhatsAppWebhookPayload): Promise<IngestResult> {
  const result: IngestResult = { messages: 0, statuses: 0, duplicates: 0, unmatched: 0 };
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;
      for (const m of value.messages ?? []) {
        const r = await handleMessage(db, value, m);
        if (r === "ok") result.messages++;
        else if (r === "duplicate") result.duplicates++;
        else result.unmatched++;
      }
      for (const s of value.statuses ?? []) {
        const r = await handleStatus(db, value, s);
        if (r === "ok") result.statuses++;
        else result.unmatched++;
      }
    }
  }
  return result;
}
