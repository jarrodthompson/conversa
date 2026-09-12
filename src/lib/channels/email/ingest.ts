import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailWebhookPayload, EmailEventData } from "@/lib/channels/email/types";
import { runAutomations } from "@/lib/automations/engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>;

export interface EmailIngestResult {
  inbound: number;
  statuses: number;
  duplicates: number;
  unmatched: number;
}

/** Extract a bare email address from "Name <a@b.com>", {address}, or a string. */
function extractEmail(v: EmailEventData["from"] | undefined): string | null {
  if (!v) return null;
  const raw = typeof v === "string" ? v : v.address ?? "";
  const m = raw.match(/<([^>]+)>/);
  const email = (m ? m[1] : raw).trim().toLowerCase();
  return email.includes("@") ? email : null;
}

function firstRecipient(to: EmailEventData["to"]): string | null {
  if (!to) return null;
  const item = Array.isArray(to) ? to[0] : to;
  return extractEmail(item as EmailEventData["from"]);
}

function stripHtml(html?: string): string {
  return (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Map a Resend delivery event type to a message delivery status. */
function mapStatus(type: string): string | null {
  if (type.endsWith("sent")) return "sent";
  if (type.endsWith("delivered")) return "delivered";
  if (type.endsWith("opened")) return "read";
  if (type.endsWith("bounced") || type.endsWith("complained") || type.endsWith("failed")) return "failed";
  return null;
}

async function resolveChannelByAddress(db: DB, toEmail: string) {
  const { data } = await db
    .from("channel_connections")
    .select("organisation_id, channel_id, channel:channels(inbox_id)")
    .eq("config->>inbound_address", toEmail)
    .maybeSingle();
  if (!data) return null;
  const ch = Array.isArray(data.channel) ? data.channel[0] : data.channel;
  return { orgId: data.organisation_id as string, channelId: data.channel_id as string, inboxId: (ch?.inbox_id ?? null) as string | null };
}

async function resolveContact(db: DB, orgId: string, email: string) {
  const { data: existing } = await db
    .from("contacts").select("id").eq("organisation_id", orgId).eq("email", email).is("deleted_at", null).maybeSingle();
  if (existing) return existing.id as string;
  const { data: contact } = await db
    .from("contacts")
    .insert({ organisation_id: orgId, email, first_name: email.split("@")[0], consent_status: "unknown" })
    .select("id").single();
  const contactId = contact!.id as string;
  await db.from("contact_channels").insert({ organisation_id: orgId, contact_id: contactId, channel_type: "email", identifier: email, verified: true });
  return contactId;
}

async function resolveConversation(db: DB, orgId: string, channelId: string, inboxId: string | null, contactId: string, subject: string) {
  const { data: open } = await db
    .from("conversations").select("id")
    .eq("organisation_id", orgId).eq("contact_id", contactId).eq("channel_type", "email")
    .not("status", "in", "(resolved,spam)")
    .order("last_message_at", { ascending: false }).limit(1).maybeSingle();
  if (open) return open.id as string;
  const { data: conv } = await db
    .from("conversations")
    .insert({ organisation_id: orgId, channel_id: channelId, inbox_id: inboxId, channel_type: "email", contact_id: contactId, subject: subject || "Email conversation", status: "open", priority: "normal", last_message_at: new Date().toISOString() })
    .select("id").single();
  return conv!.id as string;
}

async function handleInbound(db: DB, data: EmailEventData): Promise<"ok" | "unmatched"> {
  const to = firstRecipient(data.to);
  const from = extractEmail(data.from);
  if (!to || !from) return "unmatched";
  const channel = await resolveChannelByAddress(db, to);
  if (!channel) return "unmatched";

  const contactId = await resolveContact(db, channel.orgId, from);
  const subject = data.subject ?? "Email conversation";
  const conversationId = await resolveConversation(db, channel.orgId, channel.channelId, channel.inboxId, contactId, subject);
  const body = data.text?.trim() || stripHtml(data.html) || "[email]";

  await db.from("messages").insert({
    organisation_id: channel.orgId, conversation_id: conversationId, direction: "inbound",
    author_type: "contact", contact_id: contactId, body, content_type: "text",
    external_id: data.message_id ?? null, delivery_status: "delivered",
  });
  await db.from("conversations").update({ last_message_at: new Date().toISOString(), subject, last_message_preview: body.slice(0, 80) }).eq("id", conversationId);

  try {
    await runAutomations(db, { orgId: channel.orgId, conversationId, event: "message.inbound", body });
  } catch (err) {
    await db.from("integration_logs").insert({ organisation_id: channel.orgId, level: "error", message: "Automation engine error (email inbound)", context: { error: err instanceof Error ? err.message : String(err) } });
  }
  return "ok";
}

async function handleStatus(db: DB, type: string, data: EmailEventData): Promise<"ok" | "unmatched"> {
  const status = mapStatus(type);
  if (!status || !data.email_id) return "unmatched";
  const { data: msg } = await db.from("messages").select("id").eq("external_id", data.email_id).maybeSingle();
  if (!msg) return "unmatched";
  await db.from("message_status_events").insert({ message_id: msg.id, status });
  await db.from("messages").update({ delivery_status: status }).eq("id", msg.id);
  return "ok";
}

/**
 * Processes a Resend webhook event. `eventId` (the svix-id) provides idempotency:
 * the whole event is recorded once in webhook_events; replays are no-ops.
 */
export async function ingestEmailPayload(db: DB, payload: EmailWebhookPayload, eventId: string): Promise<EmailIngestResult> {
  const result: EmailIngestResult = { inbound: 0, statuses: 0, duplicates: 0, unmatched: 0 };
  const type = payload.type ?? "";
  const data = payload.data ?? {};

  // Resolve an org for the webhook_events row where possible (best-effort).
  const to = firstRecipient(data.to);
  const channel = to ? await resolveChannelByAddress(db, to) : null;

  const { error: dupErr } = await db.from("webhook_events").insert({
    organisation_id: channel?.orgId ?? null, channel_type: "email",
    idempotency_key: `email_${eventId}`, payload, signature_valid: true, status: "received",
  });
  if (dupErr) { result.duplicates++; return result; }

  const isInbound = type.includes("inbound") || type.includes("received") || (!!data.text || !!data.html) && !data.email_id;
  if (isInbound) {
    const r = await handleInbound(db, data);
    if (r === "ok") result.inbound++; else result.unmatched++;
  } else {
    const r = await handleStatus(db, type, data);
    if (r === "ok") result.statuses++; else result.unmatched++;
  }

  await db.from("webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("idempotency_key", `email_${eventId}`);
  return result;
}
