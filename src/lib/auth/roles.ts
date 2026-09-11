/** Role identifiers, matching the `org_role` enum in the database. */
export type Role =
  | "platform_admin"
  | "owner"
  | "org_admin"
  | "support_manager"
  | "support_agent"
  | "marketing"
  | "reporting";

export const ROLE_LABELS: Record<Role, string> = {
  platform_admin: "Platform Admin",
  owner: "Owner",
  org_admin: "Organisation Admin",
  support_manager: "Support Manager",
  support_agent: "Support Agent",
  marketing: "Marketing",
  reporting: "Reporting",
};

/** Capability keys used to gate UI and server actions. */
export type Capability =
  | "inbox.view"
  | "inbox.reply"
  | "contacts.view"
  | "contacts.manage"
  | "ai.view"
  | "ai.manage"
  | "chatbots.manage"
  | "automations.manage"
  | "broadcasts.view"
  | "broadcasts.manage"
  | "reports.view"
  | "knowledge.manage"
  | "integrations.manage"
  | "settings.manage"
  | "team.manage";

const ALL: Capability[] = [
  "inbox.view", "inbox.reply", "contacts.view", "contacts.manage",
  "ai.view", "ai.manage", "chatbots.manage", "automations.manage",
  "broadcasts.view", "broadcasts.manage", "reports.view", "knowledge.manage",
  "integrations.manage", "settings.manage", "team.manage",
];

const ROLE_CAPS: Record<Role, Capability[]> = {
  platform_admin: ALL,
  owner: ALL,
  org_admin: ALL,
  support_manager: [
    "inbox.view", "inbox.reply", "contacts.view", "contacts.manage",
    "ai.view", "ai.manage", "chatbots.manage", "automations.manage",
    "reports.view", "knowledge.manage", "team.manage",
  ],
  support_agent: ["inbox.view", "inbox.reply", "contacts.view", "ai.view", "knowledge.manage"],
  marketing: ["broadcasts.view", "broadcasts.manage", "contacts.view", "contacts.manage", "reports.view"],
  reporting: ["reports.view"],
};

export function can(role: string, capability: Capability): boolean {
  const caps = ROLE_CAPS[role as Role];
  return caps ? caps.includes(capability) : false;
}

export function isManager(role: string): boolean {
  return ["platform_admin", "owner", "org_admin", "support_manager"].includes(role);
}
