"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Subscribes to Supabase Realtime for the current organisation and refreshes the
 * server-rendered inbox when messages, conversations or notes change. RLS on the
 * subscribed tables ensures only permitted rows are delivered.
 */
export function InboxRealtime({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"connecting" | "live" | "off">("connecting");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    // Ensure Realtime uses the signed-in user's JWT so RLS filters correctly.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) supabase.realtime.setAuth(data.session.access_token);
    });

    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    };

    const filter = `organisation_id=eq.${orgId}`;
    const channel = supabase
      .channel(`inbox:${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_notes", filter }, refresh)
      .subscribe((s) => {
        if (!active) return;
        if (s === "SUBSCRIBED") setStatus("live");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") setStatus("off");
      });

    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [orgId, router]);

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
      title={status === "live" ? "Live updates connected" : status === "connecting" ? "Connecting to live updates…" : "Live updates offline"}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "live" ? "bg-success" : status === "connecting" ? "bg-warning" : "bg-muted-foreground",
          status === "live" && "animate-pulse",
        )}
      />
      {status === "live" ? "Live" : status === "connecting" ? "…" : "Offline"}
    </span>
  );
}
