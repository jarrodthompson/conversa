"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ORG_COOKIE } from "@/lib/auth/context";

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "workspace";
}

export type OnboardingState = { error?: string } | undefined;

/** Creates an organisation, makes the current user its owner, and seeds defaults. */
export async function createOrganisationAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const name = String(formData.get("name") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim() || null;
  if (name.length < 2) return { error: "Enter an organisation name" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Unique-ish slug.
  const base = slugify(name);
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: org, error: orgErr } = await supabase
    .from("organisations")
    .insert({ name, slug, industry, created_by: user.id, onboarding_step: 1 })
    .select()
    .single();
  if (orgErr || !org) return { error: orgErr?.message ?? "Could not create organisation" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (org as any).id as string;

  const { error: memberErr } = await supabase.from("organisation_members").insert({
    organisation_id: orgId,
    user_id: user.id,
    role: "owner",
    is_default: true,
    status: "active",
    accepted_at: new Date().toISOString(),
  });
  if (memberErr) return { error: memberErr.message };

  // Seed a default team + inbox so the workspace isn't empty.
  const { data: team } = await supabase
    .from("teams")
    .insert({ organisation_id: orgId, name: "Support", routing_strategy: "round_robin" })
    .select()
    .single();
  await supabase.from("inboxes").insert({
    organisation_id: orgId,
    name: "General Support",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    team_id: (team as any)?.id ?? null,
    is_default: true,
  });

  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE, orgId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });

  redirect("/app/inbox");
}
