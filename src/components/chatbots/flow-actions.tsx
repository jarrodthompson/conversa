"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteFlowAction } from "@/lib/chatbots/actions";

export function DeleteFlowButton({ flowId, name }: { flowId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function remove() {
    start(async () => {
      const res = await deleteFlowAction(flowId);
      if (res?.error) toast.error(res.error);
      else { toast.success(`Deleted "${name}"`); router.refresh(); }
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <button onClick={remove} disabled={pending} className="rounded-md px-2 py-1 text-xs font-medium text-error hover:bg-error/10">
          {pending ? "Deleting…" : "Confirm"}
        </button>
        <button onClick={() => setConfirming(false)} disabled={pending} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-error/10 hover:text-error"
      aria-label={`Delete ${name}`}
      title="Delete flow"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
