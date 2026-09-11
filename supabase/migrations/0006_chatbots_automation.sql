-- Conversa · 0006 · Visual chatbot builder & automation rules

-- ─────────────────────────────────────────────────────────────────────────────
-- chatbot_flows  (definition stored as versioned JSON; relational metadata here)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.chatbot_flows (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name            text not null,
  description     text,
  status          flow_status not null default 'draft',
  channels        channel_type[] not null default '{}',
  current_version integer not null default 1,
  -- Working/draft definition (nodes + edges). Published copy lives in versions.
  definition      jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists idx_flows_org on public.chatbot_flows(organisation_id);

create table if not exists public.chatbot_versions (
  id          uuid primary key default gen_random_uuid(),
  flow_id     uuid not null references public.chatbot_flows(id) on delete cascade,
  version     integer not null,
  definition  jsonb not null,
  published_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (flow_id, version)
);

create table if not exists public.chatbot_runs (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  flow_id         uuid references public.chatbot_flows(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  version         integer,
  status          text not null default 'running',  -- running | completed | handed_off | error
  current_node    text,
  context         jsonb not null default '{}'::jsonb,
  log             jsonb not null default '[]'::jsonb, -- execution trace
  started_at      timestamptz not null default now(),
  ended_at        timestamptz
);
create index if not exists idx_flowruns_flow on public.chatbot_runs(flow_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- automation_rules  (trigger → conditions → actions)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.automation_rules (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name            text not null,
  description     text,
  status          automation_status not null default 'active',
  position        integer not null default 0,       -- execution order
  trigger_type    text not null,                    -- e.g. 'message.inbound'
  trigger_config  jsonb not null default '{}'::jsonb,
  conditions      jsonb not null default '[]'::jsonb,
  actions         jsonb not null default '[]'::jsonb,
  run_count       integer not null default 0,
  last_run_at     timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists idx_rules_org on public.automation_rules(organisation_id, position);

create table if not exists public.automation_runs (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  rule_id         uuid references public.automation_rules(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  result          run_result not null default 'success',
  detail          jsonb not null default '{}'::jsonb,
  -- Loop protection: how deep in a cascade this run is.
  depth           smallint not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists idx_ruleruns_rule on public.automation_runs(rule_id, created_at desc);

create trigger trg_flows_updated before update on public.chatbot_flows for each row execute function public.set_updated_at();
create trigger trg_rules_updated before update on public.automation_rules for each row execute function public.set_updated_at();
