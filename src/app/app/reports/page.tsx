import { MessageSquareText, CheckCircle2, Sparkles, AlertTriangle, Bot, Clock } from "lucide-react";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChannelBarChart, StatusPieChart } from "@/components/reports/charts";

async function count(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string,
  build: (q: unknown) => unknown,
) {
  let q = supabase.from("conversations").select("id", { count: "exact", head: true }).eq("organisation_id", orgId).is("deleted_at", null);
  q = build(q);
  const { count } = await q;
  return (count as number) ?? 0;
}

export default async function ReportsPage() {
  const { org } = await getAppContext();
  const supabase = await createClient();

  const channels = ["whatsapp", "email", "web_chat"];
  const statuses = ["open", "pending", "waiting", "snoozed", "resolved"];

  const [total, resolved, ai, breached, channelCounts, statusCounts] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count(supabase, org.id, (q: any) => q),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count(supabase, org.id, (q: any) => q.eq("status", "resolved")),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count(supabase, org.id, (q: any) => q.eq("is_ai_handled", true)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count(supabase, org.id, (q: any) => q.eq("sla_breached", true)),
    Promise.all(channels.map((ch) => count(supabase, org.id, (q: unknown) => (q as { eq: (a: string, b: string) => unknown }).eq("channel_type", ch)))),
    Promise.all(statuses.map((st) => count(supabase, org.id, (q: unknown) => (q as { eq: (a: string, b: string) => unknown }).eq("status", st)))),
  ]);

  const containment = total > 0 ? Math.round((ai / total) * 100) : 0;
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  // ── Avg first response: first inbound → first outbound, over the last 30 days ──
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data: msgRows } = await supabase
    .from("messages")
    .select("conversation_id, direction, created_at")
    .eq("organisation_id", org.id)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(5000);
  const firstIn = new Map<string, string>();
  const firstOut = new Map<string, string>();
  for (const m of (msgRows ?? []) as { conversation_id: string; direction: string; created_at: string }[]) {
    if (m.direction === "inbound" && !firstIn.has(m.conversation_id)) firstIn.set(m.conversation_id, m.created_at);
    if (m.direction === "outbound" && !firstOut.has(m.conversation_id)) firstOut.set(m.conversation_id, m.created_at);
  }
  let frtSum = 0;
  let frtN = 0;
  for (const [cid, inAt] of firstIn) {
    const outAt = firstOut.get(cid);
    if (outAt && new Date(outAt).getTime() > new Date(inAt).getTime()) {
      frtSum += new Date(outAt).getTime() - new Date(inAt).getTime();
      frtN++;
    }
  }
  const avgFrtMin = frtN > 0 ? frtSum / frtN / 60000 : 0;
  const avgFirstResponse = frtN === 0 ? "—" : avgFrtMin < 60 ? `${Math.round(avgFrtMin)}m` : `${(avgFrtMin / 60).toFixed(1)}h`;

  // ── Reopen rate: previously-resolved conversations now back in an open state ──
  const [everResolved, reopened] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count(supabase, org.id, (q: any) => q.not("resolved_at", "is", null)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count(supabase, org.id, (q: any) => q.not("resolved_at", "is", null).neq("status", "resolved")),
  ]);
  const reopenRate = everResolved > 0 ? Math.round((reopened / everResolved) * 100) : 0;

  const channelData = channels.map((c, i) => ({ name: { whatsapp: "WhatsApp", email: "Email", web_chat: "Web Chat" }[c] ?? c, value: channelCounts[i] }));
  const statusData = statuses.map((s, i) => ({ name: s, value: statusCounts[i] })).filter((d) => d.value > 0);

  const stats = [
    { label: "Total conversations", value: total, icon: MessageSquareText },
    { label: "Resolved", value: resolved, icon: CheckCircle2, sub: `${resolutionRate}% resolution rate` },
    { label: "AI containment", value: `${containment}%`, icon: Bot, sub: `${ai} AI-handled` },
    { label: "SLA breaches", value: breached, icon: AlertTriangle, sub: "Open & overdue" },
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      <PageHeader title="Reports" description="Support performance over the last 30 days." />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{s.label}</span>
                <s.icon className="size-4 text-primary" />
              </div>
              <p className="mt-2 text-3xl font-bold tracking-tight">{s.value}</p>
              {s.sub && <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Conversations by channel</CardTitle></CardHeader>
          <CardContent><ChannelBarChart data={channelData} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>By status</CardTitle></CardHeader>
          <CardContent><StatusPieChart data={statusData} /></CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Clock, label: "Avg first response", value: avgFirstResponse, note: "First inbound → first reply (30d)" },
          { icon: Sparkles, label: "Human handoff rate", value: `${Math.max(0, 100 - containment)}%`, note: "Conversations needing an agent" },
          { icon: CheckCircle2, label: "Reopen rate", value: `${reopenRate}%`, note: "Resolved then reopened" },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="flex size-10 items-center justify-center rounded-[10px] bg-secondary text-primary"><m.icon className="size-5" /></div>
              <div>
                <p className="text-sm text-muted-foreground">{m.label}</p>
                <p className="text-xl font-bold">{m.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">CSV/PDF export and per-agent breakdowns are part of the analytics build-out.</p>
    </div>
  );
}
