import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BillingManager } from "@/components/settings/billing-manager";
import { stripeConfigured } from "@/lib/billing/stripe";

export default async function BillingSettingsPage() {
  const { org, role } = await getAppContext();
  const supabase = await createClient();
  const [{ data: plans }, { data: sub }] = await Promise.all([
    supabase.from("subscription_plans").select("id, key, name, price_monthly, seats").eq("is_active", true).order("price_monthly"),
    supabase.from("organisation_subscriptions").select("plan_id, status, seats, current_period_end, stripe_customer_id").eq("organisation_id", org.id).maybeSingle(),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = sub as any;
  const stripeLive = stripeConfigured();

  return (
    <div className="p-6">
      <PageHeader title="Billing" description="Manage your plan and seats." />

      {!stripeLive && (
        <div className="mt-4 flex items-center gap-2 rounded-[10px] border border-warning/30 bg-warning/5 px-4 py-2.5 text-sm text-warning">
          Payments aren&apos;t connected yet — switching a plan updates your workspace record only. Add Stripe keys to take real payments.
        </div>
      )}

      {s && (
        <Card className="mt-6 max-w-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={s.status === "active" ? "success" : "muted"}>{s.status}</Badge>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Seats</span><span className="font-medium">{s.seats}</span>
            </div>
            {s.current_period_end && (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Renews</span><span className="font-medium">{new Date(s.current_period_end).toLocaleDateString()}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <h3 className="mt-8 text-sm font-semibold">Plans</h3>
      <div className="mt-3">
        <BillingManager
          plans={(plans ?? []) as never[]}
          currentPlanId={s?.plan_id ?? null}
          canManage={can(role, "settings.manage")}
          stripeConfigured={stripeLive}
          hasSubscription={Boolean(s?.stripe_customer_id)}
        />
      </div>
    </div>
  );
}
