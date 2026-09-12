import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateConditions } from "@/lib/automations/evaluate";
import type { RuleCondition, RuleAction } from "@/lib/automations/catalogue";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>;

const MAX_DEPTH = 5;

export interface AutomationEvent {
  orgId: string;
  conversationId: string;
  event: string; // e.g. "message.inbound", "conversation.created", "tag.added"
  body?: string; // inbound message text, for keyword triggers / body conditions
}

export interface EngineResult {
  fired: number;
  skipped: number;
}

interface RuleRow {
  id: string;
  name: string;
  position: number;
  trigger_type: string;
  trigger_config: Record<string, unknown> | null;
  conditions: RuleCondition[] | null;
  actions: RuleAction[] | null;
  run_count: number;
}

async function conversationRecord(db: DB, orgId: string, conversationId: string, body?: string) {
  const { data } = await db
    .from("conversations")
    .select("channel_type, priority, status, sentiment, is_ai_handled, subject, last_message_preview")
    .eq("organisation_id", orgId).eq("id", conversationId).maybeSingle();
  return { ...(data ?? {}), body: body ?? "" } as Record<string, unknown>;
}

async function resolveTeamId(db: DB, orgId: string, name: string) {
  const { data } = await db.from("teams").select("id").eq("organisation_id", orgId).ilike("name", name).maybeSingle();
  return data?.id as string | undefined;
}

async function ensureTag(db: DB, orgId: string, name: string) {
  await db.from("tags").upsert({ organisation_id: orgId, name }, { onConflict: "organisation_id,name", ignoreDuplicates: true });
  const { data } = await db.from("tags").select("id").eq("organisation_id", orgId).eq("name", name).maybeSingle();
  return data?.id as string | undefined;
}

async function notifyManagers(db: DB, orgId: string, title: string, body: string, link: string) {
  const { data: managers } = await db
    .from("organisation_members")
    .select("user_id")
    .eq("organisation_id", orgId).eq("status", "active")
    .in("role", ["owner", "org_admin", "support_manager"]);
  const rows = (managers ?? []).map((m: { user_id: string }) => ({
    organisation_id: orgId, user_id: m.user_id, type: "automation", title, body, link,
  }));
  if (rows.length) await db.from("notifications").insert(rows);
}

/** Executes one action. Returns the follow-on event it emits, if any. */
async function runAction(db: DB, ev: AutomationEvent, action: RuleAction): Promise<string | null> {
  const { orgId, conversationId } = ev;
  // Accept the editor shape ({value}) and legacy/seed shapes ({team}/{tag}/{priority}).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = action as any;
  const value = String(action.value ?? a.team ?? a.tag ?? a.priority ?? a.url ?? a.hours ?? "").trim();

  switch (action.type) {
    case "assign_team": {
      if (!value) break;
      const teamId = await resolveTeamId(db, orgId, value);
      if (teamId) await db.from("conversations").update({ team_id: teamId }).eq("id", conversationId).eq("organisation_id", orgId);
      break;
    }
    case "assign_user": {
      const { data: m } = await db
        .from("organisation_members")
        .select("user_id, profile:user_profiles(full_name)")
        .eq("organisation_id", orgId).eq("status", "active");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const match = (m ?? []).find((r: any) => (r.profile?.full_name ?? r.profile?.[0]?.full_name ?? "").toLowerCase().includes(value.toLowerCase()));
      if (match) await db.from("conversations").update({ assignee_id: match.user_id }).eq("id", conversationId).eq("organisation_id", orgId);
      break;
    }
    case "reassign": {
      const { data: conv0 } = await db.from("conversations").select("team_id").eq("id", conversationId).maybeSingle();
      let members: { user_id: string }[] = [];
      if (conv0?.team_id) {
        const { data } = await db.from("team_members").select("user_id").eq("team_id", conv0.team_id);
        members = data ?? [];
      }
      if (members.length) {
        const pick = members[Date.now() % members.length];
        await db.from("conversations").update({ assignee_id: pick.user_id }).eq("id", conversationId).eq("organisation_id", orgId);
      }
      break;
    }
    case "add_tag": {
      if (!value) break;
      const tagId = await ensureTag(db, orgId, value);
      if (tagId) await db.from("conversation_tags").upsert({ conversation_id: conversationId, tag_id: tagId }, { onConflict: "conversation_id,tag_id", ignoreDuplicates: true });
      return "tag.added";
    }
    case "set_priority":
      await db.from("conversations").update({ priority: value || "high" }).eq("id", conversationId).eq("organisation_id", orgId);
      return "priority.changed";
    case "escalate":
      await db.from("conversations").update({ priority: "urgent" }).eq("id", conversationId).eq("organisation_id", orgId);
      await notifyManagers(db, orgId, "Conversation escalated", "An automation escalated a conversation.", `/app/inbox?c=${conversationId}`);
      return "priority.changed";
    case "resolve":
      await db.from("conversations").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", conversationId).eq("organisation_id", orgId);
      return "conversation.resolved";
    case "snooze": {
      const hours = Number(value) || 12;
      await db.from("conversations").update({ status: "snoozed", snoozed_until: new Date(Date.now() + hours * 3600000).toISOString() }).eq("id", conversationId).eq("organisation_id", orgId);
      break;
    }
    case "notify_manager":
      await notifyManagers(db, orgId, "Automation alert", "A rule flagged a conversation for your attention.", `/app/inbox?c=${conversationId}`);
      break;
    case "send_saved_reply": {
      const { data: reply } = await db.from("saved_replies").select("body").eq("organisation_id", orgId).ilike("title", value).maybeSingle();
      const text = reply?.body ?? value;
      if (text) {
        await db.from("messages").insert({
          organisation_id: orgId, conversation_id: conversationId, direction: "outbound",
          author_type: "bot", body: text, delivery_status: "sent", metadata: { automation: true },
        });
        await db.from("conversations").update({ last_message_at: new Date().toISOString(), last_message_preview: text.slice(0, 80) }).eq("id", conversationId);
      }
      break;
    }
    case "start_chatbot": {
      const { data: flow } = await db.from("chatbot_flows").select("id, current_version").eq("organisation_id", orgId).ilike("name", value).maybeSingle();
      if (flow) await db.from("chatbot_runs").insert({ organisation_id: orgId, flow_id: flow.id, conversation_id: conversationId, version: flow.current_version, status: "running" });
      break;
    }
    case "call_webhook":
      if (value) {
        try {
          await fetch(value, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: ev.event, organisation_id: orgId, conversation_id: conversationId }) });
        } catch { /* best-effort */ }
      }
      break;
    default:
      break;
  }
  return null;
}

/**
 * Runs active automation rules for an event. Rules fire in `position` order; each
 * rule fires at most once per cascade (via `firedRuleIds`), and cascades are
 * capped at MAX_DEPTH — together these guarantee termination (loop protection).
 * Uses a service-role client; intended to be called from trusted server code
 * (channel webhooks). Every fired rule records an automation_runs row.
 */
export async function runAutomations(
  db: DB,
  ev: AutomationEvent,
  depth = 0,
  firedRuleIds: Set<string> = new Set(),
): Promise<EngineResult> {
  const result: EngineResult = { fired: 0, skipped: 0 };
  if (depth > MAX_DEPTH) return result;

  const { data: rules } = await db
    .from("automation_rules")
    .select("id, name, position, trigger_type, trigger_config, conditions, actions, run_count")
    .eq("organisation_id", ev.orgId)
    .eq("status", "active")
    .eq("trigger_type", ev.event)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  const record = await conversationRecord(db, ev.orgId, ev.conversationId, ev.body);
  const followOn = new Set<string>();

  for (const rule of (rules ?? []) as RuleRow[]) {
    if (firedRuleIds.has(rule.id)) continue;

    // Keyword filter for inbound messages.
    const keyword = (rule.trigger_config?.keyword as string | undefined)?.trim();
    if (ev.event === "message.inbound" && keyword) {
      if (!(ev.body ?? "").toLowerCase().includes(keyword.toLowerCase())) continue;
    }

    const evalResult = evaluateConditions(rule.conditions ?? [], record);
    if (!evalResult.matched) {
      result.skipped++;
      continue;
    }

    firedRuleIds.add(rule.id);
    const ran: string[] = [];
    for (const action of rule.actions ?? []) {
      try {
        const emitted = await runAction(db, ev, action);
        ran.push(action.type);
        if (emitted) followOn.add(emitted);
      } catch (err) {
        await db.from("integration_logs").insert({
          organisation_id: ev.orgId, level: "error",
          message: `Automation "${rule.name}" action ${action.type} failed`,
          context: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }

    await db.from("automation_runs").insert({
      organisation_id: ev.orgId, rule_id: rule.id, conversation_id: ev.conversationId,
      result: "success", depth, detail: { event: ev.event, actions: ran },
    });
    await db.from("automation_rules").update({ run_count: (rule.run_count ?? 0) + 1, last_run_at: new Date().toISOString() }).eq("id", rule.id);
    result.fired++;
  }

  // Bounded cascade for follow-on events.
  for (const nextEvent of followOn) {
    const r = await runAutomations(db, { ...ev, event: nextEvent }, depth + 1, firedRuleIds);
    result.fired += r.fired;
    result.skipped += r.skipped;
  }

  return result;
}
