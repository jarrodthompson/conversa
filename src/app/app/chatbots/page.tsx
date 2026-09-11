import { Workflow, Plus } from "lucide-react";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";

interface Flow {
  id: string; name: string; description: string | null; status: string;
  channels: string[]; definition: { nodes?: unknown[] };
}

export default async function ChatbotsPage() {
  const { org } = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("chatbot_flows")
    .select("id, name, description, status, channels, definition")
    .eq("organisation_id", org.id)
    .is("deleted_at", null);
  const flows = (data ?? []) as unknown as Flow[];

  return (
    <div className="h-full overflow-y-auto p-6">
      <PageHeader
        title="Chatbots"
        description="Visual conversation flows. The drag-and-drop canvas editor opens from each flow."
        actions={<Button size="sm"><Plus className="size-4" /> New flow</Button>}
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {flows.length === 0 ? (
          <div className="md:col-span-2 lg:col-span-3"><EmptyState icon={Workflow} title="No chatbot flows" description="Create a flow to greet and route customers automatically." /></div>
        ) : (
          flows.map((f) => (
            <Card key={f.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex size-10 items-center justify-center rounded-[10px] bg-secondary text-primary"><Workflow className="size-5" /></div>
                  <Badge variant={f.status === "published" ? "success" : "muted"}>{f.status}</Badge>
                </div>
                <h3 className="mt-3 font-semibold">{f.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{f.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">{(f.definition?.nodes?.length ?? 0)} nodes · {f.channels.join(", ") || "no channel"}</p>
                <Button variant="outline" size="sm" className="mt-4">Open builder</Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">The dnd-kit canvas editor with node palette, validation and version history is part of the chatbot build-out.</p>
    </div>
  );
}
