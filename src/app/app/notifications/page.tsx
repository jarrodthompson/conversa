import { Bell } from "lucide-react";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { formatDistanceToNowStrict } from "date-fns";

interface Notification {
  id: string; type: string; title: string; body: string | null; created_at: string; read_at: string | null;
}

export default async function NotificationsPage() {
  const { org, userId } = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, created_at, read_at")
    .eq("organisation_id", org.id)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  const items = (data ?? []) as unknown as Notification[];

  return (
    <div className="h-full overflow-y-auto p-6">
      <PageHeader title="Notifications" description="Mentions, assignments and SLA alerts." />
      <div className="mt-6 max-w-2xl">
        {items.length === 0 ? (
          <EmptyState icon={Bell} title="You're all caught up" description="Notifications for mentions, assignments and SLA breaches will appear here." />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-[12px] border border-border bg-card">
            {items.map((n) => (
              <li key={n.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-1 size-2 rounded-full" style={{ background: n.read_at ? "transparent" : "#06B6D4" }} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                </div>
                <span className="text-xs text-muted-foreground">{formatDistanceToNowStrict(new Date(n.created_at))} ago</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
