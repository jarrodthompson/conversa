import { createClient } from "@/lib/supabase/server";

export type InboxView =
  | "mine" | "all" | "unassigned" | "mentions" | "waiting"
  | "snoozed" | "resolved" | "spam" | "ai";

export interface ConversationRow {
  id: string;
  subject: string | null;
  status: string;
  priority: string;
  channel_type: string;
  is_ai_handled: boolean;
  assignee_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  sla_breached: boolean;
  sla_due_at: string | null;
  sentiment: string | null;
  contact: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null } | null;
}

function applyView(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  view: InboxView,
  userId: string,
) {
  switch (view) {
    case "mine":
      return query.eq("assignee_id", userId).not("status", "in", "(resolved,spam)");
    case "unassigned":
      return query.is("assignee_id", null).not("status", "in", "(resolved,spam)");
    case "waiting":
      return query.eq("status", "waiting");
    case "snoozed":
      return query.eq("status", "snoozed");
    case "resolved":
      return query.eq("status", "resolved");
    case "spam":
      return query.eq("status", "spam");
    case "ai":
      return query.eq("is_ai_handled", true);
    case "mentions":
    case "all":
    default:
      return query.not("status", "in", "(spam)");
  }
}

export async function listConversations(
  orgId: string,
  userId: string,
  view: InboxView,
): Promise<ConversationRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("conversations")
    .select(
      "id, subject, status, priority, channel_type, is_ai_handled, assignee_id, last_message_at, last_message_preview, unread_count, sla_breached, sla_due_at, sentiment, contact:contacts(id, first_name, last_name, avatar_url)",
    )
    .eq("organisation_id", orgId)
    .is("deleted_at", null)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(60);

  query = applyView(query, view, userId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ConversationRow[];
}

export interface ViewCounts {
  mine: number;
  unassigned: number;
  waiting: number;
  snoozed: number;
  resolved: number;
  spam: number;
  ai: number;
  all: number;
}

export async function getViewCounts(orgId: string, userId: string): Promise<ViewCounts> {
  const supabase = await createClient();
  const base = () =>
    supabase.from("conversations").select("id", { count: "exact", head: true }).eq("organisation_id", orgId).is("deleted_at", null);

  const [mine, unassigned, waiting, snoozed, resolved, spam, ai, all] = await Promise.all([
    base().eq("assignee_id", userId).not("status", "in", "(resolved,spam)"),
    base().is("assignee_id", null).not("status", "in", "(resolved,spam)"),
    base().eq("status", "waiting"),
    base().eq("status", "snoozed"),
    base().eq("status", "resolved"),
    base().eq("status", "spam"),
    base().eq("is_ai_handled", true),
    base().not("status", "in", "(spam)"),
  ]);

  return {
    mine: mine.count ?? 0,
    unassigned: unassigned.count ?? 0,
    waiting: waiting.count ?? 0,
    snoozed: snoozed.count ?? 0,
    resolved: resolved.count ?? 0,
    spam: spam.count ?? 0,
    ai: ai.count ?? 0,
    all: all.count ?? 0,
  };
}

export interface MessageRow {
  id: string;
  direction: string;
  author_type: string;
  author_id: string | null;
  body: string | null;
  created_at: string;
  delivery_status: string;
}

export interface ConversationDetail extends ConversationRow {
  ai_summary: string | null;
  ai_next_action: string | null;
  created_at: string;
  messages: MessageRow[];
  notes: { id: string; body: string; author_id: string | null; created_at: string }[];
  contactFull: {
    id: string; first_name: string | null; last_name: string | null;
    email: string | null; phone: string | null; company: string | null;
    location: string | null; language: string | null; consent_status: string | null;
  } | null;
}

export async function getConversation(orgId: string, id: string): Promise<ConversationDetail | null> {
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select(
      "id, subject, status, priority, channel_type, is_ai_handled, assignee_id, last_message_at, last_message_preview, unread_count, sla_breached, sla_due_at, sentiment, ai_summary, ai_next_action, created_at, contact:contacts(id, first_name, last_name, avatar_url, email, phone, company, location, language, consent_status)",
    )
    .eq("organisation_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (!conv) return null;

  const [{ data: messages }, { data: notes }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, direction, author_type, author_id, body, created_at, delivery_status")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("internal_notes")
      .select("id, body, author_id, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = conv as any;
  return {
    ...c,
    contact: c.contact,
    contactFull: c.contact,
    messages: (messages ?? []) as unknown as MessageRow[],
    notes: (notes ?? []) as ConversationDetail["notes"],
  };
}
