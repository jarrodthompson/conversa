"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, Send, X, RotateCw } from "lucide-react";
import { inviteMemberAction, revokeInviteAction, resendInviteAction } from "@/lib/team/invite-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";

interface Invite { id: string; email: string; role: string; expires_at: string }
const ROLES: Role[] = ["org_admin", "support_manager", "support_agent", "marketing", "reporting"];
const selectCls = "h-9 rounded-[10px] border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

export function InviteManager({ invites, canManage }: { invites: Invite[]; canManage: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("support_agent");
  const [pending, start] = useTransition();

  function invite() {
    if (!email.trim()) return;
    start(async () => {
      const res = await inviteMemberAction(email, role);
      if (res?.error) toast.error(res.error);
      else {
        if (res.warning) toast.warning(res.warning);
        else toast.success(`Invitation sent to ${email.trim()}`);
        setEmail("");
        router.refresh();
      }
    });
  }

  function run(fn: () => Promise<{ error?: string; warning?: string }>, okMsg: string) {
    start(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else { toast.success(res?.warning ?? okMsg); router.refresh(); }
    });
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="rounded-[12px] border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Mail className="size-4 text-primary" /> Invite a teammate</div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && invite()}
              placeholder="teammate@company.com"
              className="min-w-[220px] flex-1"
            />
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={selectCls}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <Button size="sm" onClick={invite} disabled={pending}><Send className="size-4" /> Send invite</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">They&apos;ll get an email with a link to join. The link expires in 7 days.</p>
        </div>
      )}

      {invites.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Pending invitations</p>
          <div className="overflow-hidden rounded-[12px] border border-border bg-card">
            <ul className="divide-y divide-border">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
                  <Mail className="size-4 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{inv.email}</span>
                  <Badge variant="outline">{ROLE_LABELS[inv.role as Role] ?? inv.role}</Badge>
                  <Badge variant="warning">Pending</Badge>
                  {canManage && (
                    <>
                      <button onClick={() => run(() => resendInviteAction(inv.id), "Invitation resent")} disabled={pending} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Resend" title="Resend"><RotateCw className="size-4" /></button>
                      <button onClick={() => run(() => revokeInviteAction(inv.id), "Invitation revoked")} disabled={pending} className="rounded-md p-1.5 text-muted-foreground hover:bg-error/10 hover:text-error" aria-label="Revoke" title="Revoke"><X className="size-4" /></button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
