import Link from "next/link";
import { Megaphone, Plus, ChevronRight } from "lucide-react";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/app/empty-state";
import { ChannelIcon } from "@/components/inbox/meta";
import { createBroadcastAction } from "@/lib/broadcasts/actions";

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
        actions={
          <form action={createBroadcastAction}>
            <Button size="sm" type="submit"><Plus className="size-4" /> New broadcast</Button>
          </form>
        }
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
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {broadcasts.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/app/broadcasts/${b.id}`} className="hover:text-primary hover:underline">{b.name}</Link>
                  </td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><ChannelIcon type={b.channel_type} className="size-4" /> {b.channel_type}</span></td>
                  <td className="px-4 py-3"><Badge variant={b.status === "sent" ? "success" : b.status === "scheduled" ? "primary" : "muted"}>{b.status}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{b.scheduled_at ? new Date(b.scheduled_at).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 text-right"><Link href={`/app/broadcasts/${b.id}`} className="inline-flex text-muted-foreground hover:text-primary"><ChevronRight className="size-4" /></Link></td>
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
