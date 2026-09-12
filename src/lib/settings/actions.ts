"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/roles";
import type { Json } from "@/lib/supabase/types";

const asJson = (v: unknown): Json => v as Json;

async function manageCtx() {
  const c = await getAppContext();
  if (!can(c.role, "settings.manage")) throw new Error("Not authorised to manage settings");
  const supabase = await createClient();
  return { supabase, orgId: c.org.id, userId: c.userId };
}

function ok(path = "/app/settings"): { ok: true; error?: string } {
  revalidatePath(path, "layout");
  return { ok: true };
}

// ── Inboxes ──────────────────────────────────────────────────────────────────
export async function createInboxAction(name: string, teamId: string | null) {
  const { supabase, orgId } = await manageCtx();
  if (!name.trim()) return { error: "Name is required" };
  const { error } = await supabase.from("inboxes").insert({ organisation_id: orgId, name: name.trim(), team_id: teamId || null });
  if (error) return { error: error.message };
  return ok("/app/settings/inboxes");
}

export async function setDefaultInboxAction(id: string) {
  const { supabase, orgId } = await manageCtx();
  await supabase.from("inboxes").update({ is_default: false }).eq("organisation_id", orgId);
  const { error } = await supabase.from("inboxes").update({ is_default: true }).eq("id", id).eq("organisation_id", orgId);
  if (error) return { error: error.message };
  return ok("/app/settings/inboxes");
}

export async function deleteInboxAction(id: string) {
  const { supabase, orgId } = await manageCtx();
  const { error } = await supabase.from("inboxes").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("organisation_id", orgId);
  if (error) return { error: error.message };
  return ok("/app/settings/inboxes");
}

// ── Tags ─────────────────────────────────────────────────────────────────────
export async function createTagAction(name: string, color: string) {
  const { supabase, orgId } = await manageCtx();
  if (!name.trim()) return { error: "Name is required" };
  const { error } = await supabase.from("tags").insert({ organisation_id: orgId, name: name.trim(), color: color || "#22D3EE" });
  if (error) return { error: error.message };
  return ok("/app/settings/tags");
}

export async function deleteTagAction(id: string) {
  const { supabase, orgId } = await manageCtx();
  const { error } = await supabase.from("tags").delete().eq("id", id).eq("organisation_id", orgId);
  if (error) return { error: error.message };
  return ok("/app/settings/tags");
}

// ── SLA policies ─────────────────────────────────────────────────────────────
export async function upsertSlaAction(payload: {
  id: string | null; name: string; first_response_minutes: number; resolution_minutes: number; priority: string | null;
}) {
  const { supabase, orgId } = await manageCtx();
  const id = payload.id || null;
  const name = payload.name.trim();
  if (!name) return { error: "Name is required" };
  const row = { organisation_id: orgId, name, first_response_minutes: payload.first_response_minutes, resolution_minutes: payload.resolution_minutes, priority: payload.priority || null };
  const { error } = id
    ? await supabase.from("sla_policies").update(row).eq("id", id).eq("organisation_id", orgId)
    : await supabase.from("sla_policies").insert(row);
  if (error) return { error: error.message };
  return ok("/app/settings/sla");
}

export async function deleteSlaAction(id: string) {
  const { supabase, orgId } = await manageCtx();
  const { error } = await supabase.from("sla_policies").delete().eq("id", id).eq("organisation_id", orgId);
  if (error) return { error: error.message };
  return ok("/app/settings/sla");
}

// ── Business hours ───────────────────────────────────────────────────────────
export async function upsertBusinessHoursAction(
  id: string | null,
  payload: { name: string; timezone: string; schedule: Record<string, [string, string][]> },
) {
  const { supabase, orgId } = await manageCtx();
  if (!payload.name.trim()) return { error: "Name is required" };
  const row = { organisation_id: orgId, name: payload.name.trim(), timezone: payload.timezone, schedule: asJson(payload.schedule) };
  const { error } = id
    ? await supabase.from("business_hours").update(row).eq("id", id).eq("organisation_id", orgId)
    : await supabase.from("business_hours").insert({ ...row, is_default: true });
  if (error) return { error: error.message };
  return ok("/app/settings/business-hours");
}

// ── Billing ──────────────────────────────────────────────────────────────────
export async function changePlanAction(planId: string) {
  const { supabase, orgId } = await manageCtx();
  const { data: plan } = await supabase.from("subscription_plans").select("seats").eq("id", planId).maybeSingle();
  const { error } = await supabase.from("organisation_subscriptions").upsert(
    { organisation_id: orgId, plan_id: planId, status: "active", seats: plan?.seats ?? 3 },
    { onConflict: "organisation_id" },
  );
  if (error) return { error: error.message };
  return ok("/app/settings/billing");
}

// ── Team & roles ─────────────────────────────────────────────────────────────
export async function changeMemberRoleAction(userId: string, role: string) {
  const { supabase, orgId, userId: me } = await manageCtx();
  if (userId === me) return { error: "You cannot change your own role" };
  const { error } = await supabase.from("organisation_members").update({ role }).eq("organisation_id", orgId).eq("user_id", userId);
  if (error) return { error: error.message };
  return ok("/app/settings/team");
}

export async function removeMemberAction(userId: string) {
  const { supabase, orgId, userId: me } = await manageCtx();
  if (userId === me) return { error: "You cannot remove yourself" };
  const { error } = await supabase.from("organisation_members").delete().eq("organisation_id", orgId).eq("user_id", userId);
  if (error) return { error: error.message };
  return ok("/app/settings/team");
}
