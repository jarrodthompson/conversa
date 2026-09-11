"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { triggerDef } from "@/lib/automations/catalogue";
import { toggleRuleAction, reorderRulesAction, deleteRuleAction } from "@/lib/automations/actions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface RuleRow {
  id: string; name: string; status: string; position: number;
  trigger_type: string; conditions: unknown[]; actions: unknown[];
  run_count: number; last_run_at: string | null;
}

export function AutomationList({ rules }: { rules: RuleRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(rules);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    reorderRulesAction(next.map((i) => i.id)).then(() => router.refresh());
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {items.map((rule, idx) => (
            <SortableRule key={rule.id} rule={rule} index={idx} onChanged={() => router.refresh()} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRule({ rule, index, onChanged }: { rule: RuleRow; index: number; onChanged: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rule.id });
  const trig = triggerDef(rule.trigger_type);
  const active = rule.status === "active";

  async function toggle() {
    const res = await toggleRuleAction(rule.id, active ? "disabled" : "active");
    if (res?.error) toast.error(res.error);
    else { toast.success(active ? "Rule disabled" : "Rule enabled"); onChanged(); }
  }

  async function remove() {
    await deleteRuleAction(rule.id);
    toast.success("Rule deleted");
    onChanged();
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 rounded-[12px] border border-border bg-card px-3 py-3 shadow-sm",
        isDragging && "opacity-70 ring-2 ring-primary/30",
      )}
    >
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing" aria-label="Reorder">
        <GripVertical className="size-4" />
      </button>
      <span className="w-5 text-center text-xs font-semibold text-muted-foreground">{index + 1}</span>
      <span className="flex size-9 items-center justify-center rounded-[8px] bg-secondary text-primary">
        {trig ? <trig.icon className="size-4" /> : <Zap className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{rule.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {trig?.label ?? rule.trigger_type} · {rule.conditions?.length ?? 0} condition{(rule.conditions?.length ?? 0) === 1 ? "" : "s"} · {rule.actions?.length ?? 0} action{(rule.actions?.length ?? 0) === 1 ? "" : "s"}
        </p>
      </div>

      {/* status toggle */}
      <button
        onClick={toggle}
        role="switch"
        aria-checked={active}
        className={cn("relative h-5 w-9 rounded-full transition-colors", active ? "bg-success" : "bg-border")}
        title={active ? "Enabled" : "Disabled"}
      >
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-all", active ? "left-[18px]" : "left-0.5")} />
      </button>
      <Badge variant={active ? "success" : "muted"} className="w-16 justify-center">{active ? "Active" : "Off"}</Badge>

      <Link href={`/app/automations/${rule.id}`} className="rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="Edit"><Pencil className="size-4" /></Link>
      <button onClick={remove} className="rounded-md p-2 text-muted-foreground hover:bg-error/10 hover:text-error" aria-label="Delete"><Trash2 className="size-4" /></button>
    </li>
  );
}
