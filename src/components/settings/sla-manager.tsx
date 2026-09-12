"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { upsertSlaAction, deleteSlaAction } from "@/lib/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Sla { id: string; name: string; first_response_minutes: number; resolution_minutes: number; priority: string | null }
const selectCls = "h-9 w-full rounded-[10px] border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";
const empty = { id: "", name: "", first_response_minutes: 60, resolution_minutes: 1440, priority: "" };

export function SlaManager({ policies, canManage }: { policies: Sla[]; canManage: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<typeof empty>(empty);
  const [pending, start] = useTransition();

  function save() {
    if (!form.name.trim()) return;
    start(async () => {
      const res = await upsertSlaAction({ id: form.id || null, name: form.name, first_response_minutes: Number(form.first_response_minutes), resolution_minutes: Number(form.resolution_minutes), priority: form.priority || null });
      if (res?.error) toast.error(res.error);
      else { toast.success(form.id ? "Policy updated" : "Policy created"); setForm(empty); router.refresh(); }
    });
  }
  function remove(id: string) {
    start(async () => {
      const res = await deleteSlaAction(id);
      if (res?.error) toast.error(res.error);
      else { toast.success("Policy deleted"); router.refresh(); }
    });
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="rounded-[12px] border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">{form.id ? "Edit policy" : "New policy"}</span>
            {form.id && <button onClick={() => setForm(empty)} className="text-xs text-muted-foreground hover:text-foreground"><X className="mr-1 inline size-3.5" />Cancel edit</button>}
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2"><Label>Name</Label><Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Standard" /></div>
            <div><Label>Priority</Label>
              <select className={`mt-1 ${selectCls}`} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="">Any</option><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
              </select>
            </div>
            <div><Label>First response (min)</Label><Input type="number" className="mt-1" value={form.first_response_minutes} onChange={(e) => setForm({ ...form, first_response_minutes: Number(e.target.value) })} /></div>
            <div><Label>Resolution (min)</Label><Input type="number" className="mt-1" value={form.resolution_minutes} onChange={(e) => setForm({ ...form, resolution_minutes: Number(e.target.value) })} /></div>
            <div className="flex items-end"><Button size="sm" onClick={save} disabled={pending}><Plus className="size-4" /> {form.id ? "Save" : "Add policy"}</Button></div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-[12px] border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Name</th><th className="px-4 py-2.5 font-medium">Priority</th>
              <th className="px-4 py-2.5 font-medium">First response</th><th className="px-4 py-2.5 font-medium">Resolution</th><th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {policies.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-muted-foreground">No SLA policies yet.</td></tr>}
            {policies.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 font-medium">{p.name}</td>
                <td className="px-4 py-2.5">{p.priority ? <Badge variant="outline">{p.priority}</Badge> : <span className="text-muted-foreground">Any</span>}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{p.first_response_minutes} min</td>
                <td className="px-4 py-2.5 text-muted-foreground">{p.resolution_minutes} min</td>
                <td className="px-4 py-2.5 text-right">
                  {canManage && (
                    <span className="inline-flex gap-1">
                      <button onClick={() => setForm({ id: p.id, name: p.name, first_response_minutes: p.first_response_minutes, resolution_minutes: p.resolution_minutes, priority: p.priority ?? "" })} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Edit"><Pencil className="size-4" /></button>
                      <button onClick={() => remove(p.id)} disabled={pending} className="rounded-md p-1.5 text-muted-foreground hover:bg-error/10 hover:text-error" aria-label="Delete"><Trash2 className="size-4" /></button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
