import { notFound } from "next/navigation";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { FlowBuilder } from "@/components/chatbots/flow-builder";
import type { FlowDefinition } from "@/lib/chatbots/types";

export default async function FlowEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { org } = await getAppContext();
  const supabase = await createClient();

  const { data: flow } = await supabase
    .from("chatbot_flows")
    .select("id, name, status, definition")
    .eq("organisation_id", org.id)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!flow) notFound();

  const { data: versionRows } = await supabase
    .from("chatbot_versions")
    .select("version, created_at")
    .eq("flow_id", id)
    .order("version", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f = flow as any;
  const def = (f.definition ?? { nodes: [], edges: [] }) as FlowDefinition;

  return (
    <FlowBuilder
      flowId={f.id}
      initialName={f.name}
      initialStatus={f.status}
      initialDefinition={def}
      versions={(versionRows ?? []) as { version: number; created_at: string }[]}
    />
  );
}
