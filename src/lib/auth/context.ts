import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const ORG_COOKIE = "conversa_org";

export interface Membership {
  organisation_id: string;
  role: string;
  is_default: boolean;
  organisation: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    onboarding_step: number;
    onboarded_at: string | null;
  };
}

export interface AppContext {
  userId: string;
  email: string;
  profile: { full_name: string | null; avatar_url: string | null } | null;
  memberships: Membership[];
  org: Membership["organisation"];
  role: string;
}

/** Returns the signed-in user or redirects to /login. Cached per request. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
});

/**
 * Resolves the full app context (user, memberships, current org) for the
 * authenticated area. Redirects to /login when signed out and to /onboarding
 * when the user has no organisation yet.
 */
export const getAppContext = cache(async (): Promise<AppContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const { data: memberRows } = await supabase
    .from("organisation_members")
    .select(
      "organisation_id, role, is_default, organisation:organisations(id, name, slug, logo_url, onboarding_step, onboarded_at)",
    )
    .eq("user_id", user.id)
    .eq("status", "active");

  const memberships = (memberRows ?? []) as unknown as Membership[];

  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const cookieStore = await cookies();
  const preferred = cookieStore.get(ORG_COOKIE)?.value;
  const active =
    memberships.find((m) => m.organisation_id === preferred) ??
    memberships.find((m) => m.is_default) ??
    memberships[0];

  return {
    userId: user.id,
    email: user.email ?? "",
    profile: profile as AppContext["profile"],
    memberships,
    org: active.organisation,
    role: active.role,
  };
});
