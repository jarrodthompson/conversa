-- ─────────────────────────────────────────────────────────────────────────────
-- Chatbot runtime sessions: tracks a running published flow per conversation —
-- where it paused (current_node_id), collected variables, and status. The runtime
-- uses the service-role client; members may read their org's sessions.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.chatbot_sessions (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  flow_id         uuid not null references public.chatbot_flows(id) on delete cascade,
  current_node_id text,
  vars            jsonb not null default '{}'::jsonb,
  status          text not null default 'active',  -- active | ended | handed_off
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (conversation_id)
);
create index if not exists idx_chatbot_sessions_org on public.chatbot_sessions(organisation_id);

alter table public.chatbot_sessions enable row level security;

drop policy if exists chatbot_sessions_select on public.chatbot_sessions;
create policy chatbot_sessions_select on public.chatbot_sessions
  for select using (public.is_org_member(organisation_id));
