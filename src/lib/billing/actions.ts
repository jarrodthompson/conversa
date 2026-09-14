"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/roles";
import { peachConfigured, createCheckout } from "@/lib/billing/peach";
import { changePlanAction } from "@/lib/settings/actions";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function manageCtx() {
  const c = await getAppContext();
  if (!can(c.role, "settings.manage")) throw new Error("Not authorised to manage billing");
  const supabase = await createClient();
  return { c, supabase, orgId: c.org.id };
}

/** Whether live Peach checkout is available (credentials set). */
export async function billingConfigured(): Promise<boolean> {
  return peachConfigured();
}

/**
 * Starts a plan purchase. With Peach configured, creates a Hosted Checkout and
 * returns the redirect URL; otherwise falls back to the DB-only plan switch so
 * the app still works without a payment provider.
 */
export async function startCheckoutAction(planId: string) {
  const { supabase, orgId } = await manageCtx();

  if (!peachConfigured()) {
    const res = await changePlanAction(planId);
    return res?.error ? res : { ok: true, demo: true as const };
  }

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("key, name, price_monthly, currency")
    .eq("id", planId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = plan as any;
  if (!p) return { error: "Plan not found" };
  if (!p.price_monthly || p.price_monthly <= 0) return { error: `The ${p.name} plan has no price to charge` };

  const amount = (p.price_monthly / 100).toFixed(2);
  const currency = (p.currency ?? "ZAR").toUpperCase();
  // 8-16 char merchant reference.
  const merchantTransactionId = `sub${crypto.randomBytes(6).toString("hex")}`.slice(0, 16);

  try {
    const { checkoutId, redirectUrl } = await createCheckout({
      amount,
      currency,
      merchantTransactionId,
      shopperResultUrl: `${appUrl}/api/billing/return`,
      notificationUrl: `${appUrl}/api/webhooks/peach`,
    });

    // Remember which plan this checkout will activate (applied by the webhook).
    await supabase
      .from("organisation_subscriptions")
      .upsert(
        { organisation_id: orgId, peach_checkout_id: checkoutId, peach_pending_plan_id: planId },
        { onConflict: "organisation_id" },
      );

    return { ok: true, url: redirectUrl };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not start checkout" };
  }
}

/** Cancels auto-renewal / marks the subscription cancelled (no further charges). */
export async function cancelSubscriptionAction() {
  const { supabase, orgId } = await manageCtx();
  const { error } = await supabase
    .from("organisation_subscriptions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("organisation_id", orgId);
  if (error) return { error: error.message };
  revalidatePath("/app/settings/billing");
  return { ok: true };
}
