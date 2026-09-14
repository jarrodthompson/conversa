import type { SupabaseClient } from "@supabase/supabase-js";
import type { FlowDefinition, FlowNode } from "@/lib/chatbots/types";
import { generateReplyDraft, type DraftMessage } from "@/lib/ai/provider";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>;

export interface RuntimeCtx {
  orgId: string;
  conversationId: string;
  contactId: string | null;
  channelType: string;
}

export interface RuntimeSession {
  currentNodeId: string | null; // null = not started
  vars: Record<string, string>;
}

export interface BotOption {
  handle: string;
  label: string;
}

export interface RuntimeResult {
  messages: string[]; // bot messages to send this turn (in order)
  options: BotOption[] | null; // choice buttons awaiting selection
  awaitsInput: boolean; // expects free-text input to continue
  ended: boolean;
  handedOff: boolean;
  currentNodeId: string | null;
  vars: Record<string, string>;
}

function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

function outTarget(def: FlowDefinition, nodeId: string, handle = "out"): string | undefined {
  const edge = def.edges.find((e) => e.source === nodeId && (e.sourceHandle ?? "out") === handle);
  return edge?.target;
}

function cleanOptions(node: FlowNode): string[] {
  return ((node.data.options as string[] | undefined) ?? []).map((s) => String(s).trim()).filter(Boolean);
}

/** Real business-hours check for the org's default schedule; falls back to open. */
async function isWithinBusinessHours(db: DB, orgId: string): Promise<boolean> {
  try {
    const { data } = await db
      .from("business_hours")
      .select("timezone, schedule")
      .eq("organisation_id", orgId)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bh = data as any;
    if (!bh?.schedule) return true;
    const tz = bh.timezone || "UTC";
    const now = new Date();
    const day = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: tz }).format(now).toLowerCase();
    const hhmm = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(now);
    const ranges: [string, string][] = bh.schedule[day] ?? [];
    if (!ranges.length) return false;
    return ranges.some(([start, end]) => hhmm >= start && hhmm <= end);
  } catch {
    return true;
  }
}

/** Executes non-interactive nodes, performing real side effects, until the flow
 *  reaches a node that needs the user (question/choice) or a terminal node. */
async function walk(
  db: DB,
  ctx: RuntimeCtx,
  def: FlowDefinition,
  startNode: FlowNode | undefined,
  vars: Record<string, string>,
): Promise<RuntimeResult> {
  const byId = new Map(def.nodes.map((n) => [n.id, n]));
  const messages: string[] = [];
  let current = startNode;
  let guard = 0;

  while (current && guard++ < 50) {
    const n: FlowNode = current;
    switch (n.type) {
      case "send_message": {
        const body = interpolate(String(n.data.message ?? ""), vars);
        if (body) messages.push(body);
        current = byId.get(outTarget(def, n.id) ?? "");
        break;
      }
      case "ask_question": {
        messages.push(interpolate(String(n.data.question ?? "What can I help you with?"), vars));
        return { messages, options: null, awaitsInput: true, ended: false, handedOff: false, currentNodeId: n.id, vars };
      }
      case "collect_order": {
        messages.push("Please share your order number.");
        return { messages, options: null, awaitsInput: true, ended: false, handedOff: false, currentNodeId: n.id, vars };
      }
      case "collect_contact": {
        messages.push("Could you share your email address?");
        return { messages, options: null, awaitsInput: true, ended: false, handedOff: false, currentNodeId: n.id, vars };
      }
      case "multiple_choice": {
        const opts = cleanOptions(n);
        messages.push(interpolate(String(n.data.prompt ?? "Choose an option:"), vars));
        return {
          messages,
          options: opts.map((label, i) => ({ handle: `opt${i}`, label })),
          awaitsInput: false,
          ended: false,
          handedOff: false,
          currentNodeId: n.id,
          vars,
        };
      }
      case "condition": {
        const field = String(n.data.field ?? "");
        const val = String(n.data.value ?? "").toLowerCase();
        const actual = String(vars[field] ?? "").toLowerCase();
        const truthy = val ? actual.includes(val) : Boolean(actual);
        current = byId.get(outTarget(def, n.id, truthy ? "true" : "false") ?? "");
        break;
      }
      case "business_hours": {
        const open = await isWithinBusinessHours(db, ctx.orgId);
        current = byId.get(outTarget(def, n.id, open ? "open" : "closed") ?? "");
        break;
      }
      case "knowledge_search": {
        const q = interpolate(String(n.data.query ?? "{{answer}}"), vars).trim();
        if (q) {
          const { data } = await db
            .from("knowledge_articles")
            .select("title, body")
            .eq("organisation_id", ctx.orgId)
            .eq("status", "published")
            .or(`title.ilike.%${q}%,body.ilike.%${q}%`)
            .limit(1);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const art = (data as any[])?.[0];
          if (art) vars["kb"] = String(art.body ?? "").slice(0, 500);
        }
        current = byId.get(outTarget(def, n.id) ?? "");
        break;
      }
      case "ai_response": {
        const { data: msgs } = await db
          .from("messages")
          .select("direction, body")
          .eq("conversation_id", ctx.conversationId)
          .order("created_at", { ascending: true })
          .limit(12);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const history: DraftMessage[] = ((msgs ?? []) as any[])
          .filter((m) => (m.body ?? "").trim())
          .map((m) => ({ role: m.direction === "inbound" ? "customer" : "agent", body: m.body as string }));
        const res = await generateReplyDraft({ channel: ctx.channelType, messages: history });
        messages.push(res.text);
        current = byId.get(outTarget(def, n.id) ?? "");
        break;
      }
      case "assign_agent": {
        const agentId = String(n.data.agentId ?? "");
        if (/^[0-9a-f-]{36}$/i.test(agentId)) {
          await db.from("conversations").update({ assignee_id: agentId }).eq("id", ctx.conversationId);
        }
        current = byId.get(outTarget(def, n.id) ?? "");
        break;
      }
      case "assign_team": {
        const teamName = String(n.data.team ?? "").trim();
        if (teamName) {
          const { data: team } = await db
            .from("teams").select("id").eq("organisation_id", ctx.orgId).eq("name", teamName).maybeSingle();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((team as any)?.id) await db.from("conversations").update({ team_id: (team as any).id }).eq("id", ctx.conversationId);
        }
        current = byId.get(outTarget(def, n.id) ?? "");
        break;
      }
      case "add_tag": {
        const tagName = String(n.data.tag ?? "").trim();
        if (tagName) {
          let { data: tag } = await db
            .from("tags").select("id").eq("organisation_id", ctx.orgId).eq("name", tagName).maybeSingle();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (!(tag as any)?.id) {
            const ins = await db.from("tags").insert({ organisation_id: ctx.orgId, name: tagName }).select("id").maybeSingle();
            tag = ins.data;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tagId = (tag as any)?.id as string | undefined;
          if (tagId) {
            await db.from("conversation_tags").upsert(
              { conversation_id: ctx.conversationId, tag_id: tagId },
              { onConflict: "conversation_id,tag_id", ignoreDuplicates: true },
            );
          }
        }
        current = byId.get(outTarget(def, n.id) ?? "");
        break;
      }
      case "update_field": {
        const field = String(n.data.field ?? "");
        const allowed = ["first_name", "last_name", "company", "email", "phone"];
        if (ctx.contactId && allowed.includes(field)) {
          await db.from("contacts").update({ [field]: interpolate(String(n.data.value ?? ""), vars) }).eq("id", ctx.contactId);
        }
        current = byId.get(outTarget(def, n.id) ?? "");
        break;
      }
      case "webhook": {
        const url = String(n.data.url ?? "");
        if (/^https?:\/\//i.test(url)) {
          try {
            await fetch(url, {
              method: String(n.data.method ?? "POST"),
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ conversationId: ctx.conversationId, vars }),
              signal: AbortSignal.timeout(5000),
            });
          } catch { /* best-effort */ }
        }
        current = byId.get(outTarget(def, n.id) ?? "");
        break;
      }
      case "delay": {
        // Live delay would require scheduling; continue immediately.
        current = byId.get(outTarget(def, n.id) ?? "");
        break;
      }
      case "human_handoff": {
        const teamName = String(n.data.team ?? "").trim();
        const patch: Record<string, unknown> = { is_ai_handled: false, status: "open" };
        if (teamName) {
          const { data: team } = await db.from("teams").select("id").eq("organisation_id", ctx.orgId).eq("name", teamName).maybeSingle();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((team as any)?.id) patch.team_id = (team as any).id;
        }
        await db.from("conversations").update(patch).eq("id", ctx.conversationId);
        messages.push("Connecting you to a member of our team — someone will be with you shortly.");
        return { messages, options: null, awaitsInput: false, ended: false, handedOff: true, currentNodeId: null, vars };
      }
      case "end": {
        return { messages, options: null, awaitsInput: false, ended: true, handedOff: false, currentNodeId: null, vars };
      }
      default:
        current = byId.get(outTarget(def, n.id) ?? "");
    }
  }

  // Ran out of nodes (dead end) — treat as ended.
  return { messages, options: null, awaitsInput: false, ended: true, handedOff: false, currentNodeId: null, vars };
}

/**
 * Advances a chatbot flow by one turn. When starting (session.currentNodeId is
 * null) it begins at the Start node. Otherwise it applies the user's input at the
 * paused node and continues. Performs real side effects and returns the bot's
 * messages plus the new paused state.
 */
export async function runChatbot(
  db: DB,
  ctx: RuntimeCtx,
  def: FlowDefinition,
  session: RuntimeSession,
  input: { text?: string; handle?: string } | null,
): Promise<RuntimeResult> {
  const byId = new Map(def.nodes.map((n) => [n.id, n]));
  const vars = { ...session.vars };

  let next: FlowNode | undefined;
  if (session.currentNodeId === null) {
    const start = def.nodes.find((n) => n.type === "start");
    next = start ? byId.get(outTarget(def, start.id) ?? "") : undefined;
  } else {
    const node = byId.get(session.currentNodeId);
    if (!node) return { messages: [], options: null, awaitsInput: false, ended: true, handedOff: false, currentNodeId: null, vars };
    if (node.type === "ask_question" || node.type === "collect_order" || node.type === "collect_contact") {
      const v = String((node.data.variable as string) || (node.type === "collect_contact" ? "email" : node.type === "collect_order" ? "order_number" : "answer"));
      vars[v] = input?.text ?? "";
      next = byId.get(outTarget(def, node.id) ?? "");
    } else if (node.type === "multiple_choice") {
      const opts = cleanOptions(node);
      const idx = input?.handle ? Number.parseInt(input.handle.replace("opt", ""), 10) : 0;
      if (!Number.isNaN(idx) && opts[idx]) vars["choice"] = opts[idx];
      next = byId.get(outTarget(def, node.id, input?.handle ?? "opt0") ?? "");
    } else {
      next = byId.get(outTarget(def, node.id) ?? "");
    }
  }

  return walk(db, ctx, def, next, vars);
}
