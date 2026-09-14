import { type FlowDefinition, type FlowNode } from "@/lib/chatbots/types";

export interface SimStep {
  nodeId: string;
  type: string;
  /** What the bot presents to the user at this step. */
  say?: string;
  /** Choice buttons the user must pick from to continue. */
  options?: { handle: string; label: string }[];
  /** True when the flow expects free-text input to continue. */
  awaitsInput?: boolean;
  variable?: string;
  /** Terminal step (handoff/end). */
  terminal?: boolean;
  note?: string;
}

function interpolate(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

function outTarget(def: FlowDefinition, nodeId: string, handle = "out") {
  const edge = def.edges.find((e) => e.source === nodeId && (e.sourceHandle ?? "out") === handle);
  return edge?.target;
}

/**
 * Deterministic, side-effect-free flow interpreter used by the testing
 * simulator. Given the current node and any user input/choice, it advances
 * through non-interactive nodes until it reaches one that needs the user
 * (message with pause, question, choice) or a terminal node.
 */
export function stepFlow(
  def: FlowDefinition,
  fromNodeId: string | null,
  input: { text?: string; handle?: string } | null,
  vars: Record<string, string>,
): { steps: SimStep[]; nextNodeId: string | null; vars: Record<string, string> } {
  const byId = new Map(def.nodes.map((n) => [n.id, n]));
  const steps: SimStep[] = [];
  const state = { ...vars };

  let current: FlowNode | undefined;
  if (fromNodeId === null) {
    current = def.nodes.find((n) => n.type === "start");
    if (current) current = byId.get(outTarget(def, current.id) ?? "");
  } else {
    const node = byId.get(fromNodeId);
    if (!node) return { steps, nextNodeId: null, vars: state };
    // Resolve where the user's input takes us.
    if (node.type === "ask_question" || node.type === "collect_order" || node.type === "collect_contact") {
      const v = String((node.data.variable as string) || "answer");
      state[v] = input?.text ?? "";
      current = byId.get(outTarget(def, node.id) ?? "");
    } else if (node.type === "multiple_choice") {
      // One dot, but each option is its own outgoing edge (sourceHandle opt{i}).
      const opts = ((node.data.options as string[] | undefined) ?? []).map((s) => s.trim()).filter(Boolean);
      const idx = input?.handle ? Number.parseInt(input.handle.replace("opt", ""), 10) : 0;
      if (!Number.isNaN(idx) && opts[idx]) state["choice"] = opts[idx];
      current = byId.get(outTarget(def, node.id, input?.handle ?? "opt0") ?? "");
    } else {
      current = byId.get(outTarget(def, node.id) ?? "");
    }
  }

  let guard = 0;
  while (current && guard++ < 100) {
    const n: FlowNode = current;
    switch (n.type) {
      case "send_message":
        steps.push({ nodeId: n.id, type: n.type, say: interpolate(String(n.data.message ?? ""), state) });
        current = byId.get(outTarget(def, n.id) ?? "");
        break;
      case "ask_question":
        steps.push({ nodeId: n.id, type: n.type, say: interpolate(String(n.data.question ?? ""), state), awaitsInput: true, variable: String(n.data.variable ?? "answer") });
        return { steps, nextNodeId: n.id, vars: state };
      case "collect_order":
        steps.push({ nodeId: n.id, type: n.type, say: "Please share your order number.", awaitsInput: true, variable: String(n.data.variable ?? "order_number") });
        return { steps, nextNodeId: n.id, vars: state };
      case "collect_contact":
        steps.push({ nodeId: n.id, type: n.type, say: "Could you share your email address?", awaitsInput: true, variable: "email" });
        return { steps, nextNodeId: n.id, vars: state };
      case "multiple_choice": {
        const options = ((n.data.options as string[] | undefined) ?? []).map((s) => s.trim()).filter(Boolean);
        steps.push({
          nodeId: n.id, type: n.type,
          say: interpolate(String(n.data.prompt ?? "Choose:"), state),
          options: options.map((label, i) => ({ handle: `opt${i}`, label })),
        });
        return { steps, nextNodeId: n.id, vars: state };
      }
      case "condition": {
        const field = String(n.data.field ?? "");
        const val = String(n.data.value ?? "").toLowerCase();
        const actual = String(state[field] ?? "").toLowerCase();
        const truthy = val ? actual.includes(val) : Boolean(actual);
        steps.push({ nodeId: n.id, type: n.type, note: `Condition: ${field} ${truthy ? "→ True" : "→ False"}` });
        current = byId.get(outTarget(def, n.id, truthy ? "true" : "false") ?? "");
        break;
      }
      case "business_hours":
        steps.push({ nodeId: n.id, type: n.type, note: "Business hours → Open" });
        current = byId.get(outTarget(def, n.id, "open") ?? "");
        break;
      case "knowledge_search":
        steps.push({ nodeId: n.id, type: n.type, note: "Searched knowledge base" });
        current = byId.get(outTarget(def, n.id) ?? "");
        break;
      case "ai_response":
        steps.push({ nodeId: n.id, type: n.type, say: "Based on our help centre, here's what I found…" });
        current = byId.get(outTarget(def, n.id) ?? "");
        break;
      case "add_tag":
      case "update_field":
      case "assign_agent":
      case "assign_team":
      case "webhook":
      case "delay":
        steps.push({ nodeId: n.id, type: n.type, note: `Ran ${n.type.replace("_", " ")}` });
        current = byId.get(outTarget(def, n.id) ?? "");
        break;
      case "human_handoff":
        steps.push({ nodeId: n.id, type: n.type, note: "Handed off to a human agent.", terminal: true });
        return { steps, nextNodeId: null, vars: state };
      case "end":
        steps.push({ nodeId: n.id, type: n.type, note: "Conversation ended.", terminal: true });
        return { steps, nextNodeId: null, vars: state };
      default:
        current = byId.get(outTarget(def, n.id) ?? "");
    }
  }

  return { steps, nextNodeId: null, vars: state };
}
