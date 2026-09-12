"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { changeMemberRoleAction, removeMemberAction } from "@/lib/settings/actions";
import { Avatar } from "@/components/ui/avatar";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";

interface Member { user_id: string; role: string; full_name: string | null; avatar_url: string | null }
const ROLES: Role[] = ["owner", "org_admin", "support_manager", "support_agent", "marketing", "reporting"];
const selectCls = "h-8 rounded-[8px] border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

export function TeamManager({ members, canManage, meId }: { members: Member[]; canManage: boolean; meId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ error?: string }>, okMsg: string) {
    start(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else { toast.success(okMsg); router.refresh(); }
    });
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-card">
      <ul className="divide-y divide-border">
        {members.map((m) => {
          const isMe = m.user_id === meId;
          return (
            <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={m.full_name} src={m.avatar_url} size={34} />
              <span className="flex-1 truncate text-sm font-medium">{m.full_name ?? "Member"}{isMe && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}</span>
              {canManage && !isMe ? (
                <>
                  <select className={selectCls} defaultValue={m.role} disabled={pending} onChange={(e) => run(() => changeMemberRoleAction(m.user_id, e.target.value), "Role updated")}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <button onClick={() => run(() => removeMemberAction(m.user_id), "Member removed")} disabled={pending} className="rounded-md p-1.5 text-muted-foreground hover:bg-error/10 hover:text-error" aria-label="Remove"><Trash2 className="size-4" /></button>
                </>
              ) : (
                <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium">{ROLE_LABELS[m.role as Role] ?? m.role}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
