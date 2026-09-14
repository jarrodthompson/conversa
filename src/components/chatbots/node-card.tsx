"use client";

import { useDraggable } from "@dnd-kit/core";
import { AlertTriangle } from "lucide-react";
import { NODE_DEFS, handlesForNode, type FlowNode, type NodeType } from "@/lib/chatbots/types";
import { NODE_W, NODE_H } from "@/lib/chatbots/geometry";
import { cn } from "@/lib/utils";

interface Props {
  node: FlowNode;
  scale: number;
  selected: boolean;
  connecting: boolean;
  hasIssue: boolean;
  onSelect: () => void;
  onStartConnect: (handleId: string) => void;
  onCompleteConnect: () => void;
}

export function NodeCard({
  node, scale, selected, connecting, hasIssue,
  onSelect, onStartConnect, onCompleteConnect,
}: Props) {
  const def = NODE_DEFS[node.type as NodeType];
  const Icon = def.icon;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: node.id });

  const tx = transform ? transform.x / scale : 0;
  const ty = transform ? transform.y / scale : 0;

  const summary = nodeSummary(node);

  return (
    <div
      ref={setNodeRef}
      className="absolute"
      style={{
        left: node.position.x,
        top: node.position.y,
        width: NODE_W,
        transform: `translate(${tx}px, ${ty}px)`,
        zIndex: isDragging || selected ? 20 : 10,
      }}
    >
      {/* input handle */}
      {def.type !== "start" && (
        <span
          onClick={(e) => { e.stopPropagation(); if (connecting) onCompleteConnect(); }}
          className={cn(
            "absolute left-1/2 top-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card",
            connecting ? "bg-primary ring-2 ring-primary/40" : "bg-border",
          )}
        />
      )}

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (connecting) onCompleteConnect(); else onSelect(); }}
        {...listeners}
        {...attributes}
        className={cn(
          "flex w-full cursor-grab items-center gap-2.5 rounded-[12px] border bg-card px-3 py-2.5 text-left shadow-sm active:cursor-grabbing",
          selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-cyan-400",
        )}
        style={{ height: NODE_H }}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px]" style={{ background: `${def.color}1a`, color: def.color }}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{def.label}</span>
          <span className="block truncate text-xs text-muted-foreground">{summary}</span>
        </span>
        {hasIssue && <AlertTriangle className="size-4 shrink-0 text-warning" />}
      </button>

      {/* output handles (multiple_choice derives one per option) */}
      {handlesForNode(node).map((h, i, arr) => {
        const k = arr.length;
        const left = ((i + 1) / (k + 1)) * 100;
        return (
          <span key={h.id} className="absolute" style={{ left: `${left}%`, top: NODE_H, transform: "translate(-50%,-50%)" }}>
            <button
              type="button"
              title={h.label || "Connect"}
              onClick={(e) => { e.stopPropagation(); onStartConnect(h.id); }}
              className="size-3 rounded-full border-2 border-card bg-primary hover:ring-2 hover:ring-primary/40"
            />
            {h.label && (
              <span className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-muted-foreground">
                {h.label}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function nodeSummary(n: FlowNode): string {
  const d = n.data;
  switch (n.type) {
    case "send_message": return String(d.message ?? "");
    case "ask_question": return String(d.question ?? "");
    case "multiple_choice": return ((d.options as string[]) ?? []).join(" · ");
    case "condition": return `${d.field ?? "?"} ${d.op ?? ""} ${d.value ?? ""}`;
    case "assign_team": return `Team: ${d.team ?? "?"}`;
    case "add_tag": return d.tag ? `Tag: ${d.tag}` : "No tag set";
    case "delay": return `${d.seconds ?? 0}s`;
    case "collect_order": return `→ ${d.variable ?? "order_number"}`;
    default: return NODE_DEFS[n.type as NodeType].description;
  }
}
