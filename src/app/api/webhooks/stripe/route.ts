import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, stripeConfigured } from "@/lib/billing/stripe";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ ok: true, endpoint: "stripe-webhook" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

async function planIdForPrice(admin: DB, priceId: string | undefined): Promise<string | null> {
  if (!priceId) return null;
  const { data } = await admin.from("subscription_plans").select("id").eq("stripe_price_id", priceId).maybeSingle();
  return data?.id ?? null;
}

async function syncSubscription(admin: DB, sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const orgId = (sub.metadata?.organisation_id as string) || null;
  const priceId = sub.items?.data?.[0]?.price?.id;
  const planId = await planIdForPrice(admin, priceId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periodEnd = (sub as any).current_period_end
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? new Date((sub as any).current_period_end * 1000).toISOString()
    : null;
  const quantity = sub.items?.data?.[0]?.quantity ?? undefined;

  const patch: Record<string, unknown> = {
    status: sub.status,
    stripe_subscription_id: sub.id,
    current_period_end: periodEnd,
    updated_at: new Date().toISOString(),
  };
  if (planId) patch.plan_id = planId;
  if (quantity) patch.seats = quantity;

  // Prefer org from metadata; otherwise match by the Stripe customer id.
  if (orgId) {
    await admin
      .from("organisation_subscriptions")
      .upsert({ organisation_id: orgId, stripe_customer_id: customerId, ...patch }, { onConflict: "organisation_id" });
  } else {
    await admin.from("organisation_subscriptions").update(patch).eq("stripe_customer_id", customerId);
  }
}

/** Stripe webhook — verifies the signature, then syncs subscription state. */
export async function POST(request: NextRequest) {
  if (!stripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new NextResponse("Stripe not configured", { status: 503 });
  }

  const raw = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new NextResponse(`Invalid signature: ${err instanceof Error ? err.message : ""}`, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const sub = await getStripe().subscriptions.retrieve(subId);
          if (!sub.metadata?.organisation_id && session.metadata?.organisation_id) {
            sub.metadata = { ...sub.metadata, organisation_id: session.metadata.organisation_id };
          }
          await syncSubscription(admin, sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(admin, event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe webhook] error", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
