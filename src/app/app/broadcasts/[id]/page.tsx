import { notFound } from "next/navigation";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { BroadcastComposer } from "@/components/broadcasts/composer";
import type { Segment } from "@/lib/broadcasts/audience";

const STATUSES = ["queued", "sent", "delivered", "read", "replied", "failed", "opted_out"] as const;

export default async function BroadcastEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { org } = await getAppContext();
  const supabase = await createClient();

  const { data: bc } = await supabase
    .from("broadcasts")
    .select("id, name, channel_type, status, template_id, segment, variables, scheduled_at, frequency_cap, requires_approval, approved_at")
    .eq("organisation_id", org.id).eq("id", id).is("deleted_at", null)
    .maybeSingle();
  if (!bc) notFound();

  const [{ data: templates }, { data: tagRows }, { data: recipients }] = await Promise.all([
    supabase.from("message_templates").select("id, name, channel_type, body, variables, approval_status").eq("organisation_id", org.id),
    supabase.from("tags").select("name").eq("organisation_id", org.id),
    supabase.from("broadcast_recipients").select("status").eq("broadcast_id", id),
  ]);

  const metrics: Record<string, number> = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of (recipients ?? []) as { status: string }[]) {
    metrics[r.status] = (metrics[r.status] ?? 0) + 1;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = bc as any;
  return (
    <BroadcastComposer
      id={b.id}
      initialName={b.name}
      initialChannel={b.channel_type}
      initialStatus={b.status}
      initialTemplateId={b.template_id}
      initialBody={(b.variables?.body as string) ?? ""}
      initialSegment={(b.segment ?? { requireConsent: true }) as Segment}
      initialScheduledAt={b.scheduled_at}
      initialFrequencyCap={b.frequency_cap}
      requiresApproval={b.requires_approval}
      approvedAt={b.approved_at}
      templates={(templates ?? []) as never[]}
      tags={((tagRows ?? []) as { name: string }[]).map((t) => t.name)}
      metrics={metrics}
      totalRecipients={(recipients ?? []).length}
    />
  );
}
