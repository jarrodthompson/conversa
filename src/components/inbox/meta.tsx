import { MessageSquare, Mail, MessageCircle, Camera, Phone, Globe, type LucideIcon } from "lucide-react";

export const CHANNEL_META: Record<string, { icon: LucideIcon; label: string; color: string }> = {
  whatsapp: { icon: MessageSquare, label: "WhatsApp", color: "#25D366" },
  email: { icon: Mail, label: "Email", color: "#06B6D4" },
  web_chat: { icon: Globe, label: "Web Chat", color: "#0EA5E9" },
  messenger: { icon: MessageCircle, label: "Messenger", color: "#1877F2" },
  instagram: { icon: Camera, label: "Instagram", color: "#E1306C" },
  sms: { icon: Phone, label: "SMS", color: "#647985" },
};

export function ChannelIcon({ type, className }: { type: string; className?: string }) {
  const meta = CHANNEL_META[type] ?? CHANNEL_META.web_chat;
  const Icon = meta.icon;
  return <Icon className={className} style={{ color: meta.color }} aria-label={meta.label} />;
}

export const STATUS_META: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-success/12 text-success" },
  pending: { label: "Pending", className: "bg-cyan-50 text-cyan-600" },
  waiting: { label: "Waiting", className: "bg-warning/15 text-warning" },
  snoozed: { label: "Snoozed", className: "bg-muted text-muted-foreground" },
  resolved: { label: "Resolved", className: "bg-muted text-muted-foreground" },
  spam: { label: "Spam", className: "bg-error/12 text-error" },
};

export const PRIORITY_META: Record<string, { label: string; dot: string }> = {
  low: { label: "Low", dot: "#94A3B8" },
  normal: { label: "Normal", dot: "#06B6D4" },
  high: { label: "High", dot: "#F59E0B" },
  urgent: { label: "Urgent", dot: "#EF4444" },
};

export function contactName(c?: { first_name?: string | null; last_name?: string | null } | null) {
  if (!c) return "Unknown contact";
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown contact";
}
