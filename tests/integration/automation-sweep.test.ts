import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runTimeSweep } from "@/lib/automations/sweep";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = !!(URL && SERVICE);

describe.skipIf(!hasEnv)("time-based automation sweep (live)", () => {
  let admin: SupabaseClient;
  let orgId: string;
  let waitingConvId: string;
  let slaConvId: string;
  const ruleIds: string[] = [];
  const subject = `SWEEPTEST_${Math.random().toString(36).slice(2, 7)}`;

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: gf } = await admin.from("organisations").select("id").eq("slug", "grovefield").single();
    orgId = gf!.id as string;

    // A conversation idle for 2 hours (waiting), scoped by a unique subject.
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
    const { data: c1 } = await admin.from("conversations")
      .insert({ organisation_id: orgId, channel_type: "email", status: "open", priority: "normal", subject, last_message_at: twoHoursAgo })
      .select("id").single();
    waitingConvId = c1!.id as string;

    // A conversation with an SLA due in the past, not yet breached.
    const { data: c2 } = await admin.from("conversations")
      .insert({ organisation_id: orgId, channel_type: "email", status: "open", priority: "normal", subject: `${subject}_SLA`, last_message_at: twoHoursAgo, sla_due_at: new Date(Date.now() - 3600_000).toISOString(), sla_breached: false })
      .select("id").single();
    slaConvId = c2!.id as string;

    // Active waiting rule (30m) scoped to our subject → set priority urgent.
    const { data: r1 } = await admin.from("automation_rules").insert({
      organisation_id: orgId, name: `SWEEP waiting ${subject}`, status: "active", position: 950,
      trigger_type: "conversation.waiting", trigger_config: { minutes: 30 },
      conditions: [{ field: "subject", op: "eq", value: subject }],
      actions: [{ type: "set_priority", value: "urgent" }],
    }).select("id").single();
    ruleIds.push(r1!.id as string);
  });

  afterAll(async () => {
    if (!admin) return;
    for (const id of ruleIds) {
      await admin.from("automation_runs").delete().eq("rule_id", id);
      await admin.from("automation_rules").delete().eq("id", id);
    }
    for (const id of [waitingConvId, slaConvId]) if (id) await admin.from("conversations").delete().eq("id", id);
  });

  it("fires a waiting rule, marks SLA breaches, and is fire-once", async () => {
    // Sweeps iterate every candidate conversation against the cloud DB.
    const res1 = await runTimeSweep(admin);
    expect(res1.fired).toBeGreaterThanOrEqual(1);

    const { data: c } = await admin.from("conversations").select("priority").eq("id", waitingConvId).single();
    expect(c!.priority).toBe("urgent");

    const { data: sla } = await admin.from("conversations").select("sla_breached").eq("id", slaConvId).single();
    expect(sla!.sla_breached).toBe(true);

    const { data: runs1 } = await admin.from("automation_runs").select("id").eq("rule_id", ruleIds[0]).eq("conversation_id", waitingConvId);
    expect((runs1 ?? []).length).toBe(1);

    // Second sweep must not fire the same rule again for the same conversation.
    await runTimeSweep(admin);
    const { data: runs2 } = await admin.from("automation_runs").select("id").eq("rule_id", ruleIds[0]).eq("conversation_id", waitingConvId);
    expect((runs2 ?? []).length).toBe(1);
  }, 90_000);
});
