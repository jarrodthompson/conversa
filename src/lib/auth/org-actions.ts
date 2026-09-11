"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ORG_COOKIE } from "@/lib/auth/context";

/** Switches the active organisation for authorised (member) users. */
export async function switchOrgAction(organisationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify membership before trusting the client-supplied org id.
  const { data: membership } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user.id)
    .eq("organisation_id", organisationId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) return { error: "You are not a member of that organisation" };

  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE, organisationId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/app", "layout");
  return { ok: true };
}
