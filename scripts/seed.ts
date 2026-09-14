/**
 * Seeds a realistic demonstration organisation into the configured Supabase
 * project using the service-role key (bypasses RLS). Safe to re-run: it clears
 * the demo org first (by slug) and recreates it.
 *
 *   npm run db:seed
 *
 * Prints demo login credentials at the end.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { createClient } from "@supabase/supabase-js";
import { subDays, subHours, subMinutes, addHours } from "date-fns";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("✖ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local");
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ORG_SLUG = "grovefield";
const DEMO_PASSWORD = "ConversaDemo!23";
const now = new Date();
const iso = (d: Date) => d.toISOString();

type Team = { id: string; name: string };

async function ensureUser(email: string, fullName: string) {
  // Try to find existing user first (idempotent across re-runs).
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  let id: string;
  if (existing) {
    id = existing.id;
    await db.auth.admin.updateUserById(id, {
      password: DEMO_PASSWORD,
      user_metadata: { full_name: fullName },
      email_confirm: true,
    });
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
    id = data.user.id;
  }
  await db.from("user_profiles").upsert({ id, full_name: fullName });
  return id;
}

async function main() {
  console.log("Seeding Conversa demo data…\n");

  // ── Team members (auth users) ──────────────────────────────────────────────
  const staff = [
    { key: "owner", email: "ava.owner@conversa.demo", name: "Ava Whitfield", role: "owner" },
    { key: "manager", email: "noah.manager@conversa.demo", name: "Noah Bennett", role: "support_manager" },
    { key: "agent1", email: "priya.agent@conversa.demo", name: "Priya Nadar", role: "support_agent" },
    { key: "agent2", email: "marcus.agent@conversa.demo", name: "Marcus Bell", role: "support_agent" },
    { key: "agent3", email: "lena.agent@conversa.demo", name: "Lena Ortiz", role: "support_agent" },
    { key: "marketing", email: "sara.marketing@conversa.demo", name: "Sara Kline", role: "marketing" },
  ] as const;

  const userIds: Record<string, string> = {};
  for (const s of staff) {
    userIds[s.key] = await ensureUser(s.email, s.name);
    console.log(`  · user ${s.email}`);
  }

  // ── Clean previous demo org ────────────────────────────────────────────────
  const { data: prev } = await db.from("organisations").select("id").eq("slug", ORG_SLUG).maybeSingle();
  if (prev) {
    await db.from("organisations").delete().eq("id", prev.id);
    console.log("  · cleared previous demo org");
  }

  // ── Organisation ───────────────────────────────────────────────────────────
  const { data: org, error: orgErr } = await db
    .from("organisations")
    .insert({
      name: "Grovefield Supplies",
      slug: ORG_SLUG,
      industry: "Retail & E-commerce",
      timezone: "Europe/London",
      onboarding_step: 9,
      onboarded_at: iso(subDays(now, 20)),
      created_by: userIds.owner,
    })
    .select()
    .single();
  if (orgErr) throw orgErr;
  const orgId = org.id;
  console.log(`  · organisation ${org.name}`);

  // ── Memberships ────────────────────────────────────────────────────────────
  await db.from("organisation_members").insert(
    staff.map((s, i) => ({
      organisation_id: orgId,
      user_id: userIds[s.key],
      role: s.role,
      is_default: i === 0,
      status: "active",
      accepted_at: iso(subDays(now, 20)),
    })),
  );

  // ── Teams ──────────────────────────────────────────────────────────────────
  const { data: teams } = await db
    .from("teams")
    .insert([
      { organisation_id: orgId, name: "Support", color: "#06B6D4", routing_strategy: "round_robin" },
      { organisation_id: orgId, name: "Orders", color: "#8B5CF6", routing_strategy: "manual" },
      { organisation_id: orgId, name: "Billing", color: "#F59E0B", routing_strategy: "skill" },
    ])
    .select();
  const teamBy = Object.fromEntries((teams as Team[]).map((t) => [t.name, t.id]));

  await db.from("team_members").insert([
    { team_id: teamBy.Support, user_id: userIds.manager, is_lead: true },
    { team_id: teamBy.Support, user_id: userIds.agent1, is_lead: false },
    { team_id: teamBy.Support, user_id: userIds.agent2, is_lead: false },
    { team_id: teamBy.Orders, user_id: userIds.agent2, is_lead: true },
    { team_id: teamBy.Orders, user_id: userIds.agent3, is_lead: false },
    { team_id: teamBy.Billing, user_id: userIds.agent3, is_lead: true },
  ]);

  // ── Inboxes & channels ─────────────────────────────────────────────────────
  const { data: inboxes, error: inboxErr } = await db
    .from("inboxes")
    .insert([
      { organisation_id: orgId, name: "General Support", team_id: teamBy.Support, is_default: true },
      { organisation_id: orgId, name: "Orders", team_id: teamBy.Orders, is_default: false },
    ])
    .select();
  if (inboxErr) throw new Error(`inboxes: ${inboxErr.message}`);
  const defaultInbox = inboxes![0].id;

  const { data: channels } = await db
    .from("channels")
    .insert([
      { organisation_id: orgId, inbox_id: defaultInbox, type: "whatsapp", name: "WhatsApp Business", is_demo: true },
      { organisation_id: orgId, inbox_id: defaultInbox, type: "email", name: "support@grovefield.demo", is_demo: true },
      { organisation_id: orgId, inbox_id: defaultInbox, type: "web_chat", name: "Website Live Chat", is_demo: true },
    ])
    .select();
  const chanBy = Object.fromEntries(channels!.map((c) => [c.type, c.id]));
  await db.from("channel_connections").insert(
    channels!.map((c) => ({
      organisation_id: orgId,
      channel_id: c.id,
      status: "demo",
      config: { note: "Demo adapter — no live provider connected" },
    })),
  );

  // ── Tags ───────────────────────────────────────────────────────────────────
  const { data: tags } = await db
    .from("tags")
    .insert(
      ["Card Replacement", "Orders", "Stock", "Billing", "Delivery", "VIP", "Refund"].map((name) => ({
        organisation_id: orgId,
        name,
      })),
    )
    .select();
  const tagBy = Object.fromEntries(tags!.map((t) => [t.name, t.id]));

  // ── SLA, business hours, plans ─────────────────────────────────────────────
  const { data: sla } = await db
    .from("sla_policies")
    .insert({ organisation_id: orgId, name: "Standard", first_response_minutes: 60, resolution_minutes: 1440 })
    .select()
    .single();

  await db.from("business_hours").insert({
    organisation_id: orgId,
    name: "UK Office Hours",
    timezone: "Europe/London",
    is_default: true,
    schedule: { mon: [["09:00", "17:30"]], tue: [["09:00", "17:30"]], wed: [["09:00", "17:30"]], thu: [["09:00", "17:30"]], fri: [["09:00", "17:00"]] },
  });

  const { data: plans } = await db
    .from("subscription_plans")
    .upsert(
      [
        { key: "starter", name: "Starter", price_monthly: 0, seats: 3, features: { channels: 1, ai: false } },
        { key: "growth", name: "Growth", price_monthly: 4900, seats: 10, features: { channels: 6, ai: true } },
        { key: "business", name: "Business", price_monthly: 14900, seats: 25, features: { api: true } },
        { key: "enterprise", name: "Enterprise", price_monthly: 0, seats: null, features: { sso: true } },
      ],
      { onConflict: "key" },
    )
    .select();
  const growth = plans!.find((p) => p.key === "growth")!;
  await db.from("organisation_subscriptions").upsert(
    { organisation_id: orgId, plan_id: growth.id, status: "active", seats: 10, current_period_end: iso(addHours(now, 24 * 20)) },
    { onConflict: "organisation_id" },
  );

  // ── Contacts (30) ──────────────────────────────────────────────────────────
  const firstNames = ["Sophie", "Marcus", "Ana", "Tom", "Lena", "Ravi", "Grace", "Owen", "Maya", "Felix", "Nadia", "Leo", "Isla", "Hugo", "Zara", "Ben", "Chloe", "Sam", "Ruby", "Kai", "Elena", "Josh", "Mia", "Dan", "Aisha", "Paul", "Nina", "Theo", "Erin", "Omar"];
  const lastNames = ["Elwood", "Bell", "Ruiz", "Fisher", "Ortiz", "Shah", "Okafor", "Reid", "Lin", "Grant", "Haddad", "Park", "Byrne", "Meyer", "Ali", "Cole", "Frost", "Webb", "Dunn", "Rao", "Costa", "Ford", "Nash", "Hale", "Khan", "Wren", "Voss", "Lund", "Page", "Diaz"];
  const companies = ["Northwind", "Lumen Co", "Acre & Co", "Bluewave", "Tanka", null, null];

  const contactRows = firstNames.map((fn, i) => ({
    organisation_id: orgId,
    first_name: fn,
    last_name: lastNames[i],
    email: `${fn.toLowerCase()}.${lastNames[i].toLowerCase()}@example.com`,
    phone: `+4479${String(10000000 + i * 137).slice(0, 8)}`,
    whatsapp_number: `+4479${String(10000000 + i * 137).slice(0, 8)}`,
    company: companies[i % companies.length],
    location: "United Kingdom",
    language: "en",
    timezone: "Europe/London",
    consent_status: i % 4 === 0 ? "opted_in" : "unknown",
    consent_source: i % 4 === 0 ? "web_form" : null,
    owner_id: userIds[["agent1", "agent2", "agent3"][i % 3]],
    last_contacted_at: iso(subDays(now, i % 15)),
  }));
  const { data: contacts } = await db.from("contacts").insert(contactRows).select();

  await db.from("contact_channels").insert(
    contacts!.flatMap((c) => [
      { organisation_id: orgId, contact_id: c.id, channel_type: "email", identifier: c.email!, verified: true },
      { organisation_id: orgId, contact_id: c.id, channel_type: "whatsapp", identifier: c.whatsapp_number!, verified: true },
    ]),
  );
  // Tag a few VIPs
  await db.from("contact_tags").insert(
    contacts!.slice(0, 5).map((c) => ({ contact_id: c.id, tag_id: tagBy.VIP })),
  );

  // ── Conversations (40) ─────────────────────────────────────────────────────
  const channelTypes = ["whatsapp", "email", "web_chat"] as const;
  const statuses = ["open", "open", "open", "pending", "waiting", "snoozed", "resolved", "resolved", "spam"] as const;
  const priorities = ["low", "normal", "normal", "high", "urgent"] as const;
  const subjects = [
    "Card replacement request", "Where is my order?", "Add item to existing order", "Product out of stock",
    "Refund status", "Delivery address change", "Damaged item received", "Gift card not working",
    "Cancel my subscription", "Bulk order enquiry", "Wrong size delivered", "Invoice question",
  ];
  const openingByContact = [
    "Hi, I've lost my card and need a replacement as soon as possible.",
    "Hello — my order was due yesterday but hasn't arrived. Can you check?",
    "Can I add another item to an order I placed this morning?",
    "The product I want still shows out of stock — when will it return?",
    "I returned an item last week, when will my refund come through?",
  ];
  const agentReplies = [
    "Thanks for reaching out — I can help with that right away.",
    "I'm sorry for the trouble. Let me take a look at your account now.",
    "Good news, I've found your order and can update it for you.",
    "I completely understand — let me check our stock system.",
  ];

  let firstConvId: string | null = null;
  for (let i = 0; i < 40; i++) {
    const contact = contacts![i % contacts!.length];
    const channelType = channelTypes[i % channelTypes.length];
    const status = statuses[i % statuses.length];
    const priority = priorities[i % priorities.length];
    const isAi = i % 5 === 0 && status !== "spam";
    const assignee = status === "resolved" || i % 3 === 0 ? userIds[["agent1", "agent2", "agent3"][i % 3]] : null;
    const createdAt = subHours(now, i * 5 + 1);
    const lastAt = subMinutes(now, (i % 12) * 7 + 2);
    const slaDue = addHours(createdAt, 1);
    const slaBreached = status === "open" && i % 6 === 0;

    const { data: conv } = await db
      .from("conversations")
      .insert({
        organisation_id: orgId,
        inbox_id: defaultInbox,
        channel_id: chanBy[channelType],
        channel_type: channelType,
        contact_id: contact.id,
        subject: subjects[i % subjects.length],
        status,
        priority,
        assignee_id: assignee,
        team_id: teamBy.Support,
        is_ai_handled: isAi,
        sentiment: (["positive", "neutral", "neutral", "negative"] as const)[i % 4],
        ai_summary: isAi ? "Customer query handled by the AI agent using the knowledge base; no escalation required." : null,
        last_message_at: iso(lastAt),
        last_message_preview: openingByContact[i % openingByContact.length].slice(0, 60),
        first_response_at: assignee ? iso(addMinutesSafe(createdAt, 12)) : null,
        resolved_at: status === "resolved" ? iso(subHours(now, i)) : null,
        snoozed_until: status === "snoozed" ? iso(addHours(now, 12)) : null,
        sla_policy_id: sla!.id,
        sla_due_at: iso(slaDue),
        sla_breached: slaBreached,
        unread_count: status === "open" && !assignee ? 1 : 0,
        created_at: iso(createdAt),
      })
      .select()
      .single();
    if (!conv) continue;
    if (!firstConvId) firstConvId = conv.id;

    // messages
    const msgs = [
      {
        organisation_id: orgId, conversation_id: conv.id, direction: "inbound", author_type: "contact",
        contact_id: contact.id, body: openingByContact[i % openingByContact.length], sent_at: iso(createdAt), created_at: iso(createdAt),
        delivery_status: "delivered",
      },
    ];
    if (isAi) {
      msgs.push({
        organisation_id: orgId, conversation_id: conv.id, direction: "outbound", author_type: "ai",
        contact_id: null as unknown as string, body: "Thanks! Based on our help centre, here's how to resolve that…", sent_at: iso(addMinutesSafe(createdAt, 1)), created_at: iso(addMinutesSafe(createdAt, 1)),
        delivery_status: "delivered",
      });
    } else if (assignee) {
      msgs.push({
        organisation_id: orgId, conversation_id: conv.id, direction: "outbound", author_type: "agent",
        contact_id: null as unknown as string, body: agentReplies[i % agentReplies.length], sent_at: iso(addMinutesSafe(createdAt, 12)), created_at: iso(addMinutesSafe(createdAt, 12)),
        delivery_status: "read",
      });
    }
    await db.from("messages").insert(msgs);

    // internal note on some
    if (i % 4 === 0 && assignee) {
      await db.from("internal_notes").insert({
        organisation_id: orgId, conversation_id: conv.id, author_id: userIds.manager,
        body: "Flagging for follow-up — check the customer's previous order history before responding.",
      });
    }
    // tags
    const tagName = ["Card Replacement", "Orders", "Stock", "Billing", "Delivery"][i % 5];
    await db.from("conversation_tags").insert({ conversation_id: conv.id, tag_id: tagBy[tagName] });

    // ai run for AI-handled
    if (isAi) {
      await db.from("ai_runs").insert({
        organisation_id: orgId, conversation_id: conv.id, kind: "reply", provider: "demo",
        output: "Thanks! Based on our help centre, here's how to resolve that…", confidence: 0.82, escalated: false,
        created_at: iso(addMinutesSafe(createdAt, 1)),
      });
    }
  }
  console.log("  · 40 conversations with messages, notes, tags");

  // ── AI agent ───────────────────────────────────────────────────────────────
  const { data: agent } = await db
    .from("ai_agents")
    .insert({
      organisation_id: orgId, name: "Grove Assistant", status: "published", tone: "friendly", language: "en",
      channels: ["whatsapp", "web_chat", "email"], greeting: "Hi! I'm Grove, how can I help today?",
      fallback_message: "Let me connect you with a member of our team.", confidence_threshold: 0.6,
      allowed_topics: ["orders", "delivery", "returns", "products"], prohibited_topics: ["legal advice", "medical advice"],
      provider: "demo", created_by: userIds.owner,
    })
    .select()
    .single();
  await db.from("ai_agent_versions").insert({ agent_id: agent!.id, version: 1, snapshot: agent!, published_by: userIds.owner });

  // ── Knowledge base ─────────────────────────────────────────────────────────
  const { data: coll } = await db
    .from("knowledge_collections")
    .insert({ organisation_id: orgId, name: "Help Centre", description: "Customer-facing articles" })
    .select()
    .single();
  await db.from("ai_agent_sources").insert({ agent_id: agent!.id, collection_id: coll!.id });

  const articles = [
    ["How to replace a lost or stolen card", "If your card is lost or stolen, you can request a replacement from your account settings. Replacements arrive within 3–5 working days."],
    ["Tracking your order", "Once your order ships you'll receive a tracking link by email and WhatsApp. Orders are typically delivered within 2–4 working days."],
    ["Our refund policy", "Refunds are processed within 5–7 working days of us receiving your return. The amount is credited to your original payment method."],
    ["Changing your delivery address", "You can change your delivery address before your order is dispatched from the Orders page. After dispatch, contact support."],
    ["Returns and exchanges", "Items can be returned within 30 days in original condition. Start a return from the Orders page to receive a prepaid label."],
    ["Product availability and restocks", "Out-of-stock items show an estimated restock date. You can opt in to be notified when an item returns."],
    ["Using gift cards", "Gift cards can be applied at checkout. If a code isn't working, check for spaces and that it hasn't expired."],
    ["Managing your subscription", "You can pause, change or cancel your subscription at any time from Account → Subscription."],
    ["Damaged or incorrect items", "If your item arrives damaged or incorrect, send a photo through support and we'll arrange a replacement."],
    ["Bulk and business orders", "For orders over 50 units, our team can offer bulk pricing. Contact us with quantities and delivery timelines."],
  ];
  await db.from("knowledge_articles").insert(
    articles.map(([title, body], i) => ({
      organisation_id: orgId, collection_id: coll!.id, title, body, status: "published",
      index_status: "indexed", source_type: "article", owner_id: userIds.manager,
      published_at: iso(subDays(now, 10 - i)), tags: ["help"],
    })),
  );
  console.log("  · AI agent + 10 knowledge articles");

  // ── Chatbot flows (2) ──────────────────────────────────────────────────────
  const welcomeFlow = {
    nodes: [
      { id: "start", type: "start", position: { x: 80, y: 80 }, data: {} },
      { id: "msg1", type: "send_message", position: { x: 80, y: 200 }, data: { message: "Welcome to Grovefield! How can we help?" } },
      { id: "choice", type: "multiple_choice", position: { x: 80, y: 320 }, data: { prompt: "Choose an option:", options: ["Track order", "Returns", "Talk to a human"] } },
      { id: "handoff", type: "human_handoff", position: { x: 80, y: 460 }, data: { team: "Support" } },
    ],
    edges: [
      { id: "e1", source: "start", target: "msg1" },
      { id: "e2", source: "msg1", target: "choice" },
      { id: "e3", source: "choice", target: "handoff" },
    ],
  };
  await db.from("chatbot_flows").insert([
    { organisation_id: orgId, name: "Website Welcome Bot", description: "Greets web visitors and routes them.", status: "published", channels: ["web_chat"], definition: welcomeFlow, created_by: userIds.owner },
    { organisation_id: orgId, name: "Order Status Bot", description: "Collects an order number and looks up status.", status: "draft", channels: ["whatsapp"], definition: { nodes: [{ id: "start", type: "start", position: { x: 80, y: 80 }, data: {} }], edges: [] }, created_by: userIds.owner },
  ]);

  // ── Automation rules (3) ───────────────────────────────────────────────────
  await db.from("automation_rules").insert([
    { organisation_id: orgId, name: "Route billing keywords to Billing team", position: 0, status: "active", trigger_type: "message.inbound", trigger_config: {}, conditions: [{ field: "body", op: "contains", value: "refund" }], actions: [{ type: "assign_team", team: "Billing" }, { type: "add_tag", tag: "Billing" }], created_by: userIds.owner },
    { organisation_id: orgId, name: "Escalate negative sentiment", position: 1, status: "active", trigger_type: "sentiment.negative", trigger_config: {}, conditions: [], actions: [{ type: "set_priority", value: "high" }, { type: "notify_manager" }], created_by: userIds.owner },
    { organisation_id: orgId, name: "Auto-resolve waiting after 48h", position: 2, status: "disabled", trigger_type: "conversation.idle", trigger_config: { hours: 48 }, conditions: [{ field: "status", op: "eq", value: "waiting" }], actions: [{ type: "resolve" }], created_by: userIds.owner },
  ]);

  // ── Broadcasts (2) ─────────────────────────────────────────────────────────
  const { data: template } = await db
    .from("message_templates")
    .insert({ organisation_id: orgId, name: "spring_sale", channel_type: "whatsapp", category: "marketing", body: "Hi {{1}}, our spring sale is on — 20% off this week only!", variables: ["first_name"], approval_status: "approved" })
    .select()
    .single();

  const optedIn = contacts!.filter((_, i) => i % 4 === 0);
  const { data: bc } = await db
    .from("broadcasts")
    .insert([
      { organisation_id: orgId, name: "Spring Sale Announcement", channel_type: "whatsapp", template_id: template!.id, status: "sent", scheduled_at: iso(subDays(now, 3)), approved_by: userIds.owner, approved_at: iso(subDays(now, 4)), created_by: userIds.marketing },
      { organisation_id: orgId, name: "May Newsletter", channel_type: "email", status: "scheduled", scheduled_at: iso(addHours(now, 48)), created_by: userIds.marketing },
    ])
    .select();

  const sent = bc!.find((b) => b.status === "sent")!;
  await db.from("broadcast_recipients").insert(
    optedIn.map((c, i) => ({
      organisation_id: orgId, broadcast_id: sent.id, contact_id: c.id,
      status: (["delivered", "read", "replied", "delivered", "sent"] as const)[i % 5],
      sent_at: iso(subDays(now, 3)),
    })),
  );
  console.log("  · 2 chatbot flows, 3 automations, 2 broadcasts");

  console.log("\n✔ Seed complete.\n");
  console.log("Demo login (Owner):");
  console.log(`   email:    ava.owner@conversa.demo`);
  console.log(`   password: ${DEMO_PASSWORD}`);
  console.log("\nOther roles share the same password:");
  console.log("   noah.manager@conversa.demo (Support Manager)");
  console.log("   priya.agent@conversa.demo  (Support Agent)");
  console.log("   sara.marketing@conversa.demo (Marketing)");
}

function addMinutesSafe(d: Date, m: number) {
  return new Date(d.getTime() + m * 60000);
}

main().catch((e) => {
  console.error("\n✖ Seed failed:", e);
  process.exit(1);
});
