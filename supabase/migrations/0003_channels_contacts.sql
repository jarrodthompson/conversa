-- Conversa · 0003 · Channels, inboxes, contacts

-- ─────────────────────────────────────────────────────────────────────────────
-- inboxes  (a routing bucket, usually per team or per channel)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.inboxes (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name            text not null,
  description     text,
  team_id         uuid references public.teams(id) on delete set null,
  color           text default '#06B6D4',
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists idx_inboxes_org on public.inboxes(organisation_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- channels  (a configured channel of a given type)
-- channel_connections holds provider credentials/state (secrets NOT stored raw)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.channels (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  inbox_id        uuid references public.inboxes(id) on delete set null,
  type            channel_type not null,
  name            text not null,
  is_demo         boolean not null default true,   -- demo/mock adapter vs live
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists idx_channels_org on public.channels(organisation_id);

create table if not exists public.channel_connections (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  channel_id      uuid not null references public.channels(id) on delete cascade,
  status          connection_status not null default 'demo',
  -- Non-secret configuration (phone id, page id, from-address, display name…)
  config          jsonb not null default '{}'::jsonb,
  -- Reference to a secret stored in a vault / env, never the secret itself.
  secret_ref      text,
  webhook_secret  text,                              -- for inbound signature verification
  last_verified_at timestamptz,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (channel_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- contacts  (unified customer profile per organisation)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.contacts (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  first_name      text,
  last_name       text,
  email           citext,
  phone           text,
  whatsapp_number text,
  company         text,
  job_title       text,
  location        text,
  language        text default 'en',
  timezone        text default 'UTC',
  external_id     text,                    -- customer id in an external system
  avatar_url      text,
  owner_id        uuid references auth.users(id) on delete set null,
  consent_status  consent_status not null default 'unknown',
  consent_source  text,
  last_contacted_at timestamptz,
  notes           text,
  is_blocked      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists idx_contacts_org on public.contacts(organisation_id);
create index if not exists idx_contacts_email on public.contacts(organisation_id, email);
create index if not exists idx_contacts_phone on public.contacts(organisation_id, phone);
create index if not exists idx_contacts_name_trgm on public.contacts using gin ((coalesce(first_name,'') || ' ' || coalesce(last_name,'')) gin_trgm_ops);

-- Per-channel identity for a contact (a WhatsApp number, an email, a web visitor id…)
create table if not exists public.contact_channels (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  contact_id      uuid not null references public.contacts(id) on delete cascade,
  channel_type    channel_type not null,
  identifier      text not null,           -- phone / email / psid / visitor uuid
  display_name    text,
  verified        boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (organisation_id, channel_type, identifier)
);
create index if not exists idx_contact_channels_contact on public.contact_channels(contact_id);

create table if not exists public.contact_custom_fields (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  key             text not null,
  label           text not null,
  field_type      text not null default 'text',  -- text | number | date | boolean | select
  options         jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  unique (organisation_id, key)
);

create table if not exists public.contact_field_values (
  id              uuid primary key default gen_random_uuid(),
  contact_id      uuid not null references public.contacts(id) on delete cascade,
  field_id        uuid not null references public.contact_custom_fields(id) on delete cascade,
  value           jsonb,
  unique (contact_id, field_id)
);

create table if not exists public.tags (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name            text not null,
  color           text default '#22D3EE',
  created_at      timestamptz not null default now(),
  unique (organisation_id, name)
);

create table if not exists public.contact_tags (
  contact_id uuid not null references public.contacts(id) on delete cascade,
  tag_id     uuid not null references public.tags(id) on delete cascade,
  primary key (contact_id, tag_id)
);

-- updated_at triggers
create trigger trg_inboxes_updated before update on public.inboxes for each row execute function public.set_updated_at();
create trigger trg_channels_updated before update on public.channels for each row execute function public.set_updated_at();
create trigger trg_channel_conn_updated before update on public.channel_connections for each row execute function public.set_updated_at();
create trigger trg_contacts_updated before update on public.contacts for each row execute function public.set_updated_at();
