import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { PageHeader } from "@/components/app/page-header";
import { BusinessHoursManager } from "@/components/settings/business-hours-manager";

export default async function BusinessHoursSettingsPage() {
  const { org, role } = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_hours")
    .select("id, name, timezone, schedule")
    .eq("organisation_id", org.id)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  const record = {
    id: d?.id ?? null,
    name: d?.name ?? "Office Hours",
    timezone: d?.timezone ?? "UTC",
    schedule: (d?.schedule ?? {}) as Record<string, [string, string][]>,
  };

  return (
    <div className="p-6">
      <PageHeader title="Business Hours" description="When your team is available. Used for SLA calculations and business-hours automation." />
      <div className="mt-6">
        <BusinessHoursManager record={record} canManage={can(role, "settings.manage")} />
      </div>
    </div>
  );
}
