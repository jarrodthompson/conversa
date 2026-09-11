"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/auth/context";

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

/** Send an outbound reply (demo channels record but don't dispatch to a provider). */
export async function sendReplyAction(conversationId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Message is empty" };
  const { supabase, orgId, userId } = await ctx();

  const { error } = await supabase.from("messages").insert({
    organisation_id: orgId,
    conversation_id: conversationId,
    direction: "outbound",
    author_type: "agent",
    author_id: userId,
    body: trimmed,
    delivery_status: "sent",
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
