import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runAutomations } from "@/lib/automations/engine";

/**
 * Live automation-engine test: a message.inbound rule fires actions, and a
 * follow-on tag.added rule fires in a bounded cascade (loop protection).
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = !!(URL && SERVICE);

describe.skipIf(!hasEnv)("automation engine (live)", () => {
  let admin: SupabaseClient;
  let orgId: string;
  let conversationId: string;
  const ruleIds: string[] = [];
  let tagName = "";
  let cascadeTag = "";

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: gf } = await admin.from("organisations").select("id").eq("slug", "grovefield").single();
    orgId = gf!.id as string;

    const suffix = Math.random().toString(36).slice(2, 7);
    tagName = `EngineTag_${suffix}`;
    cascadeTag = `Cascade_${suffix}`;

    const { data: conv } = await admin.from("conversations")
      .insert({ organisation_id: orgId, channel_type: "whatsapp", status: "open", priority: "normal", subject: "Engine test", last_message_at: new Date().toISOString() })
      .select("id").single();
    conversationId = conv!.id as string;

    // Rule 1: on inbound message → set priority urgent + add a tag.
    const { data: r1 } = await admin.from("automation_rules").insert({
      organisation_id: orgId, name: `ENGINE inbound ${suffix}`, status: "active", position: 900,
      trigger_type: "message.inbound", trigger_config: {}, conditions: [],
      actions: [{ type: "set_priority", value: "urgent" }, { type: "add_tag", value: tagName }],
    }).select("id").single();
    ruleIds.push(r1!.id as string);

    // Rule 2: on tag.added → add a second tag (tests the bounded cascade).
    const { data: r2 } = await admin.from("automation_rules").insert({
      organisation_id: orgId, name: `ENGINE cascade ${suffix}`, status: "active", position: 901,
      trigger_type: "tag.added", trigger_config: {}, conditions: [],
      actions: [{ type: "add_tag", value: cascadeTag }],
    }).select("id").single();
    ruleIds.push(r2!.id as string);
  });

  afterAll(async () => {
    if (!admin) return;
    for (const id of ruleIds) {
      await admin.from("automation_runs").delete().eq("rule_id", id);
      await admin.from("automation_rules").delete().eq("id", id);
    }
    if (conversationId) await admin.from("conversations").delete().eq("id", conversationId);
    await admin.from("tags").delete().eq("organisation_id", orgId).in("name", [tagName, cascadeTag]);
  });

  it("fires matching rules, applies actions, and cascades once (loop-protected)", async () => {
    const res = await runAutomations(admin, { orgId, conversationId, event: "message.inbound", body: "hello there" });
    // Rule 1 (inbound) + Rule 2 (cascade from tag.added) both fire once.
    expect(res.fired).toBe(2);

    // Priority updated by rule 1.
    const { data: conv } = await admin.from("conversations").select("priority").eq("id", conversationId).single();
    expect(conv!.priority).toBe("urgent");

    // Both tags applied (direct + cascade).
    const { data: tagLinks } = await admin
      .from("conversation_tags")
      .select("tag:tags(name)")
      .eq("conversation_id", conversationId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const names = (tagLinks ?? []).map((t: any) => (Array.isArray(t.tag) ? t.tag[0]?.name : t.tag?.name));
    expect(names).toContain(tagName);
    expect(names).toContain(cascadeTag);

    // Runs recorded for both rules.
    const { data: runs } = await admin.from("automation_runs").select("rule_id").in("rule_id", ruleIds);
    expect((runs ?? []).length).toBe(2);
  });

  it("keyword-filtered rules only fire on a match", async () => {
    const suffix = Math.random().toString(36).slice(2, 7);
    const { data: rk } = await admin.from("automation_rules").insert({
      organisation_id: orgId, name: `ENGINE keyword ${suffix}`, status: "active", position: 902,
      trigger_type: "message.inbound", trigger_config: { keyword: "refundxyz" }, conditions: [],
      actions: [{ type: "notify_manager" }],
    }).select("id").single();
    ruleIds.push(rk!.id as string);

    const noMatch = await runAutomations(admin, { orgId, conversationId, event: "message.inbound", body: "just a hello" });
    // The keyword rule must not fire; (rule 1 fires again → fired>=1 but keyword rule excluded)
    const { data: runsBefore } = await admin.from("automation_runs").select("id").eq("rule_id", rk!.id);
    expect((runsBefore ?? []).length).toBe(0);
    void noMatch;

    const match = await runAutomations(admin, { orgId, conversationId, event: "message.inbound", body: "I need a refundxyz now" });
    expect(match.fired).toBeGreaterThanOrEqual(1);
    const { data: runsAfter } = await admin.from("automation_runs").select("id").eq("rule_id", rk!.id);
    expect((runsAfter ?? []).length).toBe(1);
  });
});
