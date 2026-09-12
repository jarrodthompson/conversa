import { Zap } from "lucide-react";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { createRuleAction } from "@/lib/automations/actions";
import { AutomationList, type RuleRow } from "@/components/automations/automation-list";

export default async function AutomationsPage() {
  const { org } = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("automation_rules")
    .select("id, name, status, position, trigger_type, conditions, actions, run_count, last_run_at")
    .eq("organisation_id", org.id)
    .is("deleted_at", null)
    .order("position", { ascending: true });
  const rules = (data ?? []) as unknown as RuleRow[];

  return (
    <div className="h-full overflow-y-auto p-6">
      <PageHeader
        title="Automations"
        description="Run actions automatically when things happen. Rules are evaluated top to bottom."
        actions={
          <form action={createRuleAction}>
            <Button size="sm" type="submit"><Zap className="size-4" /> New rule</Button>
          </form>
        }
      />

      <div className="mt-6 max-w-4xl">
        {rules.length === 0 ? (
          <EmptyState icon={Zap} title="No automation rules" description="Create a rule to assign, tag, prioritise or escalate conversations automatically." />
        ) : (
          <AutomationList rules={rules} />
        )}
      </div>

      <p className="mt-4 max-w-4xl text-xs text-muted-foreground">
        Drag to reorder. Rules run in <strong>position order</strong> with loop
        protection. <code className="rounded bg-muted px-1">message.inbound</code>{" "}
        rules now fire automatically on incoming WhatsApp & email messages; use{" "}
        <strong>Test</strong> to dry-run a rule against your most recent conversation.
      </p>
    </div>
  );
}
