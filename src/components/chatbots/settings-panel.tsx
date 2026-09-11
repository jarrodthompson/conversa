"use client";

import { Trash2 } from "lucide-react";
import { NODE_DEFS, type FlowNode, type NodeType } from "@/lib/chatbots/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Props {
  node: FlowNode | null;
  onChange: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}

export function SettingsPanel({ node, onChange, onDelete }: Props) {
  if (!node) {
    return (
      <div className="p-5 text-sm text-muted-foreground">
        Select a node to edit its settings, or drag one from the palette on the left.
      </div>
    );
  }
  const def = NODE_DEFS[node.type as NodeType];
  const d = node.data;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <span className="flex size-7 items-center justify-center rounded-[8px]" style={{ background: `${def.color}1a`, color: def.color }}>
          <def.icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{def.label}</p>
          <p className="truncate text-xs text-muted-foreground">{def.category}</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {node.type === "send_message" && (
          <Field label="Message">
            <Textarea value={String(d.message ?? "")} onChange={(e) => onChange({ message: e.target.value })} rows={4} />
          </Field>
        )}

        {node.type === "ask_question" && (
          <>
            <Field label="Question"><Textarea value={String(d.question ?? "")} onChange={(e) => onChange({ question: e.target.value })} rows={3} /></Field>
            <Field label="Save answer to variable"><Input value={String(d.variable ?? "")} onChange={(e) => onChange({ variable: e.target.value })} /></Field>
          </>
        )}

        {node.type === "multiple_choice" && (
          <>
            <Field label="Prompt"><Textarea value={String(d.prompt ?? "")} onChange={(e) => onChange({ prompt: e.target.value })} rows={2} /></Field>
            <Field label="Options (one per line)">
              <Textarea
                value={((d.options as string[]) ?? []).join("\n")}
                onChange={(e) => onChange({ options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                rows={4}
              />
              <p className="mt-1 text-xs text-muted-foreground">Each option becomes a branch handle on the node.</p>
            </Field>
          </>
        )}

        {node.type === "condition" && (
          <>
            <Field label="Variable / field"><Input value={String(d.field ?? "")} onChange={(e) => onChange({ field: e.target.value })} /></Field>
            <Field label="Operator">
              <select value={String(d.op ?? "contains")} onChange={(e) => onChange({ op: e.target.value })} className="h-9 w-full rounded-[10px] border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40">
                <option value="contains">contains</option>
                <option value="equals">equals</option>
                <option value="starts_with">starts with</option>
                <option value="not_empty">is not empty</option>
              </select>
            </Field>
            <Field label="Value"><Input value={String(d.value ?? "")} onChange={(e) => onChange({ value: e.target.value })} /></Field>
          </>
        )}

        {node.type === "collect_order" && (
          <Field label="Save order number to"><Input value={String(d.variable ?? "")} onChange={(e) => onChange({ variable: e.target.value })} /></Field>
        )}

        {node.type === "assign_team" && (
          <Field label="Team"><Input value={String(d.team ?? "")} onChange={(e) => onChange({ team: e.target.value })} /></Field>
        )}
        {node.type === "human_handoff" && (
          <Field label="Route to team"><Input value={String(d.team ?? "")} onChange={(e) => onChange({ team: e.target.value })} /></Field>
        )}
        {node.type === "add_tag" && (
          <Field label="Tag"><Input value={String(d.tag ?? "")} onChange={(e) => onChange({ tag: e.target.value })} /></Field>
        )}
        {node.type === "update_field" && (
          <>
            <Field label="Field"><Input value={String(d.field ?? "")} onChange={(e) => onChange({ field: e.target.value })} /></Field>
            <Field label="Value"><Input value={String(d.value ?? "")} onChange={(e) => onChange({ value: e.target.value })} /></Field>
          </>
        )}
        {node.type === "webhook" && (
          <>
            <Field label="URL"><Input value={String(d.url ?? "")} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://…" /></Field>
            <Field label="Method">
              <select value={String(d.method ?? "POST")} onChange={(e) => onChange({ method: e.target.value })} className="h-9 w-full rounded-[10px] border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40">
                <option>POST</option><option>GET</option><option>PUT</option>
              </select>
            </Field>
          </>
        )}
        {node.type === "delay" && (
          <Field label="Delay (seconds)"><Input type="number" value={Number(d.seconds ?? 0)} onChange={(e) => onChange({ seconds: Number(e.target.value) })} /></Field>
        )}
        {node.type === "knowledge_search" && (
          <Field label="Search query"><Input value={String(d.query ?? "")} onChange={(e) => onChange({ query: e.target.value })} /></Field>
        )}

        {(node.type === "start" || node.type === "end" || node.type === "business_hours" ||
          node.type === "collect_contact" || node.type === "ai_response" || node.type === "assign_agent") && (
          <p className="rounded-[10px] bg-muted/60 p-3 text-xs text-muted-foreground">{def.description}</p>
        )}
      </div>

      {node.type !== "start" && (
        <div className="border-t border-border p-4">
          <Button variant="destructive" size="sm" className="w-full" onClick={onDelete}>
            <Trash2 className="size-4" /> Delete node
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
