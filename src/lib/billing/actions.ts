"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/roles";
import { stripeConfigured, getStripe } from "@/lib/billing/stripe";
import { changePlanAction } from "@/lib/settings/actions";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function manageCtx() {
  const c = await getAppContext();
  if (!can(c.role, "settings.manage")) throw new Error("Not authorised to manage billing");
  const supabase = await createClient();
  return { c, supabase, orgId: c.org.id };
}

/** Whether live Stripe checkout is available (keys set). */
export async function billingConfigured(): Promise<boolean> {
  return stripeConfigured();
}

/**
 * Starts a subscription. With Stripe configured, returns a Checkout URL to
 * redirect to; otherwise falls back to the DB-only plan switch so the app still
 * works without a payment provider.
 */
export async function startCheckoutAction(planId: string) {
  const { c, supabase, orgId } = await manageCtx();

  if (!stripeConfigured()) {
    const res = await changePlanAction(planId);
    return res?.error ? res : { ok: true, demo: true as const };
  }

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("key, name, stripe_price_id")
    .eq("id", planId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = plan as any;
  if (!p) return { error: "Plan not found" };
  if (!p.stripe_price_id) return { error: `No Stripe price configured for the ${p.name} plan` };

  const { data: sub } = await supabase
    .from("organisation_subscriptions")
    .select("stripe_customer_id")
    .eq("organisation_id", orgId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let customerId = (sub as any)?.stripe_customer_id as string | undefined;

  const stripe = getStripe();
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: c.email,
      name: c.org.name,
      metadata: { organisation_id: orgId },
    });
    customerId = customer.id;
    await supabase
      .from("organisation_subscriptions")
      .upsert({ organisation_id: orgId, stripe_customer_id: customerId }, { onConflict: "organisation_id" });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: p.stripe_price_id, quantity: 1 }],
    success_url: `${appUrl}/app/settings/billing?checkout=success`,
    cancel_url: `${appUrl}/app/settings/billing?checkout=cancelled`,
    allow_promotion_codes: true,
    metadata: { organisation_id: orgId, plan_id: planId },
    subscription_data: { metadata: { organisation_id: orgId, plan_id: planId } },
  });

  return { ok: true, url: session.url };
}

/** Opens the Stripe customer portal for managing/cancelling the subscription. */
export async function openPortalAction() {
  const { supabase, orgId } = await manageCtx();
  if (!stripeConfigured()) return { error: "Billing portal is not available (Stripe not configured)" };

  const { data: sub } = await supabase
    .from("organisation_subscriptions")
    .select("stripe_customer_id")
    .eq("organisation_id", orgId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerId = (sub as any)?.stripe_customer_id as string | undefined;
  if (!customerId) return { error: "No billing account yet — choose a plan first" };

  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/app/settings/billing`,
  });
  revalidatePath("/app/settings/billing");
  return { ok: true, url: session.url };
}
