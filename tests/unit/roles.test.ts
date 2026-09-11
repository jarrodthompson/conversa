import { describe, it, expect } from "vitest";
import { can, isManager } from "@/lib/auth/roles";

describe("role capabilities", () => {
  it("grants owners and admins everything", () => {
    expect(can("owner", "settings.manage")).toBe(true);
    expect(can("owner", "broadcasts.manage")).toBe(true);
    expect(can("org_admin", "automations.manage")).toBe(true);
  });

  it("limits support agents to front-line work", () => {
    expect(can("support_agent", "inbox.reply")).toBe(true);
    expect(can("support_agent", "contacts.view")).toBe(true);
    expect(can("support_agent", "broadcasts.manage")).toBe(false);
    expect(can("support_agent", "settings.manage")).toBe(false);
    expect(can("support_agent", "automations.manage")).toBe(false);
  });

  it("scopes marketing to campaigns, not the inbox", () => {
    expect(can("marketing", "broadcasts.manage")).toBe(true);
    expect(can("marketing", "contacts.manage")).toBe(true);
    expect(can("marketing", "inbox.reply")).toBe(false);
  });

  it("limits reporting users to reports only", () => {
    expect(can("reporting", "reports.view")).toBe(true);
    expect(can("reporting", "inbox.view")).toBe(false);
    expect(can("reporting", "contacts.view")).toBe(false);
  });

  it("returns false for unknown roles and capabilities", () => {
    expect(can("nonsense", "inbox.view")).toBe(false);
  });

  it("identifies managers", () => {
    expect(isManager("owner")).toBe(true);
    expect(isManager("support_manager")).toBe(true);
    expect(isManager("support_agent")).toBe(false);
    expect(isManager("marketing")).toBe(false);
  });
});
