import type { SupabaseClient } from "@supabase/supabase-js";
import { runAutomations } from "@/lib/automations/engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>;

const TIME_EVENTS = ["conversation.waiting", "conversation.idle", "sla.at_risk"] as const;

export interface SweepResult {
  orgs: number;
  slaBreached: number;
  fired: number;
  candidates: number;
}

/**
 * Time-based automation sweep. Intended to be run on a schedule (cron). For each
 * org with active time-based rules it:
 *   1. marks overdue conversations as SLA-breached,
 *   2. selects candidate conversations, and
 *   3. drives the engine for the relevant time events (which enforces each
 *      rule's exact timing and fires once per conversation).
 */
export async function runTimeSweep(db: DB): Promise<SweepResult> {
  const result: SweepResult = { orgs: 0, slaBreached: 0, fired: 0, candidates: 0 };

  // Orgs with active time-based rules, and which events each has.
  const { data: rules } = await db
    .from("automation_rules")
    .select("organisation_id, trigger_type")
    .eq("status", "active")
    .in("trigger_type", TIME_EVENTS as unknown as string[])
    .is("deleted_at", null);

  const eventsByOrg = new Map<string, Set<string>>();
  for (const r of (rules ?? []) as { organisation_id: string; trigger_type: string }[]) {
    if (!eventsByOrg.has(r.organisation_id)) eventsByOrg.set(r.organisation_id, new Set());
    eventsByOrg.get(r.organisation_id)!.add(r.trigger_type);
  }

  const now = new Date().toISOString();

  for (const [orgId, events] of eventsByOrg) {
    result.orgs++;

    // 1. Mark overdue SLAs as breached (independent of rules).
    const { data: breached } = await db
      .from("conversations")
      .update({ sla_breached: true })
      .eq("organisation_id", orgId)
      .not("status", "in", "(resolved,spam)")
      .eq("sla_breached", false)
      .not("sla_due_at", "is", null)
      .lt("sla_due_at", now)
      .select("id");
    result.slaBreached += (breached ?? []).length;

    // 2. Waiting / idle candidates: unresolved conversations idle for 25m+.
    if (events.has("conversation.waiting") || events.has("conversation.idle")) {
      const cutoff = new Date(Date.now() - 25 * 60000).toISOString();
      const { data: candidates } = await db
        .from("conversations")
        .select("id, last_message_preview")
        .eq("organisation_id", orgId)
        .not("status", "in", "(resolved,spam,snoozed)")
        .lt("last_message_at", cutoff)
        .limit(300);
      for (const c of (candidates ?? []) as { id: string; last_message_preview: string | null }[]) {
        result.candidates++;
        for (const ev of ["conversation.waiting", "conversation.idle"] as const) {
          if (events.has(ev)) {
            const r = await runAutomations(db, { orgId, conversationId: c.id, event: ev, body: c.last_message_preview ?? "" });
            result.fired += r.fired;
          }
        }
      }
    }

    // 3. SLA at-risk candidates: due within the next 60 minutes, not breached.
    if (events.has("sla.at_risk")) {
      const soon = new Date(Date.now() + 60 * 60000).toISOString();
      const { data: candidates } = await db
        .from("conversations")
        .select("id")
        .eq("organisation_id", orgId)
        .not("status", "in", "(resolved,spam)")
        .eq("sla_breached", false)
        .not("sla_due_at", "is", null)
        .gt("sla_due_at", now)
        .lt("sla_due_at", soon)
        .limit(300);
      for (const c of (candidates ?? []) as { id: string }[]) {
        result.candidates++;
        const r = await runAutomations(db, { orgId, conversationId: c.id, event: "sla.at_risk" });
        result.fired += r.fired;
      }
    }
  }

  return result;
}
