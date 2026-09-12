"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { createTagAction, deleteTagAction } from "@/lib/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Tag { id: string; name: string; color: string }

const SWATCHES = ["#22D3EE", "#06B6D4", "#6366F1", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#EF4444"];

export function TagManager({ tags, canManage }: { tags: Tag[]; canManage: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [pending, start] = useTransition();

  function add() {
    if (!name.trim()) return;
    start(async () => {
      const res = await createTagAction(name, color);
      if (res?.error) toast.error(res.error);
      else { toast.success("Tag created"); setName(""); router.refresh(); }
    });
  }
  function remove(id: string) {
    start(async () => {
      const res = await deleteTagAction(id);
      if (res?.error) toast.error(res.error);
      else { toast.success("Tag deleted"); router.refresh(); }
    });
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-border bg-card p-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New tag name" className="max-w-xs" onKeyDown={(e) => e.key === "Enter" && add()} />
          <div className="flex items-center gap-1">
            {SWATCHES.map((s) => (
              <button key={s} onClick={() => setColor(s)} className="size-6 rounded-full border-2" style={{ background: s, borderColor: color === s ? "#102A3A" : "transparent" }} aria-label={s} />
            ))}
          </div>
          <Button size="sm" onClick={add} disabled={pending}><Plus className="size-4" /> Add tag</Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tags.length === 0 && <p className="text-sm text-muted-foreground">No tags yet.</p>}
        {tags.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
            <span className="size-2.5 rounded-full" style={{ background: t.color }} />
            {t.name}
            {canManage && (
              <button onClick={() => remove(t.id)} disabled={pending} className="text-muted-foreground hover:text-error" aria-label={`Delete ${t.name}`}>
                <Trash2 className="size-3.5" />
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
