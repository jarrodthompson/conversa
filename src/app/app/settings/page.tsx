import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";

interface Member {
  role: string;
  user_id: string;
  profile: { full_name: string | null; avatar_url: string | null } | null;
}

export default async function SettingsPage() {
  const { org, role } = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("organisation_members")
    .select("role, user_id, profile:user_profiles(full_name, avatar_url)")
    .eq("organisation_id", org.id)
    .eq("status", "active");
  const members = (data ?? []) as unknown as Member[];

  return (
    <div className="h-full overflow-y-auto p-6">
      <PageHeader title="Settings" description="Manage your organisation, team and roles." />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Organisation</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Name" value={org.name} />
            <Field label="Workspace URL" value={`conversa.app/${org.slug}`} />
            <Field label="Your role" value={ROLE_LABELS[role as Role] ?? role} />
            <p className="pt-2 text-xs text-muted-foreground">Branding, timezone and data-retention controls live here in the full settings build-out.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Team & roles ({members.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-3">
                <Avatar name={m.profile?.full_name} src={m.profile?.avatar_url} size={32} />
                <span className="flex-1 truncate text-sm font-medium">{m.profile?.full_name ?? "Member"}</span>
                <Badge variant="outline">{ROLE_LABELS[m.role as Role] ?? m.role}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
