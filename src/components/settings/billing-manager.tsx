"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, XCircle } from "lucide-react";
import { startCheckoutAction, cancelSubscriptionAction } from "@/lib/billing/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Plan { id: string; key: string; name: string; price_monthly: number; currency?: string | null; seats: number | null }

export function BillingManager({
  plans,
  currentPlanId,
  canManage,
  paymentsConfigured,
  canCancel,
}: {
  plans: Plan[];
  currentPlanId: string | null;
  canManage: boolean;
  paymentsConfigured: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function choose(id: string) {
    start(async () => {
      const res = (await startCheckoutAction(id)) as { error?: string; url?: string | null };
      if (res?.error) { toast.error(res.error); return; }
      if (res.url) { window.location.href = res.url; return; } // to Peach Hosted Checkout
      toast.success("Plan updated");
      router.refresh();
    });
  }

  function cancel() {
    start(async () => {
      const res = await cancelSubscriptionAction();
      if (res?.error) { toast.error(res.error); return; }
      toast.success("Subscription cancelled");
      router.refresh();
    });
  }

  const price = (p: Plan) => {
    if (p.key === "enterprise") return "Custom";
    if (p.price_monthly === 0) return "Free";
    const cur = (p.currency ?? "ZAR").toUpperCase();
    const symbol = cur === "ZAR" ? "R" : cur === "USD" ? "$" : `${cur} `;
    return `${symbol}${(p.price_monthly / 100).toFixed(0)}/mo`;
  };

  return (
    <div className="space-y-4">
      {canManage && canCancel && (
        <Button variant="outline" size="sm" onClick={cancel} disabled={pending}>
          <XCircle className="size-4" /> Cancel subscription
        </Button>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => {
          const current = p.id === currentPlanId;
          const isEnterprise = p.key === "enterprise";
          return (
            <div key={p.id} className={cn("rounded-[12px] border bg-card p-5 shadow-sm", current ? "border-primary ring-1 ring-primary" : "border-border")}>
              {current && <Badge variant="primary" className="mb-2">Current plan</Badge>}
              <h3 className="font-semibold">{p.name}</h3>
              <p className="mt-1 text-2xl font-bold">{price(p)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{p.seats ? `${p.seats} seats` : "Custom seats"}</p>
              {canManage && (
                current ? (
                  <Button variant="outline" size="sm" className="mt-4 w-full" disabled><Check className="size-4" /> Active</Button>
                ) : isEnterprise ? (
                  <a href="mailto:hello@conversa.app?subject=Enterprise%20plan"><Button variant="outline" size="sm" className="mt-4 w-full">Contact sales</Button></a>
                ) : (
                  <Button size="sm" className="mt-4 w-full" disabled={pending} onClick={() => choose(p.id)}>
                    {paymentsConfigured ? "Choose plan" : "Switch"}
                  </Button>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
