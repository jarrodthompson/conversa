import { describe, it, expect } from "vitest";
import { evaluateConditions } from "@/lib/automations/evaluate";

describe("automation condition evaluation", () => {
  const record = { channel_type: "whatsapp", priority: "high", subject: "Refund please", status: "open" };

  it("matches when there are no conditions", () => {
    expect(evaluateConditions([], record).matched).toBe(true);
  });

  it("evaluates eq / ne", () => {
    expect(evaluateConditions([{ field: "channel_type", op: "eq", value: "whatsapp" }], record).matched).toBe(true);
    expect(evaluateConditions([{ field: "channel_type", op: "ne", value: "email" }], record).matched).toBe(true);
    expect(evaluateConditions([{ field: "channel_type", op: "eq", value: "email" }], record).matched).toBe(false);
  });

  it("evaluates contains (case-insensitive)", () => {
    expect(evaluateConditions([{ field: "subject", op: "contains", value: "refund" }], record).matched).toBe(true);
  });

  it("evaluates not_empty", () => {
    expect(evaluateConditions([{ field: "subject", op: "not_empty" }], record).matched).toBe(true);
    expect(evaluateConditions([{ field: "missing", op: "not_empty" }], record).matched).toBe(false);
  });

  it("ANDs multiple conditions", () => {
    const conds = [
      { field: "channel_type", op: "eq", value: "whatsapp" },
      { field: "priority", op: "eq", value: "low" },
    ];
    const res = evaluateConditions(conds, record);
    expect(res.matched).toBe(false);
    expect(res.details.filter((d) => d.pass)).toHaveLength(1);
  });
});
