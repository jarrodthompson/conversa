"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/auth/context";
import { resolveAudience, type Segment } from "@/lib/broadcasts/audience";
import { contactVariables } from "@/lib/broadcasts/personalize";
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
  if (!identifier.trim()) return { error: "Enter a test address" };
  await supabase.from("integration_logs").insert({
    organisation_id: orgId, level: "info",
    message: `Test broadcast queued to ${identifier} on ${channel} (demo — no live provider)`,
    context: asJson({ broadcast_id: id }),
  });
  return { ok: true };
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
    .select("id, channel_type, segment, requires_approval, approved_at, scheduled_at, variables")
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

  // Demo delivery simulation: distribute realistic statuses. No provider is called.
  const { data: recips } = await supabase
    .from("broadcast_recipients")
    .select("id")
    .eq("broadcast_id", id);
  const ids = ((recips ?? []) as { id: string }[]).map((r) => r.id);
  const now = new Date().toISOString();
  const pick = (i: number) => {
    const r = i % 10;
    if (r === 0) return "failed";
    if (r <= 2) return "sent";
    if (r <= 4) return "replied";
    if (r <= 6) return "read";
    return "delivered";
  };
  await Promise.all(
    ids.map((rid, i) =>
      supabase.from("broadcast_recipients")
        .update({ status: pick(i), sent_at: now, delivered_at: now })
        .eq("id", rid),
    ),
  );
  await supabase.from("broadcasts").update({ status: "sent", scheduled_at: now }).eq("id", id).eq("organisation_id", orgId);

  revalidatePath(`/app/broadcasts/${id}`);
  revalidatePath("/app/broadcasts");
  return { ok: true, sent: ids.length };
}
