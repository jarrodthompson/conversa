import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Inbox as InboxIcon, AtSign, Clock, Moon, CheckCircle2, Ban, Sparkles,
  Users, AlertTriangle, MessageSquareText,
} from "lucide-react";
import { getAppContext } from "@/lib/auth/context";
import {
  listConversations, getViewCounts, getConversation, type InboxView,
} from "@/lib/data/conversations";
import { Avatar } from "@/components/ui/avatar";
import { Composer } from "@/components/inbox/composer";
import { ConversationActions } from "@/components/inbox/conversation-actions";
import { InboxRealtime } from "@/components/inbox/realtime";
import { EmptyState } from "@/components/app/empty-state";
import {
  ChannelIcon, STATUS_META, PRIORITY_META, contactName,
} from "@/components/inbox/meta";
import { cn } from "@/lib/utils";

const VIEW_ITEMS: { key: InboxView; label: string; icon: typeof InboxIcon; countKey?: keyof Awaited<ReturnType<typeof getViewCounts>> }[] = [
  { key: "mine", label: "My Inbox", icon: InboxIcon, countKey: "mine" },
  { key: "all", label: "All Conversations", icon: MessageSquareText, countKey: "all" },
  { key: "unassigned", label: "Unassigned", icon: Users, countKey: "unassigned" },
  { key: "mentions", label: "Mentions", icon: AtSign },
  { key: "waiting", label: "Waiting", icon: Clock, countKey: "waiting" },
  { key: "snoozed", label: "Snoozed", icon: Moon, countKey: "snoozed" },
  { key: "resolved", label: "Resolved", icon: CheckCircle2, countKey: "resolved" },
  { key: "ai", label: "AI Handled", icon: Sparkles, countKey: "ai" },
  { key: "spam", label: "Spam", icon: Ban, countKey: "spam" },
];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; c?: string }>;
}) {
  const { org, userId } = await getAppContext();
  const sp = await searchParams;
  const view = (sp.view as InboxView) || "all";
  const [rows, counts] = await Promise.all([
    listConversations(org.id, userId, view),
    getViewCounts(org.id, userId),
  ]);

  const selectedId = sp.c ?? rows[0]?.id;
  const detail = selectedId ? await getConversation(org.id, selectedId) : null;

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[210px_320px_1fr] xl:grid-cols-[210px_340px_1fr_300px]">
      {/* Column 1 — views */}
      <aside className="hidden flex-col border-r border-border bg-card md:flex">
        <div className="px-4 py-3.5">
          <h2 className="text-sm font-semibold">Inbox</h2>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
          {VIEW_ITEMS.map((item) => {
            const active = view === item.key;
            const count = item.countKey ? counts[item.countKey] : 0;
            return (
              <Link
                key={item.key}
                href={`/app/inbox?view=${item.key}`}
                className={cn(
                  "flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-sm transition-colors",
                  active ? "bg-secondary font-medium text-secondary-foreground" : "text-foreground hover:bg-muted",
                )}
              >
                <item.icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
                <span className="flex-1 truncate">{item.label}</span>
                {count > 0 && (
                  <span className={cn("text-xs", active ? "text-primary" : "text-muted-foreground")}>{count}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Column 2 — conversation list */}
      <section className="flex min-h-0 flex-col border-r border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold capitalize">{VIEW_ITEMS.find((v) => v.key === view)?.label ?? view}</h3>
          <div className="flex items-center gap-3">
            <InboxRealtime orgId={org.id} />
            <span className="text-xs text-muted-foreground">{rows.length} shown</span>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={InboxIcon} title="No conversations" description="Nothing matches this view right now." />
            </div>
          ) : (
            rows.map((r) => {
              const active = r.id === selectedId;
              const name = contactName(r.contact);
              return (
                <Link
                  key={r.id}
                  href={`/app/inbox?view=${view}&c=${r.id}`}
                  className={cn(
                    "flex gap-3 border-b border-border px-4 py-3 transition-colors",
                    active ? "bg-secondary/60" : "hover:bg-muted/50",
                  )}
                >
                  <Avatar name={name} src={r.contact?.avatar_url} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{name}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {r.last_message_at ? formatDistanceToNowStrict(new Date(r.last_message_at)) : ""}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {r.last_message_preview ?? r.subject}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <ChannelIcon type={r.channel_type} className="size-3.5" />
                      <span className="size-1.5 rounded-full" style={{ backgroundColor: PRIORITY_META[r.priority]?.dot }} />
                      {r.is_ai_handled && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          <Sparkles className="size-2.5" /> AI
                        </span>
                      )}
                      {r.sla_breached && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-error/12 px-1.5 py-0.5 text-[10px] font-medium text-error">
                          <AlertTriangle className="size-2.5" /> SLA
                        </span>
                      )}
                      {r.unread_count > 0 && <span className="ml-auto size-2 rounded-full bg-primary" />}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>

      {/* Column 3 — workspace */}
      <section className="flex min-h-0 flex-col bg-background">
        {!detail ? (
          <div className="flex h-full items-center justify-center p-6">
            <EmptyState icon={MessageSquareText} title="Select a conversation" description="Choose a conversation from the list to view the full thread." />
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-5 py-3">
              <div className="flex items-center gap-3">
                <Avatar name={contactName(detail.contact)} src={detail.contact?.avatar_url} size={38} />
                <div>
                  <p className="text-sm font-semibold">{contactName(detail.contact)}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ChannelIcon type={detail.channel_type} className="size-3.5" />
                    <span>{detail.subject}</span>
                  </div>
                </div>
              </div>
              <ConversationActions conversationId={detail.id} status={detail.status} priority={detail.priority} />
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {detail.ai_summary && (
                <div className="rounded-[10px] border border-border bg-secondary/50 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="size-3.5" /> AI summary
                  </p>
                  <p className="text-sm text-foreground">{detail.ai_summary}</p>
                </div>
              )}
              {detail.messages.map((m) => {
                const outbound = m.direction === "outbound";
                return (
                  <div key={m.id} className={cn("flex", outbound ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[75%] rounded-[12px] px-3.5 py-2.5 text-sm", outbound ? "bg-primary text-primary-foreground" : "border border-border bg-card")}>
                      {m.author_type === "ai" && (
                        <p className={cn("mb-1 flex items-center gap-1 text-[11px] font-medium", outbound ? "text-cyan-100" : "text-primary")}>
                          <Sparkles className="size-3" /> AI agent · demo
                        </p>
                      )}
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className={cn("mt-1 text-[10px]", outbound ? "text-cyan-100/80" : "text-muted-foreground")}>
                        {formatDistanceToNowStrict(new Date(m.created_at))} ago{outbound ? ` · ${m.delivery_status}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
              {detail.notes.map((n) => (
                <div key={n.id} className="mx-auto w-full max-w-[85%] rounded-[10px] border border-warning/30 bg-warning/5 px-3.5 py-2.5">
                  <p className="mb-0.5 text-[11px] font-medium text-warning">Internal note</p>
                  <p className="text-sm text-foreground">{n.body}</p>
                </div>
              ))}
            </div>

            <Composer conversationId={detail.id} />
          </>
        )}
      </section>

      {/* Column 4 — details */}
      <aside className="hidden min-h-0 flex-col overflow-y-auto border-l border-border bg-card xl:flex">
        {detail ? (
          <div className="space-y-5 p-5">
            <Panel title="Ticket">
              <Row k="Status"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_META[detail.status]?.className)}>{STATUS_META[detail.status]?.label ?? detail.status}</span></Row>
              <Row k="Priority"><span className="inline-flex items-center gap-1"><span className="size-2 rounded-full" style={{ backgroundColor: PRIORITY_META[detail.priority]?.dot }} />{PRIORITY_META[detail.priority]?.label}</span></Row>
              <Row k="Channel">{detail.channel_type}</Row>
              <Row k="SLA">{detail.sla_breached ? <span className="text-error">Breached</span> : detail.sla_due_at ? <span className="text-warning">Due {formatDistanceToNowStrict(new Date(detail.sla_due_at))}</span> : "—"}</Row>
              <Row k="Opened">{formatDistanceToNowStrict(new Date(detail.created_at))} ago</Row>
            </Panel>

            <Panel title="Contact">
              <Row k="Name">{contactName(detail.contactFull)}</Row>
              <Row k="Email">{detail.contactFull?.email ?? "—"}</Row>
              <Row k="Phone">{detail.contactFull?.phone ?? "—"}</Row>
              <Row k="Company">{detail.contactFull?.company ?? "—"}</Row>
              <Row k="Location">{detail.contactFull?.location ?? "—"}</Row>
              <Row k="Consent">{detail.contactFull?.consent_status ?? "—"}</Row>
            </Panel>

            <Panel title="Sentiment">
              <p className="text-sm capitalize text-foreground">{detail.sentiment ?? "neutral"}</p>
            </Panel>
          </div>
        ) : (
          <div className="p-5 text-sm text-muted-foreground">No conversation selected.</div>
        )}
      </aside>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="max-w-[60%] truncate text-right font-medium text-foreground">{children}</span>
    </div>
  );
}
