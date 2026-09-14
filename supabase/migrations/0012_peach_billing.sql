-- ─────────────────────────────────────────────────────────────────────────────
-- Peach Payments billing: track the in-flight checkout and the plan it will
-- activate on a successful payment webhook. Nullable so the app runs without a
-- payment provider (DB-only plan switching).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.organisation_subscriptions
  add column if not exists peach_checkout_id text,
  add column if not exists peach_pending_plan_id uuid references public.subscription_plans(id) on delete set null;

create index if not exists idx_org_subs_peach_checkout
  on public.organisation_subscriptions(peach_checkout_id);
