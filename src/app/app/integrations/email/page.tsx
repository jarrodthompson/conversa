import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { PageHeader } from "@/components/app/page-header";
import { EmailConnectForm } from "@/components/integrations/email-connect-form";
import { emailProviderConfigured } from "@/lib/channels/email/connect-actions";

export default async function EmailIntegrationPage() {
  const { org, role, email } = await getAppContext();
  const supabase = await createClient();

  const { data: channel } = await supabase
    .from("channels")
    .select("id, is_demo, connection:channel_connections(status, config)")
    .eq("organisation_id", org.id)
    .eq("type", "email")
    .is("deleted_at", null)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conn = (Array.isArray((channel as any)?.connection) ? (channel as any).connection[0] : (channel as any)?.connection) ?? null;
  const config = (conn?.config ?? {}) as { sender_name?: string | null; from_address?: string | null; inbound_address?: string | null; reply_to?: string | null };
  const connected = conn?.status === "connected";

  const providerConfigured = await emailProviderConfigured();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const webhookUrl = `${appUrl}/api/webhooks/email`;

  return (
    <div className="h-full overflow-y-auto p-6">
      <Link href="/app/integrations" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" /> Integrations
      </Link>
      <PageHeader title="Email" description="Send and receive email through Resend, routed into your shared inbox." />
      <div className="mt-6">
        <EmailConnectForm
          connected={connected}
          providerConfigured={providerConfigured}
          config={config}
          canManage={can(role, "settings.manage")}
          defaultTestTo={email}
          webhookUrl={webhookUrl}
        />
      </div>
    </div>
  );
}
