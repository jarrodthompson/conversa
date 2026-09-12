"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/auth/context";
import { sendWhatsAppText } from "@/lib/channels/whatsapp/send";
import type { Json } from "@/lib/supabase/types";

const asJson = (v: unknown): Json => v as Json;

function firstOf<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

async function ctx() {
  const c = await getAppContext();
  const supabase = await createClient();
  return { supabase, orgId: c.org.id, userId: c.userId };
}

async function writeAudit(action: string, conversationId: string) {
  const { supabase, orgId, userId } = await ctx();
  await supabase.from("audit_logs").insert({
    organisation_id: orgId,
    actor_id: userId,
    action,
    entity_type: "conversation",
    entity_id: conversationId,
  });
}

/**
 * Send an outbound reply. For WhatsApp conversations this dispatches via the Meta
 * Cloud API when a token is configured, or records a clearly-labelled demo send
 * otherwise. Other channels record the message (their live adapters follow the
 * same pattern). The message is always saved so the agent sees it; a delivery
 * failure is surfaced as a warning and the message is marked failed.
 */
export async function sendReplyAction(conversationId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Message is empty" };
  const { supabase, orgId, userId } = await ctx();

  const { data: conv } = await supabase
    .from("conversations")
    .select("channel_type, channel_id, contact:contacts(whatsapp_number, phone)")
    .eq("id", conversationId)
    .eq("organisation_id", orgId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = conv as any;

  let externalId: string | null = null;
  let deliveryStatus = "sent";
  let metadata: Record<string, unknown> = {};
  let deliveryError: string | null = null;

  if (c?.channel_type === "whatsapp") {
    const contact = firstOf<{ whatsapp_number: string | null; phone: string | null }>(c.contact);
    const to = (contact?.whatsapp_number ?? contact?.phone ?? "").replace(/^\+/, "");
    const { data: cc } = await supabase
      .from("channel_connections")
      .select("config")
      .eq("channel_id", c.channel_id)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const phoneNumberId = (cc as any)?.config?.phone_number_id ?? process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!to) {
      deliveryStatus = "failed";
      metadata = { channel: "whatsapp", error: "No WhatsApp number on contact" };
      deliveryError = "Contact has no WhatsApp number";
    } else {
      try {
        const res = await sendWhatsAppText({
          phoneNumberId,
          accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
          to,
          body: trimmed,
        });
        externalId = res.externalId;
        metadata = { channel: "whatsapp", demo: res.demo };
      } catch (err) {
        deliveryStatus = "failed";
        metadata = { channel: "whatsapp", error: err instanceof Error ? err.message : String(err) };
        deliveryError = "WhatsApp delivery failed";
        await supabase.from("integration_logs").insert({
          organisation_id: orgId, level: "error",
          message: `WhatsApp send failed for conversation ${conversationId}`,
          context: asJson(metadata),
        });
      }
    }
  }

  const { error } = await supabase.from("messages").insert({
    organisation_id: orgId,
    conversation_id: conversationId,
    direction: "outbound",
    author_type: "agent",
    author_id: userId,
    body: trimmed,
    delivery_status: deliveryStatus,
    external_id: externalId,
    metadata: asJson(metadata),
  });
  if (error) return { error: error.message };

  await supabase
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: trimmed.slice(0, 80),
      unread_count: 0,
    })
    .eq("id", conversationId)
    .eq("organisation_id", orgId);

  revalidatePath("/app/inbox");
  if (deliveryError) return { error: `Message saved but not delivered: ${deliveryError}` };
  return { ok: true };
}

export async function addNoteAction(conversationId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Note is empty" };
  const { supabase, orgId, userId } = await ctx();
  const { error } = await supabase.from("internal_notes").insert({
    organisation_id: orgId,
    conversation_id: conversationId,
    author_id: userId,
    body: trimmed,
  });
  if (error) return { error: error.message };
  revalidatePath("/app/inbox");
  return { ok: true };
}

export async function setStatusAction(conversationId: string, status: string) {
  const { supabase, orgId } = await ctx();
  const patch: Record<string, string> = { status };
  if (status === "resolved") patch.resolved_at = new Date().toISOString();
  const { error } = await supabase
    .from("conversations")
    .update(patch)
    .eq("id", conversationId)
    .eq("organisation_id", orgId);
  if (error) return { error: error.message };
  await writeAudit(`conversation.status.${status}`, conversationId);
  revalidatePath("/app/inbox");
  return { ok: true };
}

export async function setPriorityAction(conversationId: string, priority: string) {
  const { supabase, orgId } = await ctx();
  const { error } = await supabase
    .from("conversations")
    .update({ priority })
    .eq("id", conversationId)
    .eq("organisation_id", orgId);
  if (error) return { error: error.message };
  revalidatePath("/app/inbox");
  return { ok: true };
}

export async function assignToMeAction(conversationId: string) {
  const { supabase, orgId, userId } = await ctx();
  const { error } = await supabase
    .from("conversations")
    .update({ assignee_id: userId })
    .eq("id", conversationId)
    .eq("organisation_id", orgId);
  if (error) return { error: error.message };
  await writeAudit("conversation.assign.self", conversationId);
  revalidatePath("/app/inbox");
  return { ok: true };
}
