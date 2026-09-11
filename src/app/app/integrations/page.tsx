import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChannelIcon, CHANNEL_META } from "@/components/inbox/meta";

interface Channel {
  id: string; type: string; name: string; is_demo: boolean;
  connection: { status: string }[] | null;
}

const ALL_TYPES = ["whatsapp", "email", "web_chat", "messenger", "instagram", "sms"];

export default async function IntegrationsPage() {
  const { org } = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("channels")
    .select("id, type, name, is_demo, connection:channel_connections(status)")
    .eq("organisation_id", org.id)
    .is("deleted_at", null);
  const channels = (data ?? []) as unknown as Channel[];
  const byType = new Map(channels.map((c) => [c.type, c]));

  return (
    <div className="h-full overflow-y-auto p-6">
      <PageHeader title="Integrations" description="Connect channels via official APIs. Unconnected channels use a clearly-labelled demo adapter." />
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ALL_TYPES.map((type) => {
          const meta = CHANNEL_META[type];
          const existing = byType.get(type);
          const status = existing?.connection?.[0]?.status ?? "disconnected";
          const connected = status === "connected";
          const demo = existing?.is_demo ?? false;
          return (
            <Card key={type}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex size-11 items-center justify-center rounded-[10px] bg-secondary"><ChannelIcon type={type} className="size-5" /></div>
                  {connected ? (
                    <Badge variant="success">Connected</Badge>
                  ) : demo ? (
                    <Badge variant="warning">Demo mode</Badge>
                  ) : (
                    <Badge variant="muted">Not connected</Badge>
                  )}
                </div>
                <h3 className="mt-3 font-semibold">{meta.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {existing ? existing.name : `Connect ${meta.label} to route messages into your inbox.`}
                </p>
                <Button variant={connected ? "outline" : "primary"} size="sm" className="mt-4">
                  {connected ? "Manage" : demo ? "Configure live" : "Connect"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Webhook endpoints, signature verification and message-status updates are provided per adapter. WhatsApp uses the official Meta Cloud API architecture — no unofficial automation.
      </p>
    </div>
  );
}
