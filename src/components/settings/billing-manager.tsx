"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { changePlanAction } from "@/lib/settings/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Plan { id: string; key: string; name: string; price_monthly: number; seats: number | null }

export function BillingManager({ plans, currentPlanId, canManage }: { plans: Plan[]; currentPlanId: string | null; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function switchTo(id: string) {
    start(async () => {
      const res = await changePlanAction(id);
      if (res?.error) toast.error(res.error);
      else { toast.success("Plan updated (demo)"); router.refresh(); }
    });
  }

  const price = (p: Plan) => p.key === "enterprise" ? "Custom" : p.price_monthly === 0 ? "Free" : `$${(p.price_monthly / 100).toFixed(0)}/mo`;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {plans.map((p) => {
        const current = p.id === currentPlanId;
        return (
          <div key={p.id} className={cn("rounded-[12px] border bg-card p-5 shadow-sm", current ? "border-primary ring-1 ring-primary" : "border-border")}>
            {current && <Badge variant="primary" className="mb-2">Current plan</Badge>}
            <h3 className="font-semibold">{p.name}</h3>
            <p className="mt-1 text-2xl font-bold">{price(p)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{p.seats ? `${p.seats} seats` : "Custom seats"}</p>
            {canManage && (
              current ? (
                <Button variant="outline" size="sm" className="mt-4 w-full" disabled><Check className="size-4" /> Active</Button>
              ) : (
                <Button variant="outline" size="sm" className="mt-4 w-full" disabled={pending} onClick={() => switchTo(p.id)}>Switch</Button>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
