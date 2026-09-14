import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runChatbot, type RuntimeSession } from "@/lib/chatbots/runtime";
import type { FlowDefinition } from "@/lib/chatbots/types";

export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

/**
 * Public web-chat widget endpoint. Runs a published chatbot flow live:
 * creates an anonymous conversation on first contact, persists the transcript,
 * executes the flow (real actions), and returns the bot's messages + choices.
 * Body: { flowId, sessionId?, text?, handle? }
 */
export async function POST(request: NextRequest) {
  let body: { flowId?: string; sessionId?: string; text?: string; handle?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  const { flowId, sessionId, text, handle } = body;
  if (!flowId) return json({ error: "flowId is required" }, 400);

  const admin = createAdminClient();

  const { data: flow } = await admin
    .from("chatbot_flows")
    .select("id, organisation_id, definition, status")
    .eq("id", flowId)
    .is("deleted_at", null)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f = flow as any;
  if (!f) return json({ error: "Flow not found" }, 404);
  const def = (f.definition ?? { nodes: [], edges: [] }) as FlowDefinition;
  const orgId = f.organisation_id as string;

  // Resolve or create the session + conversation.
  let sessRow: { id: string; conversation_id: string; current_node_id: string | null; vars: Record<string, string>; status: string } | null = null;
  if (sessionId) {
    const { data } = await admin
      .from("chatbot_sessions")
      .select("id, conversation_id, current_node_id, vars, status")
      .eq("id", sessionId)
      .eq("flow_id", flowId)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessRow = data as any;
  }

  let contactId: string | null = null;
  if (!sessRow) {
    // New visitor: anonymous contact + conversation + session.
    const { data: inbox } = await admin.from("inboxes").select("id").eq("organisation_id", orgId).order("is_default", { ascending: false }).limit(1).maybeSingle();
    const { data: chan } = await admin.from("channels").select("id").eq("organisation_id", orgId).eq("type", "web_chat").is("deleted_at", null).limit(1).maybeSingle();
    const { data: contact } = await admin
      .from("contacts")
      .insert({ organisation_id: orgId, first_name: "Website visitor", consent_status: "unknown" })
      .select("id").single();
    contactId = contact!.id as string;
    const { data: conv } = await admin
      .from("conversations")
      .insert({
        organisation_id: orgId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inbox_id: (inbox as any)?.id ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        channel_id: (chan as any)?.id ?? null,
        channel_type: "web_chat",
        contact_id: contactId,
        status: "open",
        priority: "normal",
        is_ai_handled: true,
        subject: "Website chat",
        last_message_at: new Date().toISOString(),
      })
      .select("id").single();
    const { data: created } = await admin
      .from("chatbot_sessions")
      .insert({ organisation_id: orgId, conversation_id: conv!.id, flow_id: flowId, current_node_id: null, vars: {} })
      .select("id, conversation_id, current_node_id, vars, status").single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessRow = created as any;
  }

  if (!sessRow) return json({ error: "Could not start session" }, 500);
  if (sessRow.status !== "active") {
    return json({ sessionId: sessRow.id, messages: [], options: null, awaitsInput: false, ended: sessRow.status === "ended", handedOff: sessRow.status === "handed_off" });
  }

  // Resolve contact for this conversation (for update_field etc.).
  if (!contactId) {
    const { data: conv } = await admin.from("conversations").select("contact_id").eq("id", sessRow.conversation_id).maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contactId = (conv as any)?.contact_id ?? null;
  }

  const userInput = (typeof text === "string" && text.trim()) || handle ? { text: text?.trim(), handle } : null;

  // Persist the visitor's inbound message (skip the initial empty greeting call).
  if (userInput && sessRow.current_node_id !== null) {
    const inboundBody = (text?.trim() || "").slice(0, 2000);
    if (inboundBody) {
      await admin.from("messages").insert({
        organisation_id: orgId, conversation_id: sessRow.conversation_id,
        direction: "inbound", author_type: "contact", contact_id: contactId,
        body: inboundBody, content_type: "text", delivery_status: "delivered",
      });
    }
  }

  const session: RuntimeSession = { currentNodeId: sessRow.current_node_id, vars: sessRow.vars ?? {} };
  const result = await runChatbot(admin, { orgId, conversationId: sessRow.conversation_id, contactId, channelType: "web_chat" }, def, session, sessRow.current_node_id === null ? null : userInput);

  // Persist bot messages.
  for (const m of result.messages) {
    await admin.from("messages").insert({
      organisation_id: orgId, conversation_id: sessRow.conversation_id,
      direction: "outbound", author_type: "bot", body: m, content_type: "text", delivery_status: "sent",
    });
  }

  const status = result.handedOff ? "handed_off" : result.ended ? "ended" : "active";
  await admin.from("chatbot_sessions").update({
    current_node_id: result.currentNodeId, vars: result.vars, status, updated_at: new Date().toISOString(),
  }).eq("id", sessRow.id);

  const lastMsg = result.messages[result.messages.length - 1];
  await admin.from("conversations").update({
    last_message_at: new Date().toISOString(),
    ...(lastMsg ? { last_message_preview: lastMsg.slice(0, 80) } : {}),
  }).eq("id", sessRow.conversation_id);

  return json({
    sessionId: sessRow.id,
    messages: result.messages,
    options: result.options,
    awaitsInput: result.awaitsInput,
    ended: result.ended,
    handedOff: result.handedOff,
  });
}
