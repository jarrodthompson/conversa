import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Tenant-isolation & permission tests against the live Supabase project,
 * enforced by Row-Level Security. Skipped automatically when env is absent.
 *
 * Strategy: seed data belongs to the "grovefield" org. We create an ephemeral
 * outsider user in a separate org and assert they cannot read or write
 * grovefield's data, while a grovefield member can.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = !!(URL && ANON && SERVICE);

const rand = Math.random().toString(36).slice(2, 8);
const OUTSIDER_EMAIL = `rls-outsider-${rand}@conversa.test`;
const PASSWORD = "RlsTest!2345";

describe.skipIf(!hasEnv)("RLS tenant isolation", () => {
  let admin: SupabaseClient;
  let outsiderId: string;
  let outsiderOrgId: string;
  let grovefieldOrgId: string;
  let grovefieldConversationId: string;

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { autoRefreshToken: false, persistSession: false } });

    // Ephemeral outsider user + org (service role bypasses RLS).
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: OUTSIDER_EMAIL, password: PASSWORD, email_confirm: true,
    });
    if (cErr || !created.user) throw new Error(`createUser: ${cErr?.message}`);
    outsiderId = created.user.id;

    const { data: org, error: oErr } = await admin
      .from("organisations")
      .insert({ name: `RLS Test ${rand}`, slug: `rls-test-${rand}`, created_by: outsiderId })
      .select("id").single();
    if (oErr || !org) throw new Error(`org: ${oErr?.message}`);
    outsiderOrgId = org.id as string;

    await admin.from("organisation_members").insert({
      organisation_id: outsiderOrgId, user_id: outsiderId, role: "owner", status: "active", is_default: true,
    });

    // Reference grovefield data.
    const { data: gf } = await admin.from("organisations").select("id").eq("slug", "grovefield").single();
    grovefieldOrgId = gf!.id as string;
    const { data: conv } = await admin.from("conversations").select("id").eq("organisation_id", grovefieldOrgId).limit(1).single();
    grovefieldConversationId = conv!.id as string;
  });

  afterAll(async () => {
    if (!admin) return;
    if (outsiderOrgId) await admin.from("organisations").delete().eq("id", outsiderOrgId);
    if (outsiderId) await admin.auth.admin.deleteUser(outsiderId);
  });

  async function signInAs(email: string, password: string) {
    const c = createClient(URL!, ANON!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`signIn ${email}: ${error.message}`);
    return c;
  }

  it("hides another org's conversations from a non-member", async () => {
    const outsider = await signInAs(OUTSIDER_EMAIL, PASSWORD);
    const { data } = await outsider.from("conversations").select("id").eq("organisation_id", grovefieldOrgId);
    expect(data ?? []).toHaveLength(0);
  });

  it("hides another org's contacts from a non-member", async () => {
    const outsider = await signInAs(OUTSIDER_EMAIL, PASSWORD);
    const { data } = await outsider.from("contacts").select("id").eq("organisation_id", grovefieldOrgId);
    expect(data ?? []).toHaveLength(0);
  });

  it("blocks a non-member from writing into another org (RLS with_check)", async () => {
    const outsider = await signInAs(OUTSIDER_EMAIL, PASSWORD);
    const { error } = await outsider.from("contacts").insert({ organisation_id: grovefieldOrgId, first_name: "Intruder" });
    expect(error).not.toBeNull();
  });

  it("blocks a non-member from posting a message into another org's conversation", async () => {
    const outsider = await signInAs(OUTSIDER_EMAIL, PASSWORD);
    const { error } = await outsider.from("messages").insert({
      organisation_id: grovefieldOrgId, conversation_id: grovefieldConversationId,
      direction: "outbound", author_type: "agent", body: "leak",
    });
    expect(error).not.toBeNull();
  });

  it("lets an outsider read their own org", async () => {
    const outsider = await signInAs(OUTSIDER_EMAIL, PASSWORD);
    const { data } = await outsider.from("organisations").select("id").eq("id", outsiderOrgId);
    expect((data ?? []).length).toBe(1);
  });

  it("lets a grovefield member read grovefield conversations", async () => {
    const owner = await signInAs("ava.owner@conversa.demo", "ConversaDemo!23");
    const { data } = await owner.from("conversations").select("id").eq("organisation_id", grovefieldOrgId).limit(5);
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});
