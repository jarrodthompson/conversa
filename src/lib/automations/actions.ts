"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/auth/context";
import { evaluateConditions } from "@/lib/automations/evaluate";
import type { Json } from "@/lib/supabase/types";
import type { RuleCondition, RuleAction } from "@/lib/automations/catalogue";

const asJson = (v: unknown): Json => v as Json;

async function ctx() {
  const { org, userId } = await getAppContext();
  const supabase = await createClient();
  return { supabase, orgId: org.id, userId };
}

export async function createRuleAction() {
  const { supabase, orgId, userId } = await ctx();
  const { count } = await supabase
    .from("automation_rules")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", orgId);
  const { data, error } = await supabase
    .from("automation_rules")
    .insert({
      organisation_id: orgId, name: "Untitled rule", status: "disabled",
      position: count ?? 0, trigger_type: "message.inbound", trigger_config: {},
      conditions: [], actions: [], created_by: userId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create rule");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redirect(`/app/automations/${(data as any).id}`);
}

export async function saveRuleAction(
  id: string,
  payload: {
    name: string;
    trigger_type: string;
    trigger_config: Record<string, unknown>;
    conditions: RuleCondition[];
    actions: RuleAction[];
  },
) {
  const { supabase, orgId } = await ctx();
  const { error } = await supabase
    .from("automation_rules")
    .update({
      name: payload.name,
      trigger_type: payload.trigger_type,
      trigger_config: asJson(payload.trigger_config),
      conditions: asJson(payload.conditions),
      actions: asJson(payload.actions),
    })
    .eq("id", id)
    .eq("organisation_id", orgId);
  if (error) return { error: error.message };
  revalidatePath(`/app/automations/${id}`);
  revalidatePath("/app/automations");
  return { ok: true };
}

export async function toggleRuleAction(id: string, status: "active" | "disabled") {
  const { supabase, orgId } = await ctx();
  const { error } = await supabase
    .from("automation_rules")
    .update({ status })
    .eq("id", id)
    .eq("organisation_id", orgId);
  if (error) return { error: error.message };
  revalidatePath("/app/automations");
  return { ok: true };
}

export async function reorderRulesAction(orderedIds: string[]) {
  const { supabase, orgId } = await ctx();
  await Promise.all(
    orderedIds.map((id, position) =>
      supabase.from("automation_rules").update({ position }).eq("id", id).eq("organisation_id", orgId),
    ),
  );
  revalidatePath("/app/automations");
  return { ok: true };
}

export async function deleteRuleAction(id: string) {
  const { supabase, orgId } = await ctx();
  await supabase.from("automation_rules").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("organisation_id", orgId);
  revalidatePath("/app/automations");
  return { ok: true };
}

/**
 * Simulates running the rule against the most recent conversation: evaluates the
 * conditions, records an automation_runs row, and reports which actions would
 * fire. (The live event-driven engine is a separate build-out.)
 */
export async function testRuleAction(id: string) {
  const { supabase, orgId } = await ctx();
  const { data: rule } = await supabase
    .from("automation_rules")
    .select("conditions, actions")
    .eq("id", id).eq("organisation_id", orgId).maybeSingle();
  if (!rule) return { error: "Rule not found" };

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, channel_type, priority, status, sentiment, is_ai_handled, subject, last_message_preview")
    .eq("organisation_id", orgId).is("deleted_at", null)
    .order("last_message_at", { ascending: false }).limit(1).maybeSingle();
  if (!conv) return { error: "No conversation to test against" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = rule as any;
  const evalResult = evaluateConditions((r.conditions ?? []) as RuleCondition[], conv as Record<string, unknown>);
  const actions = (r.actions ?? []) as RuleAction[];

  await supabase.from("automation_runs").insert({
    organisation_id: orgId,
    rule_id: id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conversation_id: (conv as any).id,
    result: evalResult.matched ? "success" : "skipped",
    detail: asJson({ evaluated: evalResult.details, wouldRun: evalResult.matched ? actions.map((a) => a.type) : [] }),
    depth: 0,
  });

  await supabase.from("automation_rules")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", id).eq("organisation_id", orgId);

  revalidatePath(`/app/automations/${id}`);
  return {
    ok: true,
    matched: evalResult.matched,
    details: evalResult.details,
    wouldRun: evalResult.matched ? actions.map((a) => a.type) : [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conversation: (conv as any).subject as string,
  };
}
