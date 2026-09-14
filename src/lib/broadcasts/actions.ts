"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/auth/context";
import { resolveAudience, type Segment } from "@/lib/broadcasts/audience";
import { contactVariables, personalize } from "@/lib/broadcasts/personalize";
import { sendEmail } from "@/lib/channels/email/send";
import { sendWhatsAppText } from "@/lib/channels/whatsapp/send";
import { can } from "@/lib/auth/roles";
import type { Json } from "@/lib/supabase/types";

const asJson = (v: unknown): Json => v as Json;

async function ctx() {
  const c = await getAppContext();
  if (!can(c.role, "broadcasts.manage")) throw new Error("Not authorised to manage broadcasts");
  const supabase = await createClient();
  return { supabase, orgId: c.org.id, userId: c.userId };
}

export async function createBroadcastAction() {
  const { supabase, orgId, userId } = await ctx();
  const { data, error } = await supabase
    .from("broadcasts")
    .insert({
      organisation_id: orgId, name: "Untitled broadcast", channel_type: "whatsapp",
      status: "draft", segment: { requireConsent: true }, variables: {},
      requires_approval: true, created_by: userId,
    })
    .select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Could not create broadcast");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redirect(`/app/broadcasts/${(data as any).id}`);
}

export async function saveBroadcastAction(
  id: string,
  payload: {
    name: string;
    channel_type: string;
    template_id: string | null;
    body: string;
    segment: Segment;
    scheduled_at: string | null;
    frequency_cap: number | null;
  },
) {
  const { supabase, orgId } = await ctx();
  const { error } = await supabase
    .from("broadcasts")
    .update({
      name: payload.name,
      channel_type: payload.channel_type,
      template_id: payload.template_id,
      segment: asJson(payload.segment),
      variables: asJson({ body: payload.body }),
      scheduled_at: payload.scheduled_at,
      frequency_cap: payload.frequency_cap,
    })
    .eq("id", id).eq("organisation_id", orgId);
  if (error) return { error: error.message };
  revalidatePath(`/app/broadcasts/${id}`);
  return { ok: true };
}

export async function previewAudienceAction(id: string, channel: string, segment: Segment) {
  const { supabase, orgId } = await ctx();
  const res = await resolveAudience(supabase, orgId, channel, segment);
  return {
    counts: res.counts,
    sample: res.eligible.slice(0, 5).map((c) => ({
      name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "—",
      identifier: c.identifier,
    })),
  };
}

export async function sendTestAction(id: string, channel: string, identifier: string) {
  const { supabase, orgId } = await ctx();
  const to = identifier.trim();
  if (!to) return { error: "Enter a test address" };

  const { data: bc } = await supabase
    .from("broadcasts")
    .select("name, variables")
    .eq("id", id).eq("organisation_id", orgId).maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = personalize(String(((bc as any)?.variables as { body?: string })?.body ?? "Test message"), {});

  const { data: chan } = await supabase
    .from("channels")
    .select("config:channel_connections(config)")
    .eq("organisation_id", orgId).eq("type", channel).is("deleted_at", null).maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conn = Array.isArray((chan as any)?.config) ? (chan as any).config[0] : (chan as any)?.config;
  const cfg = (conn?.config ?? {}) as { from_address?: string; sender_name?: string; phone_number_id?: string };

  try {
    if (channel === "email" && process.env.RESEND_API_KEY && (cfg.from_address || process.env.EMAIL_FROM)) {
      const from = cfg.from_address ?? process.env.EMAIL_FROM!;
      const res = await sendEmail({
        apiKey: process.env.RESEND_API_KEY,
        from: cfg.sender_name ? `${cfg.sender_name} <${from}>` : from,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        to, subject: `[Test] ${(bc as any)?.name ?? "Broadcast"}`, text: body,
      });
      if (res.demo) return { ok: true, warning: "No live provider — test not actually sent." };
      return { ok: true, live: true };
    }
    if (channel === "whatsapp" && process.env.WHATSAPP_ACCESS_TOKEN && (cfg.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID)) {
      const res = await sendWhatsAppText({
        phoneNumberId: cfg.phone_number_id ?? process.env.WHATSAPP_PHONE_NUMBER_ID,
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
        to: to.replace(/^\+/, ""), body,
      });
      if (res.demo) return { ok: true, warning: "No live provider — test not actually sent." };
      return { ok: true, live: true };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Test send failed" };
  }

  await supabase.from("integration_logs").insert({
    organisation_id: orgId, level: "info",
    message: `Test broadcast queued to ${to} on ${channel} (no live provider)`,
    context: asJson({ broadcast_id: id }),
  });
  return { ok: true, warning: "No live provider configured for this channel — test logged only." };
}

export async function approveBroadcastAction(id: string) {
  const { supabase, orgId, userId } = await ctx();
  const { error } = await supabase
    .from("broadcasts")
    .update({ approved_by: userId, approved_at: new Date().toISOString() })
    .eq("id", id).eq("organisation_id", orgId);
  if (error) return { error: error.message };
  revalidatePath(`/app/broadcasts/${id}`);
  return { ok: true };
}

/**
 * Materialises the eligible audience into broadcast_recipients (consent +
 * suppression enforced), then either schedules or "sends" (demo delivery
 * simulation — no live provider is contacted). Idempotent per (broadcast,
 * contact) via the unique constraint.
 */
export async function dispatchBroadcastAction(id: string, mode: "now" | "schedule") {
  const { supabase, orgId } = await ctx();

  const { data: bc } = await supabase
    .from("broadcasts")
    .select("id, name, channel_type, segment, requires_approval, approved_at, scheduled_at, variables")
    .eq("id", id).eq("organisation_id", orgId).maybeSingle();
  if (!bc) return { error: "Broadcast not found" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = bc as any;
  if (b.requires_approval && !b.approved_at) return { error: "Broadcast must be approved first" };
  if (mode === "schedule" && !b.scheduled_at) return { error: "Set a schedule date first" };

  const audience = await resolveAudience(supabase, orgId, b.channel_type, (b.segment ?? {}) as Segment);
  if (audience.eligible.length === 0) return { error: "No eligible recipients (check consent and audience filters)" };

  // Build recipient rows with per-contact personalisation variables.
  const rows = audience.eligible.map((c) => ({
    organisation_id: orgId,
    broadcast_id: id,
    contact_id: c.id,
    status: "queued" as const,
    variables: asJson(contactVariables(c)),
  }));

  // Upsert so re-dispatch is idempotent (unique broadcast_id+contact_id).
  const { error: insErr } = await supabase
    .from("broadcast_recipients")
    .upsert(rows, { onConflict: "broadcast_id,contact_id", ignoreDuplicates: true });
  if (insErr) return { error: insErr.message };

  if (mode === "schedule") {
    await supabase.from("broadcasts").update({ status: "scheduled" }).eq("id", id).eq("organisation_id", orgId);
    revalidatePath(`/app/broadcasts/${id}`);
    return { ok: true, scheduled: audience.eligible.length };
  }

  // Resolve the channel's (non-secret) sender config for live delivery.
  const { data: chan } = await supabase
    .from("channels")
    .select("config:channel_connections(config)")
    .eq("organisation_id", orgId)
    .eq("type", b.channel_type)
    .is("deleted_at", null)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conn = Array.isArray((chan as any)?.config) ? (chan as any).config[0] : (chan as any)?.config;
  const cfg = (conn?.config ?? {}) as { from_address?: string; sender_name?: string; phone_number_id?: string };

  const template = String((b.variables as { body?: string })?.body ?? "");
  const emailFrom = cfg.from_address ?? process.env.EMAIL_FROM;
  const phoneNumberId = cfg.phone_number_id ?? process.env.WHATSAPP_PHONE_NUMBER_ID;
  const liveEmail = b.channel_type === "email" && Boolean(process.env.RESEND_API_KEY) && Boolean(emailFrom);
  const liveWa = b.channel_type === "whatsapp" && Boolean(process.env.WHATSAPP_ACCESS_TOKEN) && Boolean(phoneNumberId);
  const live = liveEmail || liveWa;

  // Map materialised recipients back to their audience contact (identifier + fields).
  const byContact = new Map(audience.eligible.map((c) => [c.id, c]));
  const { data: recips } = await supabase
    .from("broadcast_recipients")
    .select("id, contact_id")
    .eq("broadcast_id", id);
  const rowsToSend = (recips ?? []) as { id: string; contact_id: string }[];

  const now = new Date().toISOString();
  // Simulated status distribution (used only when no live provider is configured).
  const pick = (i: number) => {
    const r = i % 10;
    if (r === 0) return "failed";
    if (r <= 2) return "sent";
    if (r <= 4) return "replied";
    if (r <= 6) return "read";
    return "delivered";
  };

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < rowsToSend.length; i++) {
    const row = rowsToSend[i];
    const c = byContact.get(row.contact_id);
    if (!c) continue;
    const bodyText = personalize(template, c);

    let status = "sent";
    let failedReason: string | null = null;
    let delivered = false;
    try {
      if (liveEmail) {
        const res = await sendEmail({
          apiKey: process.env.RESEND_API_KEY,
          from: cfg.sender_name ? `${cfg.sender_name} <${emailFrom}>` : emailFrom,
          to: c.identifier,
          subject: b.name || "A message from us",
          text: bodyText,
        });
        if (res.demo) { status = "failed"; failedReason = "No live email provider configured"; }
      } else if (liveWa) {
        const res = await sendWhatsAppText({
          phoneNumberId,
          accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
          to: c.identifier.replace(/^\+/, ""),
          body: bodyText,
        });
        if (res.demo) { status = "failed"; failedReason = "No live WhatsApp provider configured"; }
      } else {
        // No live provider for this channel — simulate a realistic distribution.
        status = pick(i);
        delivered = status === "delivered";
      }
    } catch (err) {
      status = "failed";
      failedReason = err instanceof Error ? err.message.slice(0, 300) : "Delivery failed";
    }

    if (status === "failed") failed++;
    else sent++;

    await supabase
      .from("broadcast_recipients")
      .update({
        status,
        sent_at: status === "failed" ? null : now,
        delivered_at: delivered ? now : null,
        failed_reason: failedReason,
      })
      .eq("id", row.id);
  }

  await supabase.from("broadcasts").update({ status: "sent", scheduled_at: now }).eq("id", id).eq("organisation_id", orgId);

  if (live) {
    await supabase.from("integration_logs").insert({
      organisation_id: orgId, level: "info",
      message: `Broadcast dispatched via live ${b.channel_type}: ${sent} sent, ${failed} failed`,
      context: asJson({ broadcast_id: id }),
    });
  }

  revalidatePath(`/app/broadcasts/${id}`);
  revalidatePath("/app/broadcasts");
  return { ok: true, sent, failed, live };
}
