import type { AudienceContact } from "@/lib/broadcasts/audience";

/** Variables offered for personalisation, mapped from contact fields. */
export const VARIABLES = ["first_name", "last_name", "company"] as const;

export function detectVariables(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) found.add(m[1]);
  return [...found];
}

export function personalize(body: string, c: Partial<AudienceContact>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => {
    switch (k) {
      case "first_name": return c.first_name ?? "there";
      case "last_name": return c.last_name ?? "";
      case "company": return c.company ?? "";
      default: return `{{${k}}}`;
    }
  });
}

export function contactVariables(c: AudienceContact): Record<string, string> {
  return {
    first_name: c.first_name ?? "",
    last_name: c.last_name ?? "",
    company: c.company ?? "",
  };
}
