import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { PageHeader } from "@/components/app/page-header";
import { TeamManager } from "@/components/settings/team-manager";
import { InviteManager } from "@/components/settings/invite-manager";

interface MemberRow {
  user_id: string; role: string;
  profile: { full_name: string | null; avatar_url: string | null } | { full_name: string | null; avatar_url: string | null }[] | null;
}

export default async function TeamSettingsPage() {
  const { org, role, userId } = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("organisation_members")
    .select("user_id, role, profile:user_profiles(full_name, avatar_url)")
    .eq("organisation_id", org.id)
    .eq("status", "active");

  const members = ((data ?? []) as unknown as MemberRow[]).map((m) => {
    const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
    return { user_id: m.user_id, role: m.role, full_name: p?.full_name ?? null, avatar_url: p?.avatar_url ?? null };
  });

  const canManage = can(role, "settings.manage");
  const { data: inviteRows } = await supabase
    .from("organisation_invitations")
    .select("id, email, role, expires_at")
    .eq("organisation_id", org.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  const invites = (inviteRows ?? []) as unknown as { id: string; email: string; role: string; expires_at: string }[];

  return (
    <div className="p-6">
      <PageHeader title="Team & Roles" description="Manage who has access and what they can do." />
      <div className="mt-6 max-w-2xl space-y-6">
        <InviteManager invites={invites} canManage={canManage} />
        <TeamManager members={members} canManage={canManage} meId={userId} />
        {!canManage && (
          <p className="mt-3 text-xs text-muted-foreground">Only owners and administrators can invite people or change roles.</p>
        )}
      </div>
    </div>
  );
}
