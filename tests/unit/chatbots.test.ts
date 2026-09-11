import { describe, it, expect } from "vitest";
import { validateFlow } from "@/lib/chatbots/validate";
import { stepFlow } from "@/lib/chatbots/simulate";
import type { FlowDefinition } from "@/lib/chatbots/types";

const welcome: FlowDefinition = {
  nodes: [
    { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
    { id: "msg", type: "send_message", position: { x: 0, y: 1 }, data: { message: "Welcome {{name}}!" } },
    { id: "choice", type: "multiple_choice", position: { x: 0, y: 2 }, data: { prompt: "Pick:", options: ["Track", "Human"] } },
    { id: "handoff", type: "human_handoff", position: { x: 0, y: 3 }, data: {} },
    { id: "end", type: "end", position: { x: 0, y: 4 }, data: {} },
  ],
  edges: [
    { id: "e1", source: "start", target: "msg" },
    { id: "e2", source: "msg", target: "choice" },
    { id: "e3", source: "choice", target: "end", sourceHandle: "opt0" },
    { id: "e4", source: "choice", target: "handoff", sourceHandle: "opt1" },
  ],
};

describe("flow validation", () => {
  it("passes a well-formed flow", () => {
    const issues = validateFlow(welcome);
    expect(issues.filter((i) => i.level === "error")).toHaveLength(0);
  });

  it("flags a missing start node", () => {
    const def = { nodes: welcome.nodes.filter((n) => n.type !== "start"), edges: [] };
    const issues = validateFlow(def);
    expect(issues.some((i) => i.level === "error" && /Start/.test(i.message))).toBe(true);
  });

  it("warns about unreachable nodes", () => {
    const def: FlowDefinition = {
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
        { id: "orphan", type: "send_message", position: { x: 0, y: 1 }, data: {} },
      ],
      edges: [],
    };
    const issues = validateFlow(def);
    expect(issues.some((i) => i.level === "warning" && /unreachable/i.test(i.message))).toBe(true);
  });

  it("flags dangling edges", () => {
    const def: FlowDefinition = {
      nodes: [{ id: "start", type: "start", position: { x: 0, y: 0 }, data: {} }],
      edges: [{ id: "x", source: "start", target: "ghost" }],
    };
    const issues = validateFlow(def);
    expect(issues.some((i) => i.level === "error" && /missing node/i.test(i.message))).toBe(true);
  });
});

describe("flow simulation", () => {
  it("plays the message then presents choices", () => {
    const res = stepFlow(welcome, null, null, { name: "Sam" });
    expect(res.steps[0].say).toContain("Welcome Sam!");
    const choiceStep = res.steps.find((s) => s.options);
    expect(choiceStep?.options?.map((o) => o.label)).toEqual(["Track", "Human"]);
    expect(res.nextNodeId).toBe("choice");
  });

  it("branches to human handoff and terminates", () => {
    const first = stepFlow(welcome, null, null, {});
    const res = stepFlow(welcome, first.nextNodeId, { handle: "opt1" }, first.vars);
    const last = res.steps[res.steps.length - 1];
    expect(last.terminal).toBe(true);
    expect(res.nextNodeId).toBeNull();
  });
});
