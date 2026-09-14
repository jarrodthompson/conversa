import { NODE_DEFS, handlesForNode, type FlowDefinition } from "@/lib/chatbots/types";

export interface ValidationIssue {
  level: "error" | "warning";
  nodeId?: string;
  message: string;
}

/** Static analysis of a flow: structural errors and reachability warnings. */
export function validateFlow(def: FlowDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodes = def.nodes ?? [];
  const edges = def.edges ?? [];

  const starts = nodes.filter((n) => n.type === "start");
  if (starts.length === 0) issues.push({ level: "error", message: "Flow has no Start node." });
  if (starts.length > 1) issues.push({ level: "error", message: "Flow has more than one Start node." });

  // Dangling edges
  const ids = new Set(nodes.map((n) => n.id));
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) {
      issues.push({ level: "error", message: "An edge points to a missing node." });
    }
  }

  // Terminal-ness: non-terminal nodes should have at least one outgoing edge
  const outByNode = new Map<string, number>();
  for (const e of edges) outByNode.set(e.source, (outByNode.get(e.source) ?? 0) + 1);

  for (const n of nodes) {
    const def0 = NODE_DEFS[n.type];
    if (handlesForNode(n).length > 0 && !(outByNode.get(n.id) ?? 0)) {
      issues.push({ level: "warning", nodeId: n.id, message: `“${def0.label}” has no outgoing connection.` });
    }
  }

  // Reachability from start
  if (starts[0]) {
    const adj = new Map<string, string[]>();
    for (const e of edges) {
      if (!adj.has(e.source)) adj.set(e.source, []);
      adj.get(e.source)!.push(e.target);
    }
    const seen = new Set<string>([starts[0].id]);
    const stack = [starts[0].id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const nxt of adj.get(cur) ?? []) if (!seen.has(nxt)) { seen.add(nxt); stack.push(nxt); }
    }
    for (const n of nodes) {
      if (n.type !== "start" && !seen.has(n.id)) {
        issues.push({ level: "warning", nodeId: n.id, message: `“${NODE_DEFS[n.type].label}” is unreachable from Start.` });
      }
    }
  }

  return issues;
}
