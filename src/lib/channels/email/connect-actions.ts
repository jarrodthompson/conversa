"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/roles";
import { sendEmail } from "@/lib/channels/email/send";
import type { Json } from "@/lib/supabase/types";

const asJson = (v: unknown): Json => v as Json;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function manageCtx() {
  const c = await getAppContext();
  if (!can(c.role, "settings.manage")) throw new Error("Not authorised to manage integrations");
  const supabase = await createClient();
  return { supabase, orgId: c.org.id, userId: c.userId };
}

/** True when a Resend API key is present on the server. The key itself is never exposed to the browser. */
export async function emailProviderConfigured(): Promise<boolean> {
  return Boolean(process.env.RESEND_API_KEY);
}

async function ensureEmailChannel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string,
  displayName: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("channels")
    .select("id")
    .eq("organisation_id", orgId)
    .eq("type", "email")
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) return existing.id as string;

  // Fall back to the default inbox (or any inbox) so the channel is routable.
  const { data: inbox } = await supabase
    .from("inboxes")
    .select("id")
    .eq("organisation_id", orgId)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("channels")
    .insert({ organisation_id: orgId, inbox_id: inbox?.id ?? null, type: "email", name: displayName, is_demo: true })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created!.id as string;
}

export interface EmailConnectPayload {
  senderName: string;
  fromAddress: string;
  inboundAddress: string;
  replyTo: string;
}

/**
 * Marks the org's email channel as live. The Resend API key stays in a server env
 * var (never stored here); this records the non-secret routing config and flips the
 * channel from the simulated adapter to a connected state.
 */
export async function connectEmailAction(payload: EmailConnectPayload) {
  const { supabase, orgId } = await manageCtx();

  const fromAddress = payload.fromAddress.trim().toLowerCase();
  const inboundAddress = payload.inboundAddress.trim().toLowerCase();
  const replyTo = payload.replyTo.trim().toLowerCase();
  const senderName = payload.senderName.trim();

  if (!EMAIL_RE.test(fromAddress)) return { error: "Enter a valid From address" };
  if (!EMAIL_RE.test(inboundAddress)) return { error: "Enter a valid inbound address" };
  if (replyTo && !EMAIL_RE.test(replyTo)) return { error: "Reply-to must be a valid email address" };

  if (!process.env.RESEND_API_KEY) {
    return { error: "No Resend API key is configured on the server. Add RESEND_API_KEY, then reconnect." };
  }

  const channelId = await ensureEmailChannel(supabase, orgId, fromAddress);

  const config = {
    provider: "resend",
    sender_name: senderName || null,
    from_address: fromAddress,
    inbound_address: inboundAddress,
    reply_to: replyTo || null,
  };

  const { error: connErr } = await supabase.from("channel_connections").upsert(
    {
      organisation_id: orgId,
      channel_id: channelId,
      status: "connected",
      config: asJson(config),
      last_verified_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "channel_id" },
  );
  if (connErr) return { error: connErr.message };

  const { error: chanErr } = await supabase
    .from("channels")
    .update({ name: fromAddress, is_demo: false })
    .eq("id", channelId)
    .eq("organisation_id", orgId);
  if (chanErr) return { error: chanErr.message };

  revalidatePath("/app/integrations");
  revalidatePath("/app/integrations/email");
  return { ok: true };
}

export async function disconnectEmailAction() {
  const { supabase, orgId } = await manageCtx();
  const { data: channel } = await supabase
    .from("channels")
    .select("id")
    .eq("organisation_id", orgId)
    .eq("type", "email")
    .is("deleted_at", null)
    .maybeSingle();
  if (!channel) return { error: "No email channel to disconnect" };
  const channelId = channel.id as string;

  await supabase.from("channels").update({ is_demo: true }).eq("id", channelId).eq("organisation_id", orgId);
  const { error } = await supabase
    .from("channel_connections")
    .update({ status: "demo", last_error: null })
    .eq("channel_id", channelId)
    .eq("organisation_id", orgId);
  if (error) return { error: error.message };

  revalidatePath("/app/integrations");
  revalidatePath("/app/integrations/email");
  return { ok: true };
}

/**
 * Sends a real test email through Resend using the saved (or supplied) From address.
 * Reports honestly whether a live send happened or the provider is not configured.
 */
export async function sendTestEmailAction(to: string, fromOverride?: string) {
  const { supabase, orgId } = await manageCtx();
  const recipient = to.trim().toLowerCase();
  if (!EMAIL_RE.test(recipient)) return { error: "Enter a valid recipient address" };

  const { data: channel } = await supabase
    .from("channels")
    .select("id, connection:channel_connections(config)")
    .eq("organisation_id", orgId)
    .eq("type", "email")
    .is("deleted_at", null)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = (Array.isArray((channel as any)?.connection) ? (channel as any).connection[0] : (channel as any)?.connection)?.config ?? {};
  const from = (fromOverride?.trim() || cfg.from_address || process.env.EMAIL_FROM || "").toLowerCase();
  if (!EMAIL_RE.test(from)) return { error: "Set a valid From address before sending a test" };

  try {
    const res = await sendEmail({
      apiKey: process.env.RESEND_API_KEY,
      from: cfg.sender_name ? `${cfg.sender_name} <${from}>` : from,
      to: recipient,
      subject: "Conversa test email",
      text: "This is a live test email from your Conversa workspace. If you received it, outbound email is working.",
      replyTo: cfg.reply_to || cfg.inbound_address || undefined,
    });
    if (res.demo) {
      return { ok: true, simulated: true as const, message: "No Resend key configured — send was simulated, not delivered." };
    }
    return { ok: true, simulated: false as const, message: `Sent — Resend id ${res.externalId}`, id: res.externalId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from("integration_logs").insert({
      organisation_id: orgId,
      level: "error",
      message: "Email test send failed",
      context: asJson({ error: msg }),
    });
    return { error: `Send failed: ${msg}` };
  }
}
