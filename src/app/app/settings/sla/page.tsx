import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { PageHeader } from "@/components/app/page-header";
import { SlaManager } from "@/components/settings/sla-manager";

export default async function SlaSettingsPage() {
  const { org, role } = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase.from("sla_policies").select("id, name, first_response_minutes, resolution_minutes, priority").eq("organisation_id", org.id).order("name");
  return (
    <div className="p-6">
      <PageHeader title="SLA Policies" description="Targets for first response and resolution times." />
      <div className="mt-6 max-w-4xl">
        <SlaManager policies={(data ?? []) as never[]} canManage={can(role, "settings.manage")} />
      </div>
    </div>
  );
}
