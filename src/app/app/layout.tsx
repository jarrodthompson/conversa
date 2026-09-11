import { getAppContext } from "@/lib/auth/context";
import { PrimarySidebar } from "@/components/app/primary-sidebar";
import { Topbar } from "@/components/app/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAppContext();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <PrimarySidebar role={ctx.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          orgName={ctx.org.name}
          orgId={ctx.org.id}
          memberships={ctx.memberships}
          userName={ctx.profile?.full_name || ctx.email}
          userEmail={ctx.email}
          avatarUrl={ctx.profile?.avatar_url ?? null}
          role={ctx.role}
        />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
