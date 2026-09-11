"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Send, StickyNote, Sparkles, Paperclip, Smile, Clock, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sendReplyAction, addNoteAction } from "@/lib/data/conversation-actions";

export function Composer({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(resolveAfter = false) {
    const text = value.trim();
    if (!text) return;
    startTransition(async () => {
      const res =
        mode === "reply"
          ? await sendReplyAction(conversationId, text)
          : await addNoteAction(conversationId, text);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      if (resolveAfter) {
        const { setStatusAction } = await import("@/lib/data/conversation-actions");
        await setStatusAction(conversationId, "resolved");
        toast.success("Sent and resolved");
      } else {
        toast.success(mode === "reply" ? "Reply sent" : "Note added");
      }
      setValue("");
      router.refresh();
    });
  }

  /** Deterministic demo "AI suggestion" — clearly labelled, not a live provider. */
  function aiSuggest() {
    setMode("reply");
    setValue(
      "Thanks for getting in touch — I'd be happy to help with this. I've checked your account and can confirm the next steps below. (AI-suggested draft · demo mode — please review before sending.)",
    );
    toast.info("AI draft inserted (demo mode) — review before sending");
  }

  return (
    <div className="border-t border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-1">
        <button
          onClick={() => setMode("reply")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-xs font-medium",
            mode === "reply" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted",
          )}
        >
          <Send className="size-3.5" /> Reply
        </button>
        <button
          onClick={() => setMode("note")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-xs font-medium",
            mode === "note" ? "bg-warning/15 text-warning" : "text-muted-foreground hover:bg-muted",
          )}
        >
          <StickyNote className="size-3.5" /> Internal note
        </button>
        <button
          onClick={aiSuggest}
          className="ml-auto inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-secondary"
        >
          <Sparkles className="size-3.5" /> AI draft
        </button>
      </div>

      <div
        className={cn(
          "rounded-[10px] border bg-background",
          mode === "note" ? "border-warning/40 bg-warning/5" : "border-input",
        )}
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          rows={3}
          placeholder={mode === "reply" ? "Write a reply… (⌘/Ctrl + Enter to send)" : "Write an internal note (only your team can see this)…"}
          className="w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center gap-1 border-t border-border/60 px-2 py-1.5">
          <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" title="Attach (demo)"><Paperclip className="size-4" /></button>
          <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" title="Emoji (demo)"><Smile className="size-4" /></button>
          <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" title="Schedule send (demo)"><Clock className="size-4" /></button>
          <div className="ml-auto flex items-center gap-2">
            {mode === "reply" && (
              <Button variant="outline" size="sm" onClick={() => submit(true)} disabled={pending}>
                <Check className="size-4" /> Send & resolve
              </Button>
            )}
            <Button size="sm" onClick={() => submit(false)} disabled={pending}>
              {pending ? "Sending…" : mode === "reply" ? "Send" : "Add note"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
