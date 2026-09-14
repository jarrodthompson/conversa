import {
  Play, MessageSquare, HelpCircle, ListChecks, UserRound, Hash, GitBranch,
  BookOpen, Sparkles, UserPlus, Users, Tag, PenLine, Webhook, Timer, Clock,
  PhoneForwarded, Square, type LucideIcon,
} from "lucide-react";

export type NodeType =
  | "start" | "send_message" | "ask_question" | "multiple_choice"
  | "collect_contact" | "collect_order" | "condition" | "knowledge_search"
  | "ai_response" | "assign_agent" | "assign_team" | "add_tag"
  | "update_field" | "webhook" | "delay" | "business_hours"
  | "human_handoff" | "end";

export interface FlowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string; // e.g. "true"/"false" for condition, option id for choice
  label?: string;
}

export interface FlowDefinition {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface NodeDef {
  type: NodeType;
  label: string;
  icon: LucideIcon;
  color: string;
  category: "Trigger" | "Messaging" | "Data" | "Logic" | "AI" | "Routing" | "Flow";
  /** Output handles. Empty = terminal node. */
  handles: { id: string; label: string }[];
  description: string;
  defaultData: Record<string, unknown>;
}

const OUT = [{ id: "out", label: "" }];

export const NODE_DEFS: Record<NodeType, NodeDef> = {
  start: { type: "start", label: "Start", icon: Play, color: "#10B981", category: "Trigger", handles: OUT, description: "Entry point of the flow.", defaultData: {} },
  send_message: { type: "send_message", label: "Send Message", icon: MessageSquare, color: "#06B6D4", category: "Messaging", handles: OUT, description: "Send a message to the customer.", defaultData: { message: "Hello! 👋" } },
  ask_question: { type: "ask_question", label: "Ask Question", icon: HelpCircle, color: "#06B6D4", category: "Messaging", handles: OUT, description: "Ask a question and store the answer.", defaultData: { question: "What can I help you with?", variable: "answer" } },
  multiple_choice: { type: "multiple_choice", label: "Multiple Choice", icon: ListChecks, color: "#6366F1", category: "Messaging", handles: [], description: "Offer buttons and branch by choice.", defaultData: { prompt: "Choose an option:", options: ["Track order", "Returns", "Talk to a human"] } },
  collect_contact: { type: "collect_contact", label: "Collect Contact", icon: UserRound, color: "#8B5CF6", category: "Data", handles: OUT, description: "Collect name / email / phone.", defaultData: { fields: ["email"] } },
  collect_order: { type: "collect_order", label: "Collect Order No.", icon: Hash, color: "#8B5CF6", category: "Data", handles: OUT, description: "Ask for an order number.", defaultData: { variable: "order_number" } },
  condition: { type: "condition", label: "Condition", icon: GitBranch, color: "#F59E0B", category: "Logic", handles: [{ id: "true", label: "True" }, { id: "false", label: "False" }], description: "Branch on a condition.", defaultData: { field: "answer", op: "contains", value: "" } },
  knowledge_search: { type: "knowledge_search", label: "Knowledge Search", icon: BookOpen, color: "#0EA5E9", category: "AI", handles: OUT, description: "Search the knowledge base.", defaultData: { query: "{{answer}}" } },
  ai_response: { type: "ai_response", label: "AI Response", icon: Sparkles, color: "#06B6D4", category: "AI", handles: OUT, description: "Generate a grounded AI reply.", defaultData: { agent: "" } },
  assign_agent: { type: "assign_agent", label: "Assign to Agent", icon: UserPlus, color: "#EF4444", category: "Routing", handles: OUT, description: "Assign to a specific agent.", defaultData: { agentId: "" } },
  assign_team: { type: "assign_team", label: "Assign to Team", icon: Users, color: "#EF4444", category: "Routing", handles: OUT, description: "Assign to a team queue.", defaultData: { team: "Support" } },
  add_tag: { type: "add_tag", label: "Add Tag", icon: Tag, color: "#22D3EE", category: "Data", handles: OUT, description: "Tag the conversation/contact.", defaultData: { tag: "" } },
  update_field: { type: "update_field", label: "Update Field", icon: PenLine, color: "#22D3EE", category: "Data", handles: OUT, description: "Set a contact field.", defaultData: { field: "", value: "" } },
  webhook: { type: "webhook", label: "Webhook", icon: Webhook, color: "#647985", category: "Logic", handles: OUT, description: "Call an external URL.", defaultData: { url: "", method: "POST" } },
  delay: { type: "delay", label: "Delay", icon: Timer, color: "#647985", category: "Flow", handles: OUT, description: "Wait before continuing.", defaultData: { seconds: 5 } },
  business_hours: { type: "business_hours", label: "Business Hours", icon: Clock, color: "#F59E0B", category: "Logic", handles: [{ id: "open", label: "Open" }, { id: "closed", label: "Closed" }], description: "Branch on business hours.", defaultData: {} },
  human_handoff: { type: "human_handoff", label: "Human Handoff", icon: PhoneForwarded, color: "#EF4444", category: "Routing", handles: [], description: "Hand over to a human agent.", defaultData: { team: "Support" } },
  end: { type: "end", label: "End Conversation", icon: Square, color: "#647985", category: "Flow", handles: [], description: "End the flow.", defaultData: {} },
};

export const PALETTE_ORDER: NodeType[] = [
  "send_message", "ask_question", "multiple_choice",
  "collect_contact", "collect_order", "condition", "business_hours",
  "knowledge_search", "ai_response",
  "assign_agent", "assign_team", "human_handoff",
  "add_tag", "update_field", "webhook", "delay", "end",
];

/**
 * Output handles for a node. Most are static (from NODE_DEFS), but a
 * multiple_choice node's branches are derived from its options — one handle per
 * option, id `opt{index}` (matching the simulator and engine).
 */
export function handlesForNode(node: FlowNode): { id: string; label: string }[] {
  if (node.type === "multiple_choice") {
    const opts = (node.data?.options as string[] | undefined) ?? [];
    return opts.map((label, i) => ({ id: `opt${i}`, label }));
  }
  return NODE_DEFS[node.type as NodeType].handles;
}

export function newNodeId() {
  return "n_" + Math.random().toString(36).slice(2, 9);
}
export function newEdgeId() {
  return "e_" + Math.random().toString(36).slice(2, 9);
}
