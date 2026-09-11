import { notFound } from "next/navigation";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { RuleEditor } from "@/components/automations/rule-editor";
import type { RuleCondition, RuleAction } from "@/lib/automations/catalogue";

export default async function RuleEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { org } = await getAppContext();
  const supabase = await createClient();

  const { data: rule } = await supabase
    .from("automation_rules")
    .select("id, name, status, trigger_type, trigger_config, conditions, actions")
    .eq("organisation_id", org.id).eq("id", id).is("deleted_at", null)
    .maybeSingle();
  if (!rule) notFound();

  const { data: runs } = await supabase
    .from("automation_runs")
    .select("id, result, detail, created_at")
    .eq("rule_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = rule as any;
  return (
    <RuleEditor
      id={r.id}
      initialName={r.name}
      initialStatus={r.status}
      initialTrigger={r.trigger_type}
      initialConfig={(r.trigger_config ?? {}) as Record<string, string>}
      initialConditions={(r.conditions ?? []) as RuleCondition[]}
      initialActions={(r.actions ?? []) as RuleAction[]}
      runs={(runs ?? []) as { id: string; result: string; detail: unknown; created_at: string }[]}
    />
  );
}
