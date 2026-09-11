import {
  MessageSquarePlus, Inbox, UserX, Tag, Flag, Clock, AlertTriangle,
  Bot, CheckCircle2, Frown, ArrowRightLeft, UserPlus, Users,
  Send, Bell, Webhook, Moon, ShieldAlert, type LucideIcon,
} from "lucide-react";

export interface TriggerDef {
  key: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Optional inline config field. */
  config?: { key: string; label: string; type: "text" | "number"; placeholder?: string };
}

export const TRIGGERS: TriggerDef[] = [
  { key: "conversation.created", label: "New conversation", icon: MessageSquarePlus, description: "When a new conversation starts." },
  { key: "message.inbound", label: "New inbound message", icon: Inbox, description: "When a customer sends a message.", config: { key: "keyword", label: "Message contains (optional)", type: "text", placeholder: "refund, cancel…" } },
  { key: "conversation.unassigned", label: "Conversation unassigned", icon: UserX, description: "When a conversation has no assignee." },
  { key: "tag.added", label: "Tag added", icon: Tag, description: "When a tag is added.", config: { key: "tag", label: "Tag", type: "text", placeholder: "VIP" } },
  { key: "priority.changed", label: "Priority changed", icon: Flag, description: "When priority changes." },
  { key: "conversation.waiting", label: "Customer waiting too long", icon: Clock, description: "When a customer waits beyond a threshold.", config: { key: "minutes", label: "Minutes waiting", type: "number", placeholder: "30" } },
  { key: "sla.at_risk", label: "SLA about to breach", icon: AlertTriangle, description: "When an SLA is close to breaching." },
  { key: "ai.low_confidence", label: "AI confidence below threshold", icon: Bot, description: "When the AI is unsure.", config: { key: "threshold", label: "Confidence threshold", type: "number", placeholder: "0.6" } },
  { key: "conversation.resolved", label: "Conversation resolved", icon: CheckCircle2, description: "When a conversation is resolved." },
  { key: "sentiment.negative", label: "Sentiment becomes negative", icon: Frown, description: "When customer sentiment turns negative." },
];

export interface FieldDef { key: string; label: string; type: "text" | "select"; options?: string[] }

export const CONDITION_FIELDS: FieldDef[] = [
  { key: "channel_type", label: "Channel", type: "select", options: ["whatsapp", "email", "web_chat", "messenger", "instagram", "sms"] },
  { key: "priority", label: "Priority", type: "select", options: ["low", "normal", "high", "urgent"] },
  { key: "status", label: "Status", type: "select", options: ["open", "pending", "waiting", "snoozed", "resolved", "spam"] },
  { key: "sentiment", label: "Sentiment", type: "select", options: ["positive", "neutral", "negative"] },
  { key: "is_ai_handled", label: "AI handled", type: "select", options: ["true", "false"] },
  { key: "subject", label: "Subject", type: "text" },
  { key: "last_message_preview", label: "Last message", type: "text" },
];

export const OPERATORS = [
  { key: "eq", label: "is" },
  { key: "ne", label: "is not" },
  { key: "contains", label: "contains" },
  { key: "not_empty", label: "is not empty" },
] as const;

export interface ActionDef {
  key: string;
  label: string;
  icon: LucideIcon;
  param?: { key: string; label: string; type: "text" | "select"; options?: string[]; placeholder?: string };
}

export const ACTIONS: ActionDef[] = [
  { key: "assign_user", label: "Assign to user", icon: UserPlus, param: { key: "value", label: "Assignee", type: "text", placeholder: "agent email or name" } },
  { key: "assign_team", label: "Assign to team", icon: Users, param: { key: "value", label: "Team", type: "text", placeholder: "Support" } },
  { key: "add_tag", label: "Add tag", icon: Tag, param: { key: "value", label: "Tag", type: "text", placeholder: "VIP" } },
  { key: "set_priority", label: "Set priority", icon: Flag, param: { key: "value", label: "Priority", type: "select", options: ["low", "normal", "high", "urgent"] } },
  { key: "send_saved_reply", label: "Send saved reply", icon: Send, param: { key: "value", label: "Saved reply title", type: "text" } },
  { key: "start_chatbot", label: "Start chatbot", icon: Bot, param: { key: "value", label: "Flow name", type: "text" } },
  { key: "notify_manager", label: "Notify manager", icon: Bell },
  { key: "call_webhook", label: "Call webhook", icon: Webhook, param: { key: "value", label: "URL", type: "text", placeholder: "https://…" } },
  { key: "snooze", label: "Snooze", icon: Moon, param: { key: "value", label: "Hours", type: "text", placeholder: "12" } },
  { key: "resolve", label: "Resolve conversation", icon: CheckCircle2 },
  { key: "escalate", label: "Escalate", icon: ShieldAlert },
  { key: "reassign", label: "Reassign (round-robin)", icon: ArrowRightLeft },
];

export function triggerDef(key: string) { return TRIGGERS.find((t) => t.key === key); }
export function actionDef(key: string) { return ACTIONS.find((a) => a.key === key); }
export function fieldDef(key: string) { return CONDITION_FIELDS.find((f) => f.key === key); }

export interface RuleCondition { field: string; op: string; value?: string }
export interface RuleAction { type: string; value?: string }
