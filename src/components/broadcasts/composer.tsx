"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Send, ShieldCheck, Users, Clock, CheckCircle2,
  Rocket, CalendarClock, Info, MessageSquare,
} from "lucide-react";
import {
  saveBroadcastAction, previewAudienceAction, sendTestAction,
  approveBroadcastAction, dispatchBroadcastAction,
} from "@/lib/broadcasts/actions";
import { VARIABLES, personalize } from "@/lib/broadcasts/personalize";
import type { Segment } from "@/lib/broadcasts/audience";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChannelIcon } from "@/components/inbox/meta";
import { cn } from "@/lib/utils";

const selectCls = "h-9 w-full rounded-[10px] border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

interface Template { id: string; name: string; channel_type: string; body: string; variables: string[]; approval_status: string }

const METRIC_META: { key: string; label: string; color: string }[] = [
  { key: "queued", label: "Queued", color: "#94A3B8" },
  { key: "sent", label: "Sent", color: "#06B6D4" },
  { key: "delivered", label: "Delivered", color: "#22D3EE" },
  { key: "read", label: "Read", color: "#6366F1" },
  { key: "replied", label: "Replied", color: "#10B981" },
  { key: "failed", label: "Failed", color: "#EF4444" },
  { key: "opted_out", label: "Opted out", color: "#F59E0B" },
];

export function BroadcastComposer(props: {
  id: string;
  initialName: string;
  initialChannel: string;
  initialStatus: string;
  initialTemplateId: string | null;
  initialBody: string;
  initialSegment: Segment;
  initialScheduledAt: string | null;
  initialFrequencyCap: number | null;
  requiresApproval: boolean;
  approvedAt: string | null;
  templates: Template[];
  tags: string[];
  metrics: Record<string, number>;
  totalRecipients: number;
}) {
  const router = useRouter();
  const [name, setName] = useState(props.initialName);
  const [channel, setChannel] = useState(props.initialChannel);
  const [templateId, setTemplateId] = useState(props.initialTemplateId ?? "");
  const [body, setBody] = useState(props.initialBody || "");
  const [segment, setSegment] = useState<Segment>(props.initialSegment);
  const [scheduleMode, setScheduleMode] = useState<"now" | "schedule">(props.initialScheduledAt ? "schedule" : "now");
  const [scheduledAt, setScheduledAt] = useState(props.initialScheduledAt?.slice(0, 16) ?? "");
  const [freqCap, setFreqCap] = useState<string>(props.initialFrequencyCap?.toString() ?? "");
  const [testTo, setTestTo] = useState("");
  const [approved, setApproved] = useState(!!props.approvedAt);
  const [status, setStatus] = useState(props.initialStatus);
  const [audience, setAudience] = useState<{ counts: Record<string, number>; sample: { name: string; identifier: string }[] } | null>(null);
  const [pending, start] = useTransition();

  const sent = status === "sent" || status === "sending";
  const total = props.totalRecipients;

  function payload() {
    return {
      name, channel_type: channel, template_id: templateId || null, body,
      segment,
      scheduled_at: scheduleMode === "schedule" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      frequency_cap: freqCap ? Number(freqCap) : null,
    };
  }

  async function saveOnly(silent = false) {
    const res = await saveBroadcastAction(props.id, payload());
    if (res?.error) { toast.error(res.error); return false; }
    if (!silent) toast.success("Saved");
    return true;
  }

  function save() { start(async () => { await saveOnly(); router.refresh(); }); }

  function preview() {
    start(async () => {
      if (!(await saveOnly(true))) return;
      const res = await previewAudienceAction(props.id, channel, segment);
      setAudience(res);
    });
  }

  function test() {
    start(async () => {
      const res = await sendTestAction(props.id, channel, testTo);
      if (res?.error) toast.error(res.error);
      else if (res.warning) toast.warning(res.warning);
      else toast.success(res.live ? `Test sent to ${testTo}` : "Test queued");
    });
  }

  function approve() {
    start(async () => {
      if (!(await saveOnly(true))) return;
      const res = await approveBroadcastAction(props.id);
      if (res?.error) toast.error(res.error);
      else { setApproved(true); toast.success("Broadcast approved"); }
    });
  }

  function dispatch() {
    start(async () => {
      if (!(await saveOnly(true))) return;
      const res = await dispatchBroadcastAction(props.id, scheduleMode);
      if (res?.error) { toast.error(res.error); return; }
      const r = res as { scheduled?: number; sent?: number; failed?: number; live?: boolean };
      if (scheduleMode === "schedule") { setStatus("scheduled"); toast.success(`Scheduled for ${r.scheduled ?? 0} recipients`); }
      else {
        setStatus("sent");
        const suffix = r.failed ? `, ${r.failed} failed` : "";
        toast.success(`${r.live ? "Sent" : "Simulated"} to ${r.sent ?? 0} recipients${suffix}`);
      }
      router.refresh();
    });
  }

  const sampleContact = { first_name: "Sophie", last_name: "Elwood", company: "Northwind" };
  const previewText = personalize(body || "Your message will appear here…", sampleContact);

  function toggleTag(t: string) {
    const tags = new Set(segment.tags ?? []);
    if (tags.has(t)) tags.delete(t); else tags.add(t);
    setSegment({ ...segment, tags: [...tags] });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <Link href="/app/broadcasts" className="flex size-8 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted"><ArrowLeft className="size-4" /></Link>
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={sent} className="w-64 rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-sm font-semibold outline-none hover:border-border focus:border-ring disabled:opacity-60" />
        <Badge variant={sent ? "success" : status === "scheduled" ? "primary" : "muted"}>{status}</Badge>
        <div className="ml-auto flex items-center gap-1.5">
          {!sent && <Button variant="outline" size="sm" onClick={save} disabled={pending}><Save className="size-4" /> Save</Button>}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl space-y-4">
            {/* Message */}
            <Card title="Message" icon={MessageSquare}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Channel</Label>
                  <select value={channel} disabled={sent} onChange={(e) => setChannel(e.target.value)} className={cn(selectCls, "mt-1")}>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>
                <div>
                  <Label>Template (optional)</Label>
                  <select
                    value={templateId} disabled={sent}
                    onChange={(e) => {
                      setTemplateId(e.target.value);
                      const t = props.templates.find((x) => x.id === e.target.value);
                      if (t) setBody(t.body);
                    }}
                    className={cn(selectCls, "mt-1")}
                  >
                    <option value="">— None —</option>
                    {props.templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.approval_status})</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <Label>Message body</Label>
                <Textarea className="mt-1" rows={4} value={body} disabled={sent} onChange={(e) => setBody(e.target.value)} placeholder="Hi {{first_name}}, …" />
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Insert:</span>
                  {VARIABLES.map((v) => (
                    <button key={v} disabled={sent} onClick={() => setBody((b) => `${b}{{${v}}}`)} className="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-50">
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 rounded-[10px] border border-border bg-secondary/40 p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Preview (for {sampleContact.first_name})</p>
                <p className="whitespace-pre-wrap text-sm">{previewText}</p>
              </div>
            </Card>

            {/* Audience */}
            <Card title="Audience" icon={Users}>
              <div className="flex items-center justify-between rounded-[10px] border border-success/30 bg-success/5 px-3 py-2">
                <span className="flex items-center gap-2 text-xs text-success"><ShieldCheck className="size-4" /> Only opted-in contacts (not on the suppression list) will be messaged.</span>
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={segment.requireConsent !== false} disabled={sent} onChange={(e) => setSegment({ ...segment, requireConsent: e.target.checked })} />
                  Require consent
                </label>
              </div>

              <div className="mt-3">
                <Label>Filter by tags (any)</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {props.tags.length === 0 && <span className="text-xs text-muted-foreground">No tags in this organisation.</span>}
                  {props.tags.map((t) => {
                    const on = (segment.tags ?? []).includes(t);
                    return (
                      <button key={t} disabled={sent} onClick={() => toggleTag(t)} className={cn("rounded-full border px-2.5 py-1 text-xs", on ? "border-primary bg-secondary text-primary" : "border-border hover:bg-muted")}>
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div><Label>Company contains</Label><Input className="mt-1" disabled={sent} value={segment.company ?? ""} onChange={(e) => setSegment({ ...segment, company: e.target.value })} /></div>
                <div><Label>Name/email contains</Label><Input className="mt-1" disabled={sent} value={segment.search ?? ""} onChange={(e) => setSegment({ ...segment, search: e.target.value })} /></div>
              </div>

              <Button variant="outline" size="sm" className="mt-3" onClick={preview} disabled={pending}><Users className="size-4" /> Preview audience</Button>

              {audience && (
                <div className="mt-3 rounded-[10px] border border-border p-3">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <Stat label="Eligible" value={audience.counts.eligible} tone="text-success" />
                    <Stat label="No consent" value={audience.counts.noConsent} tone="text-warning" />
                    <Stat label="Suppressed" value={audience.counts.suppressed} tone="text-error" />
                    <Stat label="No address" value={audience.counts.noIdentifier} tone="text-muted-foreground" />
                    <Stat label="Total contacts" value={audience.counts.total} tone="text-foreground" />
                  </div>
                  {audience.sample.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">e.g. {audience.sample.map((s) => s.name).join(", ")}…</p>
                  )}
                </div>
              )}
            </Card>

            {/* Schedule */}
            <Card title="Schedule" icon={CalendarClock}>
              <div className="flex gap-2">
                <button disabled={sent} onClick={() => setScheduleMode("now")} className={cn("flex-1 rounded-[10px] border px-3 py-2 text-sm", scheduleMode === "now" ? "border-primary bg-secondary text-primary" : "border-border")}>Send now</button>
                <button disabled={sent} onClick={() => setScheduleMode("schedule")} className={cn("flex-1 rounded-[10px] border px-3 py-2 text-sm", scheduleMode === "schedule" ? "border-primary bg-secondary text-primary" : "border-border")}>Schedule</button>
              </div>
              {scheduleMode === "schedule" && (
                <div className="mt-3">
                  <Label>Send at (your local time)</Label>
                  <Input type="datetime-local" className="mt-1" disabled={sent} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Info className="size-3" /> Delivery is time-zone-aware per contact where a timezone is known.</p>
                </div>
              )}
              <div className="mt-3">
                <Label>Frequency cap (optional)</Label>
                <Input type="number" className="mt-1" disabled={sent} value={freqCap} onChange={(e) => setFreqCap(e.target.value)} placeholder="Max messages per contact / window" />
              </div>
            </Card>
          </div>
        </div>

        {/* Right: send + metrics */}
        <aside className="w-80 shrink-0 space-y-5 overflow-y-auto border-l border-border bg-card p-5">
          {!sent ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Test & send</h3>
              <div>
                <Label>Send a test to</Label>
                <div className="mt-1 flex gap-2">
                  <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder={channel === "email" ? "you@example.com" : "+44…"} />
                  <Button variant="outline" size="sm" onClick={test} disabled={pending}><Send className="size-4" /></Button>
                </div>
              </div>

              {props.requiresApproval && (
                <div className={cn("flex items-center justify-between rounded-[10px] border px-3 py-2 text-sm", approved ? "border-success/30 bg-success/5 text-success" : "border-warning/30 bg-warning/5 text-warning")}>
                  <span className="flex items-center gap-1.5">{approved ? <CheckCircle2 className="size-4" /> : <Clock className="size-4" />}{approved ? "Approved" : "Needs approval"}</span>
                  {!approved && <Button size="sm" variant="outline" onClick={approve} disabled={pending}>Approve</Button>}
                </div>
              )}

              <Button className="w-full" onClick={dispatch} disabled={pending || (props.requiresApproval && !approved)}>
                {scheduleMode === "schedule" ? <><CalendarClock className="size-4" /> Schedule broadcast</> : <><Rocket className="size-4" /> Send now</>}
              </Button>
              <p className="text-xs text-muted-foreground">Email and WhatsApp are delivered live when the channel is connected; other channels are simulated.</p>
            </div>
          ) : (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Delivery</h3>
              <MetricsBar metrics={props.metrics} total={total} />
              <ul className="mt-3 space-y-1.5">
                {METRIC_META.map((m) => (
                  <li key={m.key} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: m.color }} />{m.label}</span>
                    <span className="font-medium">{props.metrics[m.key] ?? 0}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 rounded-[10px] bg-muted/60 p-2 text-xs text-muted-foreground">
                <ChannelIcon type={channel} className="mr-1 inline size-3.5" /> {total} recipients · consent &amp; suppression enforced.
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Users; children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-[8px] bg-secondary text-primary"><Icon className="size-4" /></span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className={cn("text-lg font-bold", tone)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function MetricsBar({ metrics, total }: { metrics: Record<string, number>; total: number }) {
  if (total === 0) return <p className="text-xs text-muted-foreground">No recipients.</p>;
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full">
      {METRIC_META.map((m) => {
        const v = metrics[m.key] ?? 0;
        if (!v) return null;
        return <span key={m.key} style={{ width: `${(v / total) * 100}%`, background: m.color }} title={`${m.label}: ${v}`} />;
      })}
    </div>
  );
}
