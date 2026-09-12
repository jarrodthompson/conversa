import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { PageHeader } from "@/components/app/page-header";
import { TagManager } from "@/components/settings/tag-manager";

export default async function TagsSettingsPage() {
  const { org, role } = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase.from("tags").select("id, name, color").eq("organisation_id", org.id).order("name");
  return (
    <div className="p-6">
      <PageHeader title="Tags" description="Labels for organising conversations and contacts." />
      <div className="mt-6 max-w-3xl">
        <TagManager tags={(data ?? []) as { id: string; name: string; color: string }[]} canManage={can(role, "settings.manage")} />
      </div>
    </div>
  );
}
