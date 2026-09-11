import { getAppContext } from "@/lib/auth/context";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";

export default async function ProfilePage() {
  const { profile, email, role } = await getAppContext();
  return (
    <div className="h-full overflow-y-auto p-6">
      <PageHeader title="My Profile" description="Your personal account details." />
      <Card className="mt-6 max-w-lg">
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar name={profile?.full_name || email} src={profile?.avatar_url} size={56} />
            <div>
              <p className="font-semibold">{profile?.full_name || "—"}</p>
              <p className="text-sm text-muted-foreground">{email}</p>
              <Badge variant="outline" className="mt-1">{ROLE_LABELS[role as Role] ?? role}</Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Editing your name, avatar and enabling multi-factor authentication are part of the profile build-out.</p>
        </CardContent>
      </Card>
    </div>
  );
}
