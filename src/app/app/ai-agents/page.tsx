import { Bot, Plus, Sparkles } from "lucide-react";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";

interface Agent {
  id: string; name: string; status: string; tone: string;
  language: string; channels: string[]; provider: string;
}

export default async function AiAgentsPage() {
  const { org } = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_agents")
    .select("id, name, status, tone, language, channels, provider")
    .eq("organisation_id", org.id)
    .is("deleted_at", null);
  const agents = (data ?? []) as unknown as Agent[];

  return (
    <div className="h-full overflow-y-auto p-6">
      <PageHeader
        title="AI Agents"
        description="Agents answer only from approved knowledge, cite sources, and hand off when unsure."
        actions={<Button size="sm"><Plus className="size-4" /> New agent</Button>}
      />

      <div className="mt-4 flex items-center gap-2 rounded-[10px] border border-border bg-secondary/50 px-4 py-2.5 text-sm text-secondary-foreground">
        <Sparkles className="size-4 text-primary" />
        Running in <strong>demo mode</strong> — responses are deterministic and clearly labelled. Add an API key in <code className="rounded bg-card px-1">.env.local</code> to enable a live provider.
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.length === 0 ? (
          <div className="md:col-span-2 lg:col-span-3">
            <EmptyState icon={Bot} title="No AI agents yet" description="Create your first agent and connect it to a knowledge source." />
          </div>
        ) : (
          agents.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex size-10 items-center justify-center rounded-[10px] bg-secondary text-primary"><Bot className="size-5" /></div>
                  <Badge variant={a.status === "published" ? "success" : a.status === "paused" ? "warning" : "muted"}>{a.status}</Badge>
                </div>
                <h3 className="mt-3 font-semibold">{a.name}</h3>
                <p className="mt-1 text-sm capitalize text-muted-foreground">{a.tone} tone · {a.language.toUpperCase()}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {a.channels.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm">Configure</Button>
                  <Button variant="ghost" size="sm">Test in sandbox</Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
