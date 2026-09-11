-- Conversa · 0007 · Broadcasts, templates, consent, SLA, platform tables

-- ─────────────────────────────────────────────────────────────────────────────
-- message_templates  (approved outbound templates, e.g. WhatsApp)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.message_templates (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name            text not null,
  channel_type    channel_type not null,
  category        text,                               -- marketing | utility | authentication
  language        text not null default 'en',
  body            text not null,
  variables       text[] not null default '{}',
  approval_status text not null default 'draft',      -- draft | pending | approved | rejected
  external_id     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_templates_org on public.message_templates(organisation_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- broadcasts & recipients
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.broadcasts (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name            text not null,
  channel_type    channel_type not null,
  template_id     uuid references public.message_templates(id) on delete set null,
  status          broadcast_status not null default 'draft',
  segment         jsonb not null default '{}'::jsonb, -- audience definition
  variables       jsonb not null default '{}'::jsonb, -- default personalisation
  timezone_aware  boolean not null default true,
  scheduled_at    timestamptz,
  frequency_cap   integer,                            -- max msgs per contact / window
  requires_approval boolean not null default true,
  approved_by     uuid references auth.users(id) on delete set null,
  approved_at     timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists idx_broadcasts_org on public.broadcasts(organisation_id, status);

create table if not exists public.broadcast_recipients (
  id            uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  broadcast_id  uuid not null references public.broadcasts(id) on delete cascade,
  contact_id    uuid not null references public.contacts(id) on delete cascade,
  status        recipient_status not null default 'queued',
  variables     jsonb not null default '{}'::jsonb,
  sent_at       timestamptz,
  delivered_at  timestamptz,
  read_at       timestamptz,
  replied_at    timestamptz,
  failed_reason text,
  created_at    timestamptz not null default now(),
  unique (broadcast_id, contact_id)
);
create index if not exists idx_brecipients_broadcast on public.broadcast_recipients(broadcast_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- consent & suppression  (lawful-basis enforcement for outbound)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.consent_records (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  contact_id      uuid not null references public.contacts(id) on delete cascade,
  channel_type    channel_type not null,
  status          consent_status not null,
  basis           text,                     -- explicit | contract | legitimate_interest
  source          text,
  recorded_at     timestamptz not null default now()
);
create index if not exists idx_consent_contact on public.consent_records(contact_id, channel_type);

create table if not exists public.suppression_entries (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  channel_type    channel_type not null,
  identifier      text not null,            -- phone / email
  reason          text,                     -- opt_out | bounce | complaint | manual
  created_at      timestamptz not null default now(),
  unique (organisation_id, channel_type, identifier)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SLA policies & business hours
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.sla_policies (
  id                    uuid primary key default gen_random_uuid(),
  organisation_id       uuid not null references public.organisations(id) on delete cascade,
  name                  text not null,
  first_response_minutes integer not null default 60,
  resolution_minutes    integer not null default 1440,
  priority              conversation_priority,
  business_hours_only   boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Deferred FKs from 0004 now that sla_policies exists.
alter table public.conversations
  drop constraint if exists conversations_sla_fk,
  add constraint conversations_sla_fk foreign key (sla_policy_id) references public.sla_policies(id) on delete set null;
alter table public.tickets
  drop constraint if exists tickets_sla_fk,
  add constraint tickets_sla_fk foreign key (sla_policy_id) references public.sla_policies(id) on delete set null;

create table if not exists public.business_hours (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name            text not null default 'Default',
  timezone        text not null default 'UTC',
  -- {"mon":[["09:00","17:00"]], ...}
  schedule        jsonb not null default '{}'::jsonb,
  holidays        jsonb not null default '[]'::jsonb,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- notifications
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  type            text not null,            -- mention | assignment | sla | broadcast…
  title           text not null,
  body            text,
  link            text,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, read_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- webhooks & integration logs  (with idempotency for inbound events)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.webhook_endpoints (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  channel_id      uuid references public.channels(id) on delete cascade,
  direction       text not null default 'inbound',   -- inbound | outbound
  url             text,                               -- for outbound
  secret          text,
  events          text[] not null default '{}',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  endpoint_id     uuid references public.webhook_endpoints(id) on delete set null,
  channel_type    channel_type,
  -- Idempotency: provider event id must be unique so retries are no-ops.
  idempotency_key text not null,
  payload         jsonb not null,
  signature_valid boolean,
  processed_at    timestamptz,
  status          text not null default 'received',  -- received | processed | failed
  error           text,
  created_at      timestamptz not null default now(),
  unique (idempotency_key)
);
create index if not exists idx_webhook_events_org on public.webhook_events(organisation_id, created_at desc);

create table if not exists public.integration_logs (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  channel_id      uuid references public.channels(id) on delete set null,
  level           text not null default 'info',      -- info | warn | error
  message         text not null,
  context         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_intlogs_org on public.integration_logs(organisation_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- audit_logs  (every sensitive action)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  actor_id        uuid references auth.users(id) on delete set null,
  action          text not null,            -- e.g. 'conversation.assign'
  entity_type     text,
  entity_id       uuid,
  before          jsonb,
  after           jsonb,
  ip_address      text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_audit_org on public.audit_logs(organisation_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- billing foundations
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.subscription_plans (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,       -- starter | growth | business | enterprise
  name          text not null,
  price_monthly integer not null default 0, -- minor units; demo data
  currency      text not null default 'usd',
  seats         integer,
  features      jsonb not null default '{}'::jsonb,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.organisation_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  plan_id         uuid references public.subscription_plans(id) on delete set null,
  status          text not null default 'trialing',  -- trialing | active | past_due | cancelled
  seats           integer not null default 3,
  current_period_end timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organisation_id)
);

create table if not exists public.usage_records (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  metric          text not null,            -- ai_resolutions | messages | seats…
  quantity        integer not null default 0,
  period          date not null default current_date,
  created_at      timestamptz not null default now(),
  unique (organisation_id, metric, period)
);

create trigger trg_templates_updated before update on public.message_templates for each row execute function public.set_updated_at();
create trigger trg_broadcasts_updated before update on public.broadcasts for each row execute function public.set_updated_at();
create trigger trg_sla_updated before update on public.sla_policies for each row execute function public.set_updated_at();
create trigger trg_bizhours_updated before update on public.business_hours for each row execute function public.set_updated_at();
create trigger trg_webhook_ep_updated before update on public.webhook_endpoints for each row execute function public.set_updated_at();
create trigger trg_org_subs_updated before update on public.organisation_subscriptions for each row execute function public.set_updated_at();
