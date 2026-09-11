import { describe, it, expect } from "vitest";
import { resolveAudience } from "@/lib/broadcasts/audience";
import { personalize, detectVariables } from "@/lib/broadcasts/personalize";

/** Minimal chainable, thenable Supabase stub returning preset table data. */
function fakeClient(contacts: unknown[], suppression: unknown[]) {
  function builder(data: unknown[]) {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "limit"]) b[m] = () => b;
    // Make it awaitable → resolves { data }.
    b.then = (resolve: (v: { data: unknown[] }) => void) => resolve({ data });
    return b;
  }
  return {
    from(table: string) {
      return builder(table === "contacts" ? contacts : suppression);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const contacts = [
  { id: "1", first_name: "A", last_name: "One", email: "a@x.com", whatsapp_number: "+441", phone: "+441", company: "Acme", consent_status: "opted_in", is_blocked: false, contact_tags: [{ tag: { name: "VIP" } }] },
  { id: "2", first_name: "B", last_name: "Two", email: "b@x.com", whatsapp_number: "+442", phone: "+442", company: "Beta", consent_status: "unknown", is_blocked: false, contact_tags: [] },
  { id: "3", first_name: "C", last_name: "Three", email: null, whatsapp_number: null, phone: null, company: "Gamma", consent_status: "opted_in", is_blocked: false, contact_tags: [] },
  { id: "4", first_name: "D", last_name: "Four", email: "d@x.com", whatsapp_number: "+444", phone: "+444", company: "Delta", consent_status: "opted_in", is_blocked: false, contact_tags: [{ tag: { name: "VIP" } }] },
];

describe("broadcast audience resolution", () => {
  it("enforces consent by default", async () => {
    const res = await resolveAudience(fakeClient(contacts, []), "org", "whatsapp", {});
    // Opted-in with an identifier: contacts 1 and 4 (3 has no number).
    expect(res.counts.eligible).toBe(2);
    expect(res.counts.noConsent).toBe(1); // contact 2
    expect(res.counts.noIdentifier).toBe(1); // contact 3
  });

  it("excludes suppressed identifiers", async () => {
    const res = await resolveAudience(fakeClient(contacts, [{ identifier: "+441" }]), "org", "whatsapp", {});
    expect(res.counts.suppressed).toBe(1);
    expect(res.counts.eligible).toBe(1); // only contact 4 remains
  });

  it("filters by tag", async () => {
    const res = await resolveAudience(fakeClient(contacts, []), "org", "whatsapp", { tags: ["VIP"] });
    expect(res.eligible.map((c) => c.id).sort()).toEqual(["1", "4"]);
  });

  it("can include non-consented when consent is not required", async () => {
    const res = await resolveAudience(fakeClient(contacts, []), "org", "whatsapp", { requireConsent: false });
    expect(res.counts.eligible).toBe(3); // 1,2,4 (3 has no number)
  });

  it("uses email identifier for the email channel", async () => {
    const res = await resolveAudience(fakeClient(contacts, []), "org", "email", {});
    // opted-in with email: 1 and 4 (3 has no email)
    expect(res.eligible.map((c) => c.identifier).sort()).toEqual(["a@x.com", "d@x.com"]);
  });
});

describe("personalisation", () => {
  it("substitutes known variables", () => {
    expect(personalize("Hi {{first_name}} from {{company}}", { first_name: "Sam", company: "Acme" })).toBe("Hi Sam from Acme");
  });
  it("falls back for a missing first name", () => {
    expect(personalize("Hi {{first_name}}", {})).toBe("Hi there");
  });
  it("detects variables in a template", () => {
    expect(detectVariables("Hi {{first_name}}, {{company}} thanks").sort()).toEqual(["company", "first_name"]);
  });
});
