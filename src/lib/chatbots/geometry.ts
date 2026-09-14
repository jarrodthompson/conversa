import { handlesForNode, type FlowNode } from "@/lib/chatbots/types";

export const NODE_W = 200;
export const NODE_H = 68;

/** Absolute canvas coordinate of a node's single input handle (top-centre). */
export function inputPoint(n: FlowNode) {
  return { x: n.position.x + NODE_W / 2, y: n.position.y };
}

/** Absolute canvas coordinate of one of a node's output handles (along bottom). */
export function outputPoint(n: FlowNode, handleId: string) {
  const handles = handlesForNode(n);
  const idx = Math.max(0, handles.findIndex((h) => h.id === handleId));
  const k = Math.max(1, handles.length);
  const x = n.position.x + ((idx + 1) / (k + 1)) * NODE_W;
  return { x, y: n.position.y + NODE_H };
}

/** Cubic-bezier path between two points, curving vertically. */
export function edgePath(s: { x: number; y: number }, t: { x: number; y: number }) {
  const dy = Math.max(40, Math.abs(t.y - s.y) / 2);
  return `M ${s.x} ${s.y} C ${s.x} ${s.y + dy}, ${t.x} ${t.y - dy}, ${t.x} ${t.y}`;
}
