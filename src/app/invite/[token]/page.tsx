import Link from "next/link";
import { Mail, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LogoWordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { AcceptButton } from "./accept-button";

function isExpired(ts: string) {
  return new Date(ts).getTime() < Date.now();
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4">
      <div className="w-full max-w-md rounded-[16px] border border-border bg-card p-8 shadow-sm">
        <div className="mb-6"><LogoWordmark /></div>
        {children}
      </div>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="mb-3 flex size-11 items-center justify-center rounded-[10px] bg-warning/15 text-warning"><AlertTriangle className="size-5" /></div>
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <div className="mt-6"><Link href="/login"><Button variant="outline">Go to sign in</Button></Link></div>
    </div>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("organisation_invitations")
    .select("email, role, status, expires_at, organisation:organisations(name)")
    .eq("token", token)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const i = inv as any;

  if (!i) return <Shell><Notice title="Invitation not found" body="This invitation link is invalid. Ask your teammate to send a new one." /></Shell>;
  if (i.status === "revoked") return <Shell><Notice title="Invitation revoked" body="This invitation is no longer active. Ask your teammate to send a new one." /></Shell>;
  if (i.status === "accepted") return <Shell><Notice title="Already accepted" body="This invitation has already been used. Try signing in instead." /></Shell>;
  if (isExpired(i.expires_at)) return <Shell><Notice title="Invitation expired" body="This invitation has expired. Ask your teammate to send a new one." /></Shell>;

  const orgName = (Array.isArray(i.organisation) ? i.organisation[0] : i.organisation)?.name ?? "the workspace";
  const roleLabel = ROLE_LABELS[i.role as Role] ?? i.role;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <Shell>
      <div className="mb-3 flex size-11 items-center justify-center rounded-[10px] bg-primary/15 text-primary"><Mail className="size-5" /></div>
      <h1 className="text-xl font-bold tracking-tight">Join {orgName}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You&apos;ve been invited to join <strong>{orgName}</strong> as <strong>{roleLabel}</strong>.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">Invitation for <strong>{i.email}</strong>.</p>

      <div className="mt-6">
        {!user ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Sign in or create your account with <strong>{i.email}</strong> to accept.</p>
            <div className="flex gap-2">
              <Link href={`/register?next=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(i.email)}`} className="flex-1">
                <Button className="w-full">Create account</Button>
              </Link>
              <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="flex-1">
                <Button variant="outline" className="w-full">Sign in</Button>
              </Link>
            </div>
          </div>
        ) : (user.email ?? "").toLowerCase() !== String(i.email).toLowerCase() ? (
          <div className="rounded-[10px] border border-warning/30 bg-warning/10 p-3 text-sm">
            You&apos;re signed in as <strong>{user.email}</strong>, but this invite is for <strong>{i.email}</strong>. Sign out and use the invited address.
          </div>
        ) : (
          <AcceptButton token={token} orgName={orgName} />
        )}
      </div>
    </Shell>
  );
}
