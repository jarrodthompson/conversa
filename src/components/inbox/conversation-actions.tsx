"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, CheckCircle2, RotateCcw, Flag, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuLabel } from "@/components/ui/menu";
import {
  setStatusAction, setPriorityAction, assignToMeAction,
} from "@/lib/data/conversation-actions";
import { PRIORITY_META } from "@/components/inbox/meta";

export function ConversationActions({
  conversationId,
  status,
  priority,
}: {
  conversationId: string;
  status: string;
  priority: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ error?: string; ok?: boolean }>, ok: string) {
    start(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else {
        toast.success(ok);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => assignToMeAction(conversationId), "Assigned to you")}>
        <UserPlus className="size-4" /> Assign to me
      </Button>

      <Menu
        align="end"
        trigger={
          <span className="inline-flex h-8 items-center gap-1 rounded-[10px] border border-border bg-card px-2.5 text-xs font-medium hover:bg-muted">
            <Flag className="size-3.5" style={{ color: PRIORITY_META[priority]?.dot }} />
            {PRIORITY_META[priority]?.label ?? priority}
            <ChevronDown className="size-3 text-muted-foreground" />
          </span>
        }
      >
        <MenuLabel>Priority</MenuLabel>
        {Object.entries(PRIORITY_META).map(([key, meta]) => (
          <MenuItem key={key} disabled={pending} onClick={() => run(() => setPriorityAction(conversationId, key), `Priority: ${meta.label}`)}>
            <Flag style={{ color: meta.dot }} /> {meta.label}
          </MenuItem>
        ))}
      </Menu>

      {status === "resolved" ? (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => setStatusAction(conversationId, "open"), "Reopened")}>
          <RotateCcw className="size-4" /> Reopen
        </Button>
      ) : (
        <Button size="sm" disabled={pending} onClick={() => run(() => setStatusAction(conversationId, "resolved"), "Resolved")}>
          <CheckCircle2 className="size-4" /> Resolve
        </Button>
      )}
    </div>
  );
}
