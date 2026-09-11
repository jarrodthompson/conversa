import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Messaging and ticket-transition tests against the live database.
 * Verifies the ticket-status-history trigger and member message writes under RLS.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = !!(URL && ANON && SERVICE);

describe.skipIf(!hasEnv)("ticket transitions & messaging", () => {
  let admin: SupabaseClient;
  let orgId: string;
  let conversationId: string;
  const createdTicketIds: string[] = [];
  const createdMessageIds: string[] = [];

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: gf } = await admin.from("organisations").select("id").eq("slug", "grovefield").single();
    orgId = gf!.id as string;
    const { data: conv } = await admin.from("conversations").select("id").eq("organisation_id", orgId).limit(1).single();
    conversationId = conv!.id as string;
  });

  afterAll(async () => {
    if (!admin) return;
    for (const id of createdMessageIds) await admin.from("messages").delete().eq("id", id);
    for (const id of createdTicketIds) await admin.from("tickets").delete().eq("id", id);
  });

  it("records ticket status history on transition (DB trigger)", async () => {
    const { data: ticket, error } = await admin
      .from("tickets")
      .insert({ organisation_id: orgId, subject: "Transition test", status: "open" })
      .select("id").single();
    expect(error).toBeNull();
    const ticketId = ticket!.id as string;
    createdTicketIds.push(ticketId);

    // open -> pending -> resolved
    await admin.from("tickets").update({ status: "pending" }).eq("id", ticketId);
    await admin.from("tickets").update({ status: "resolved" }).eq("id", ticketId);

    const { data: history } = await admin
      .from("ticket_status_history")
      .select("from_status, to_status")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    expect((history ?? []).length).toBe(2);
    expect(history![0]).toMatchObject({ from_status: "open", to_status: "pending" });
    expect(history![1]).toMatchObject({ from_status: "pending", to_status: "resolved" });
  });

  it("does not log history when status is unchanged", async () => {
    const { data: ticket } = await admin
      .from("tickets")
      .insert({ organisation_id: orgId, subject: "No-op update", status: "open" })
      .select("id").single();
    const ticketId = ticket!.id as string;
    createdTicketIds.push(ticketId);

    await admin.from("tickets").update({ priority: "high" }).eq("id", ticketId);

    const { data: history } = await admin.from("ticket_status_history").select("id").eq("ticket_id", ticketId);
    expect((history ?? []).length).toBe(0);
  });

  it("lets a member post a message and read it back under RLS", async () => {
    const member = createClient(URL!, ANON!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error: sErr } = await member.auth.signInWithPassword({ email: "ava.owner@conversa.demo", password: "ConversaDemo!23" });
    expect(sErr).toBeNull();

    const body = `integration-msg-${Math.random().toString(36).slice(2, 8)}`;
    const { data: inserted, error } = await member
      .from("messages")
      .insert({ organisation_id: orgId, conversation_id: conversationId, direction: "outbound", author_type: "agent", body })
      .select("id").single();
    expect(error).toBeNull();
    createdMessageIds.push(inserted!.id as string);

    const { data: readback } = await member.from("messages").select("body").eq("id", inserted!.id).single();
    expect(readback!.body).toBe(body);
  });
});
