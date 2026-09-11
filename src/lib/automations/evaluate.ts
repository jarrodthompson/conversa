import type { RuleCondition } from "@/lib/automations/catalogue";

export interface EvalResult {
  matched: boolean;
  details: { condition: string; pass: boolean }[];
}

/** Evaluates a rule's conditions (AND) against a flat conversation record. */
export function evaluateConditions(
  conditions: RuleCondition[],
  record: Record<string, unknown>,
): EvalResult {
  if (!conditions || conditions.length === 0) {
    return { matched: true, details: [{ condition: "No conditions (always matches)", pass: true }] };
  }
  const details = conditions.map((c) => {
    const actual = record[c.field];
    const a = actual == null ? "" : String(actual).toLowerCase();
    const v = (c.value ?? "").toLowerCase();
    let pass = false;
    switch (c.op) {
      case "eq": pass = a === v; break;
      case "ne": pass = a !== v; break;
      case "contains": pass = a.includes(v); break;
      case "not_empty": pass = a.length > 0; break;
      default: pass = false;
    }
    return { condition: `${c.field} ${c.op} ${c.value ?? ""}`.trim(), pass };
  });
  return { matched: details.every((d) => d.pass), details };
}
