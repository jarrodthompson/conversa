"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Star, Inbox as InboxIcon } from "lucide-react";
import { createInboxAction, deleteInboxAction, setDefaultInboxAction } from "@/lib/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Team { id: string; name: string }
interface Inbox { id: string; name: string; is_default: boolean; team_id: string | null }

const selectCls = "h-9 rounded-[10px] border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

export function InboxManager({ inboxes, teams, canManage }: { inboxes: Inbox[]; teams: Team[]; canManage: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [pending, start] = useTransition();
  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name;

  function run(fn: () => Promise<{ error?: string }>, okMsg: string) {
    start(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else { toast.success(okMsg); router.refresh(); }
    });
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-border bg-card p-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New inbox name" className="max-w-xs" />
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={selectCls}>
            <option value="">No team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <Button size="sm" disabled={pending} onClick={() => { if (!name.trim()) return; run(() => createInboxAction(name, teamId || null), "Inbox created"); setName(""); }}>
            <Plus className="size-4" /> Add inbox
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-[12px] border border-border bg-card">
        <ul className="divide-y divide-border">
          {inboxes.length === 0 && <li className="p-4 text-sm text-muted-foreground">No inboxes yet.</li>}
          {inboxes.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-4 py-3">
              <InboxIcon className="size-4 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium">{i.name}</span>
              {i.team_id && <Badge variant="outline">{teamName(i.team_id)}</Badge>}
              {i.is_default ? (
                <Badge variant="success">Default</Badge>
              ) : canManage ? (
                <button onClick={() => run(() => setDefaultInboxAction(i.id), "Default inbox set")} disabled={pending} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                  <Star className="size-3.5" /> Make default
                </button>
              ) : null}
              {canManage && !i.is_default && (
                <button onClick={() => run(() => deleteInboxAction(i.id), "Inbox deleted")} disabled={pending} className="rounded-md p-1.5 text-muted-foreground hover:bg-error/10 hover:text-error" aria-label="Delete">
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
