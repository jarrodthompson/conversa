import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { PageHeader } from "@/components/app/page-header";
import { InboxManager } from "@/components/settings/inbox-manager";

export default async function InboxesSettingsPage() {
  const { org, role } = await getAppContext();
  const supabase = await createClient();
  const [{ data: inboxes }, { data: teams }] = await Promise.all([
    supabase.from("inboxes").select("id, name, is_default, team_id").eq("organisation_id", org.id).is("deleted_at", null).order("name"),
    supabase.from("teams").select("id, name").eq("organisation_id", org.id).is("deleted_at", null),
  ]);
  return (
    <div className="p-6">
      <PageHeader title="Inboxes" description="Routing buckets for conversations, usually per team or channel." />
      <div className="mt-6 max-w-3xl">
        <InboxManager
          inboxes={(inboxes ?? []) as { id: string; name: string; is_default: boolean; team_id: string | null }[]}
          teams={(teams ?? []) as { id: string; name: string }[]}
          canManage={can(role, "settings.manage")}
        />
      </div>
    </div>
  );
}
