"use server";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppContext, ORG_COOKIE } from "@/lib/auth/context";
import { can, ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { sendEmail } from "@/lib/channels/email/send";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITABLE_ROLES: Role[] = ["org_admin", "support_manager", "support_agent", "marketing", "reporting"];
const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Conversa";

async function manageCtx() {
  const ctx = await getAppContext();
  if (!can(ctx.role, "settings.manage")) throw new Error("Not authorised to manage the team");
  const supabase = await createClient();
  return { ctx, supabase, orgId: ctx.org.id, userId: ctx.userId };
}

function inviteEmail(orgName: string, inviter: string, roleLabel: string, link: string) {
  const text = [
    `${inviter} has invited you to join ${orgName} on ${appName} as ${roleLabel}.`,
    ``,
    `Accept your invitation:`,
    link,
    ``,
    `This link expires in 7 days. If you weren't expecting this, you can ignore this email.`,
  ].join("\n");

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:8px">
    <h2 style="color:#0B2A3A;margin:0 0 4px">Join ${escapeHtml(orgName)} on ${escapeHtml(appName)}</h2>
    <p style="color:#334;line-height:1.5">
      <strong>${escapeHtml(inviter)}</strong> has invited you to collaborate as
      <strong>${escapeHtml(roleLabel)}</strong>.
    </p>
    <p style="margin:24px 0">
      <a href="${link}" style="background:#0891B2;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600;display:inline-block">Accept invitation</a>
    </p>
    <p style="color:#678;font-size:13px;line-height:1.5">
      Or paste this link into your browser:<br><span style="color:#0891B2;word-break:break-all">${link}</span>
    </p>
    <p style="color:#9aa;font-size:12px;margin-top:24px">This invitation expires in 7 days. If you weren't expecting it, you can ignore this email.</p>
  </div>`;
  return { text, html };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function sendInviteEmail(to: string, orgName: string, inviter: string, role: string, token: string) {
  const link = `${appUrl}/invite/${token}`;
  const roleLabel = ROLE_LABELS[role as Role] ?? role;
  const { text, html } = inviteEmail(orgName, inviter, roleLabel, link);
  return sendEmail({
    apiKey: process.env.RESEND_API_KEY,
    from: `${appName} <${process.env.EMAIL_FROM ?? "onboarding@resend.dev"}>`,
    to,
    subject: `You're invited to join ${orgName} on ${appName}`,
    text,
    html,
  });
}

export async function inviteMemberAction(email: string, role: string) {
  const { ctx, supabase, orgId, userId } = await manageCtx();
  const clean = email.trim().toLowerCase();
  if (!EMAIL_RE.test(clean)) return { error: "Enter a valid email address" };
  if (!INVITABLE_ROLES.includes(role as Role)) return { error: "Choose a valid role" };
  if (clean === ctx.email.toLowerCase()) return { error: "That's your own email" };

  const token = crypto.randomBytes(24).toString("base64url");

  const { error } = await supabase.from("organisation_invitations").insert({
    organisation_id: orgId,
    email: clean,
    role,
    token,
    invited_by: userId,
  });
  if (error) {
    if (error.code === "23505") return { error: "There's already a pending invite for that email" };
    return { error: error.message };
  }

  const inviter = ctx.profile?.full_name || ctx.email;
  const res = await sendInviteEmail(clean, ctx.org.name, inviter, role, token);

  revalidatePath("/app/settings/team");
  if (res.demo) {
    return { ok: true, warning: "Invite created, but no email provider is configured so no email was sent." };
  }
  return { ok: true };
}

export async function revokeInviteAction(id: string) {
  const { supabase, orgId } = await manageCtx();
  const { error } = await supabase
    .from("organisation_invitations")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organisation_id", orgId)
    .eq("status", "pending");
  if (error) return { error: error.message };
  revalidatePath("/app/settings/team");
  return { ok: true };
}

export async function resendInviteAction(id: string) {
  const { ctx, supabase, orgId } = await manageCtx();
  const { data: inv } = await supabase
    .from("organisation_invitations")
    .select("email, role, token, status")
    .eq("id", id)
    .eq("organisation_id", orgId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const i = inv as any;
  if (!i || i.status !== "pending") return { error: "That invite is no longer pending" };

  await supabase
    .from("organisation_invitations")
    .update({ expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organisation_id", orgId);

  const inviter = ctx.profile?.full_name || ctx.email;
  const res = await sendInviteEmail(i.email, ctx.org.name, inviter, i.role, i.token);
  if (res.demo) return { ok: true, warning: "No email provider configured — email not sent." };
  return { ok: true };
}

/**
 * Accepts an invitation for the currently signed-in user. Runs with the
 * service-role client because the invitee is not yet an org member. Verifies the
 * signed-in user's email matches the invited address before granting access.
 */
export async function acceptInviteAction(token: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in to accept this invitation" };

  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("organisation_invitations")
    .select("id, organisation_id, email, role, status, expires_at")
    .eq("token", token)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const i = inv as any;
  if (!i) return { error: "Invitation not found" };
  if (i.status === "revoked") return { error: "This invitation was revoked" };
  if (i.status === "accepted") return { error: "This invitation has already been used" };
  if (new Date(i.expires_at).getTime() < Date.now()) return { error: "This invitation has expired" };

  if ((user.email ?? "").toLowerCase() !== String(i.email).toLowerCase()) {
    return { error: `This invitation is for ${i.email}. You're signed in as ${user.email}. Sign out and use the invited address.` };
  }

  // Ensure a profile row exists (nice display name in the team list).
  await admin.from("user_profiles").upsert(
    { id: user.id, full_name: (user.user_metadata?.full_name as string) ?? null },
    { onConflict: "id", ignoreDuplicates: true },
  );

  // Already a member? Mark the invite used and continue.
  const { data: existing } = await admin
    .from("organisation_members")
    .select("id, status")
    .eq("organisation_id", i.organisation_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { count } = await admin
      .from("organisation_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active");
    const isFirst = (count ?? 0) === 0;

    const { error: memberErr } = await admin.from("organisation_members").insert({
      organisation_id: i.organisation_id,
      user_id: user.id,
      role: i.role,
      status: "active",
      is_default: isFirst,
      invited_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
    });
    if (memberErr) return { error: memberErr.message };
  }

  await admin
    .from("organisation_invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", i.id);

  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE, i.organisation_id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });

  revalidatePath("/app", "layout");
  return { ok: true };
}
