-- ─────────────────────────────────────────────────────────────────────────────
-- Stripe billing: link plans to Stripe prices and subscriptions to Stripe objects.
-- Columns are nullable so the app runs without Stripe (DB-only plan switching).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.subscription_plans
  add column if not exists stripe_price_id text;

alter table public.organisation_subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

create index if not exists idx_org_subs_stripe_customer
  on public.organisation_subscriptions(stripe_customer_id);
