import {
  Inbox,
  Bot,
  Workflow,
  Megaphone,
  Users,
  BarChart3,
  BookOpen,
  Plug,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Capability } from "@/lib/auth/roles";

export interface PrimaryNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  capability: Capability;
}

/** Primary icon-rail modules. */
export const PRIMARY_NAV: PrimaryNavItem[] = [
  { href: "/app/inbox", label: "Inbox", icon: Inbox, capability: "inbox.view" },
  { href: "/app/ai-agents", label: "AI Agents", icon: Bot, capability: "ai.view" },
  { href: "/app/chatbots", label: "Chatbots", icon: Workflow, capability: "chatbots.manage" },
  { href: "/app/broadcasts", label: "Broadcasts", icon: Megaphone, capability: "broadcasts.view" },
  { href: "/app/contacts", label: "Contacts", icon: Users, capability: "contacts.view" },
  { href: "/app/reports", label: "Reports", icon: BarChart3, capability: "reports.view" },
  { href: "/app/knowledge", label: "Knowledge", icon: BookOpen, capability: "knowledge.manage" },
  { href: "/app/integrations", label: "Integrations", icon: Plug, capability: "integrations.manage" },
  { href: "/app/settings", label: "Settings", icon: Settings, capability: "settings.manage" },
];

/** Secondary navigation, keyed by the primary module base path. */
export const SECONDARY_NAV: Record<string, { heading: string; items: { href: string; label: string }[] }> = {
  "/app/inbox": {
    heading: "Inbox",
    items: [
      { href: "/app/inbox?view=mine", label: "My Inbox" },
      { href: "/app/inbox?view=all", label: "All Conversations" },
      { href: "/app/inbox?view=unassigned", label: "Unassigned" },
      { href: "/app/inbox?view=mentions", label: "Mentions" },
      { href: "/app/inbox?view=waiting", label: "Waiting" },
      { href: "/app/inbox?view=snoozed", label: "Snoozed" },
      { href: "/app/inbox?view=resolved", label: "Resolved" },
      { href: "/app/inbox?view=ai", label: "AI Handled" },
      { href: "/app/inbox?view=spam", label: "Spam" },
    ],
  },
  "/app/settings": {
    heading: "Settings",
    items: [
      { href: "/app/settings", label: "General" },
      { href: "/app/settings/profile", label: "My Profile" },
      { href: "/app/settings/team", label: "Team & Roles" },
      { href: "/app/settings/inboxes", label: "Inboxes" },
      { href: "/app/settings/tags", label: "Tags" },
      { href: "/app/settings/sla", label: "SLA Policies" },
      { href: "/app/settings/business-hours", label: "Business Hours" },
      { href: "/app/settings/billing", label: "Billing" },
    ],
  },
  "/app/reports": {
    heading: "Reports",
    items: [
      { href: "/app/reports", label: "Overview" },
      { href: "/app/reports/agents", label: "Agent Performance" },
      { href: "/app/reports/ai", label: "AI & Automation" },
      { href: "/app/reports/channels", label: "Channels" },
    ],
  },
};
