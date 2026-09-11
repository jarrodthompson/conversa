import {
  Inbox,
  Bot,
  Workflow,
  Megaphone,
  Users,
  BarChart3,
  BookOpen,
  Settings,
  MessageSquare,
  Mail,
  Sparkles,
} from "lucide-react";
import { LogoMark } from "@/components/brand/logo";

/**
 * A static, original preview of the Conversa workspace shown on the marketing
 * homepage. Pure presentation — no data, no interactivity.
 */
export function InboxPreview() {
  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_24px_60px_-30px_rgba(16,42,58,0.35)]">
      {/* window chrome */}
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-xs text-muted-foreground">Conversa · Inbox</span>
      </div>

      <div className="grid h-[420px] grid-cols-[56px_200px_1fr_220px] text-left">
        {/* rail */}
        <div className="flex flex-col items-center gap-1 bg-sidebar py-3">
          <div className="mb-2 flex size-9 items-center justify-center rounded-[10px] bg-sidebar-hover">
            <LogoMark size={22} />
          </div>
          {[Inbox, Bot, Workflow, Megaphone, Users, BarChart3, BookOpen, Settings].map((Icon, i) => (
            <div
              key={i}
              className={`flex size-9 items-center justify-center rounded-[10px] ${i === 0 ? "bg-sidebar-active text-white" : "text-sidebar-muted"}`}
            >
              <Icon className="size-[18px]" />
            </div>
          ))}
        </div>

        {/* list nav */}
        <div className="hidden border-r border-border p-3 sm:block">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Views</p>
          <ul className="mt-2 space-y-0.5 text-sm">
            {[
              ["My Inbox", "6"],
              ["Unassigned", "4"],
              ["Mentions", "2"],
              ["Waiting", "3"],
              ["AI Handled", "12"],
              ["Resolved", ""],
            ].map(([label, count], i) => (
              <li
                key={label}
                className={`flex items-center justify-between rounded-[8px] px-2 py-1.5 ${i === 0 ? "bg-secondary font-medium text-secondary-foreground" : "text-foreground"}`}
              >
                <span>{label}</span>
                {count && <span className="text-xs text-muted-foreground">{count}</span>}
              </li>
            ))}
          </ul>
        </div>

        {/* conversation list */}
        <div className="border-r border-border">
          {conversations.map((c, i) => (
            <div
              key={c.name}
              className={`flex gap-3 border-b border-border px-4 py-3 ${i === 0 ? "bg-secondary/60" : ""}`}
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: c.color }}
              >
                {c.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-semibold">{c.name}</span>
                  <span className="text-[11px] text-muted-foreground">{c.time}</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{c.preview}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <c.channel className="size-3" style={{ color: c.channelColor }} />
                  {c.ai && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      <Sparkles className="size-2.5" /> AI
                    </span>
                  )}
                  {c.tag && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {c.tag}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* details */}
        <div className="hidden p-4 lg:block">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ticket</p>
          <div className="mt-2 space-y-2 text-sm">
            <Row k="Status" v={<span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-success" />Open</span>} />
            <Row k="Priority" v="High" />
            <Row k="Channel" v="WhatsApp" />
            <Row k="Assignee" v="Priya N." />
            <Row k="SLA" v={<span className="text-warning">28m left</span>} />
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">AI Summary</p>
          <p className="mt-1.5 rounded-[8px] bg-secondary/60 p-2 text-xs text-foreground">
            Customer wants to replace a lost card and confirm the delivery address on file.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

const conversations = [
  { name: "Sophie Elwood", initials: "SE", color: "#06B6D4", time: "now", preview: "Hi, I need to replace my card…", channel: MessageSquare, channelColor: "#25D366", ai: true, tag: "Card" },
  { name: "Marcus Bell", initials: "MB", color: "#6366F1", time: "2m", preview: "Can I add another item to my order?", channel: MessageSquare, channelColor: "#06B6D4", ai: false, tag: "Orders" },
  { name: "Ana Ruiz", initials: "AR", color: "#EC4899", time: "5m", preview: "Thanks for the quick reply!", channel: Mail, channelColor: "#06B6D4", ai: true, tag: "" },
  { name: "Tom Fisher", initials: "TF", color: "#F59E0B", time: "12m", preview: "Product still shows out of stock", channel: MessageSquare, channelColor: "#25D366", ai: false, tag: "Stock" },
  { name: "Lena Ortiz", initials: "LO", color: "#10B981", time: "18m", preview: "Where is my refund?", channel: Mail, channelColor: "#06B6D4", ai: false, tag: "Billing" },
];
