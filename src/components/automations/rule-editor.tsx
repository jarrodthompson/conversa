"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, X, Save, Play, Zap, Filter, PlayCircle, CheckCircle2, MinusCircle,
} from "lucide-react";
import {
  TRIGGERS, CONDITION_FIELDS, OPERATORS, ACTIONS, triggerDef, actionDef, fieldDef,
  type RuleCondition, type RuleAction,
} from "@/lib/automations/catalogue";
import { saveRuleAction, testRuleAction } from "@/lib/automations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const selectCls = "h-9 w-full rounded-[10px] border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

interface RunRow { id: string; result: string; detail: unknown; created_at: string }

export function RuleEditor({
  id, initialName, initialStatus, initialTrigger, initialConfig,
  initialConditions, initialActions, runs,
}: {
  id: string;
  initialName: string;
  initialStatus: string;
  initialTrigger: string;
  initialConfig: Record<string, string>;
  initialConditions: RuleCondition[];
  initialActions: RuleAction[];
  runs: RunRow[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [trigger, setTrigger] = useState(initialTrigger);
  const [config, setConfig] = useState<Record<string, string>>(initialConfig);
  const [conditions, setConditions] = useState<RuleCondition[]>(initialConditions);
  const [actions, setActions] = useState<RuleAction[]>(initialActions);
  const [pending, start] = useTransition();
  const [testResult, setTestResult] = useState<{ matched: boolean; details: { condition: string; pass: boolean }[]; wouldRun: string[]; conversation?: string } | null>(null);

  const trig = triggerDef(trigger);

  function save(then?: () => void) {
    start(async () => {
      const res = await saveRuleAction(id, {
        name, trigger_type: trigger, trigger_config: config, conditions, actions,
      });
      if (res?.error) toast.error(res.error);
      else { toast.success("Rule saved"); then?.(); }
    });
  }

  function test() {
    start(async () => {
      const res = await saveRuleAction(id, { name, trigger_type: trigger, trigger_config: config, conditions, actions });
      if (res?.error) { toast.error(res.error); return; }
      const t = await testRuleAction(id);
      if (t?.error) { toast.error(t.error); return; }
      setTestResult({
        matched: t.matched ?? false,
        details: t.details ?? [],
        wouldRun: t.wouldRun ?? [],
        conversation: t.conversation,
      });
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <Link href="/app/automations" className="flex size-8 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted"><ArrowLeft className="size-4" /></Link>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-64 rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-sm font-semibold outline-none hover:border-border focus:border-ring" />
        <Badge variant={initialStatus === "active" ? "success" : "muted"}>{initialStatus}</Badge>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={test} disabled={pending}><Play className="size-4" /> Test</Button>
          <Button size="sm" onClick={() => save(() => router.refresh())} disabled={pending}><Save className="size-4" /> Save</Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl space-y-4">
            {/* WHEN */}
            <Section step="When" icon={Zap} tint="#10B981" title="this happens (trigger)">
              <select value={trigger} onChange={(e) => { setTrigger(e.target.value); setConfig({}); }} className={selectCls}>
                {TRIGGERS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              {trig?.description && <p className="mt-2 text-xs text-muted-foreground">{trig.description}</p>}
              {trig?.config && (
                <div className="mt-3">
                  <Label>{trig.config.label}</Label>
                  <Input
                    className="mt-1"
                    type={trig.config.type}
                    placeholder={trig.config.placeholder}
                    value={config[trig.config.key] ?? ""}
                    onChange={(e) => setConfig({ ...config, [trig.config!.key]: e.target.value })}
                  />
                </div>
              )}
            </Section>

            {/* IF */}
            <Section step="If" icon={Filter} tint="#F59E0B" title="these conditions are met (all)">
              {conditions.length === 0 && <p className="text-sm text-muted-foreground">No conditions — the rule always matches.</p>}
              <div className="space-y-2">
                {conditions.map((c, i) => {
                  const f = fieldDef(c.field);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <select value={c.field} onChange={(e) => updateCond(setConditions, conditions, i, { field: e.target.value })} className={cn(selectCls, "flex-1")}>
                        {CONDITION_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </select>
                      <select value={c.op} onChange={(e) => updateCond(setConditions, conditions, i, { op: e.target.value })} className={cn(selectCls, "w-28")}>
                        {OPERATORS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                      </select>
                      {c.op !== "not_empty" && (
                        f?.type === "select" ? (
                          <select value={c.value ?? ""} onChange={(e) => updateCond(setConditions, conditions, i, { value: e.target.value })} className={cn(selectCls, "flex-1")}>
                            <option value="">—</option>
                            {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <Input className="flex-1" value={c.value ?? ""} onChange={(e) => updateCond(setConditions, conditions, i, { value: e.target.value })} placeholder="value" />
                        )
                      )}
                      <button onClick={() => setConditions(conditions.filter((_, j) => j !== i))} className="rounded-md p-2 text-muted-foreground hover:bg-error/10 hover:text-error"><X className="size-4" /></button>
                    </div>
                  );
                })}
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setConditions([...conditions, { field: "channel_type", op: "eq", value: "" }])}>
                <Plus className="size-4" /> Add condition
              </Button>
            </Section>

            {/* THEN */}
            <Section step="Then" icon={PlayCircle} tint="#06B6D4" title="do these actions">
              {actions.length === 0 && <p className="text-sm text-muted-foreground">No actions yet — add at least one.</p>}
              <div className="space-y-2">
                {actions.map((a, i) => {
                  const def = actionDef(a.type);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <select value={a.type} onChange={(e) => updateAction(setActions, actions, i, { type: e.target.value, value: "" })} className={cn(selectCls, "flex-1")}>
                        {ACTIONS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                      </select>
                      {def?.param && (
                        def.param.type === "select" ? (
                          <select value={a.value ?? ""} onChange={(e) => updateAction(setActions, actions, i, { value: e.target.value })} className={cn(selectCls, "flex-1")}>
                            <option value="">—</option>
                            {def.param.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <Input className="flex-1" value={a.value ?? ""} onChange={(e) => updateAction(setActions, actions, i, { value: e.target.value })} placeholder={def.param.placeholder ?? def.param.label} />
                        )
                      )}
                      <button onClick={() => setActions(actions.filter((_, j) => j !== i))} className="rounded-md p-2 text-muted-foreground hover:bg-error/10 hover:text-error"><X className="size-4" /></button>
                    </div>
                  );
                })}
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setActions([...actions, { type: "add_tag", value: "" }])}>
                <Plus className="size-4" /> Add action
              </Button>
            </Section>
          </div>
        </div>

        {/* Right: test result + history */}
        <aside className="w-80 shrink-0 space-y-5 overflow-y-auto border-l border-border bg-card p-5">
          <div>
            <h3 className="text-sm font-semibold">Test result</h3>
            {!testResult ? (
              <p className="mt-2 text-xs text-muted-foreground">Click <strong>Test</strong> to evaluate this rule against your most recent conversation.</p>
            ) : (
              <div className="mt-2 space-y-2">
                <div className={cn("flex items-center gap-1.5 text-sm font-medium", testResult.matched ? "text-success" : "text-muted-foreground")}>
                  {testResult.matched ? <CheckCircle2 className="size-4" /> : <MinusCircle className="size-4" />}
                  {testResult.matched ? "Conditions matched" : "Did not match"}
                </div>
                {testResult.conversation && <p className="text-xs text-muted-foreground">Tested on: “{testResult.conversation}”</p>}
                <ul className="space-y-1">
                  {testResult.details.map((d, i) => (
                    <li key={i} className={cn("text-xs", d.pass ? "text-success" : "text-error")}>{d.pass ? "✓" : "✕"} {d.condition}</li>
                  ))}
                </ul>
                {testResult.wouldRun.length > 0 && (
                  <div className="rounded-[8px] bg-secondary/60 p-2">
                    <p className="text-xs font-medium text-primary">Would run:</p>
                    <p className="text-xs text-foreground">{testResult.wouldRun.map((t) => actionDef(t)?.label ?? t).join(", ")}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold">Recent runs</h3>
            {runs.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No runs yet.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {runs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-[8px] border border-border px-2.5 py-1.5">
                    <Badge variant={r.result === "success" ? "success" : r.result === "skipped" ? "muted" : "error"}>{r.result}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ step, icon: Icon, tint, title, children }: { step: string; icon: typeof Zap; tint: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-[8px]" style={{ background: `${tint}1a`, color: tint }}><Icon className="size-4" /></span>
        <span className="text-sm font-semibold">{step}</span>
        <span className="text-sm text-muted-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

function updateCond(setter: (v: RuleCondition[]) => void, arr: RuleCondition[], i: number, patch: Partial<RuleCondition>) {
  setter(arr.map((c, j) => (j === i ? { ...c, ...patch } : c)));
}
function updateAction(setter: (v: RuleAction[]) => void, arr: RuleAction[], i: number, patch: Partial<RuleAction>) {
  setter(arr.map((a, j) => (j === i ? { ...a, ...patch } : a)));
}
