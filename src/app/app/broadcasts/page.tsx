import { Megaphone, Plus } from "lucide-react";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/app/empty-state";
import { ChannelIcon } from "@/components/inbox/meta";

interface Broadcast {
  id: string; name: string; channel_type: string; status: string; scheduled_at: string | null;
}

export default async function BroadcastsPage() {
  const { org } = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("broadcasts")
    .select("id, name, channel_type, status, scheduled_at")
    .eq("organisation_id", org.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const broadcasts = (data ?? []) as unknown as Broadcast[];

  return (
    <div className="h-full overflow-y-auto p-6">
      <PageHeader
        title="Broadcasts"
        description="Consent-first outbound campaigns with opt-out enforcement and delivery tracking."
        actions={<Button size="sm"><Plus className="size-4" /> New broadcast</Button>}
      />
      <div className="mt-6 overflow-hidden rounded-[12px] border border-border bg-card">
        {broadcasts.length === 0 ? (
          <div className="p-6"><EmptyState icon={Megaphone} title="No broadcasts" description="Create a campaign to reach opted-in contacts." /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium">Channel</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Scheduled</th>
              </tr>
            </thead>
            <tbody>
              {broadcasts.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{b.name}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><ChannelIcon type={b.channel_type} className="size-4" /> {b.channel_type}</span></td>
                  <td className="px-4 py-3"><Badge variant={b.status === "sent" ? "success" : b.status === "scheduled" ? "primary" : "muted"}>{b.status}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{b.scheduled_at ? new Date(b.scheduled_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Audience segments, template approval and per-recipient delivery metrics are part of the broadcasts build-out.</p>
    </div>
  );
}
