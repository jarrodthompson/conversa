-- Conversa · 0004 · Conversations, messages, tickets, notes

-- ─────────────────────────────────────────────────────────────────────────────
-- conversations
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.conversations (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  inbox_id         uuid references public.inboxes(id) on delete set null,
  channel_id       uuid references public.channels(id) on delete set null,
  channel_type     channel_type not null,
  contact_id       uuid references public.contacts(id) on delete set null,
  subject          text,
  status           conversation_status not null default 'open',
  priority         conversation_priority not null default 'normal',
  assignee_id      uuid references auth.users(id) on delete set null,
  team_id          uuid references public.teams(id) on delete set null,
  is_ai_handled    boolean not null default false,
  sentiment        sentiment,
  ai_summary       text,
  ai_next_action   text,
  last_message_at  timestamptz,
  last_message_preview text,
  first_response_at timestamptz,
  resolved_at      timestamptz,
  snoozed_until    timestamptz,
  sla_policy_id    uuid,           -- fk added in 0007 after sla_policies exists
  sla_due_at       timestamptz,
  sla_breached     boolean not null default false,
  unread_count     integer not null default 0,
  merged_into_id   uuid references public.conversations(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index if not exists idx_conv_org_status on public.conversations(organisation_id, status) where deleted_at is null;
create index if not exists idx_conv_assignee on public.conversations(assignee_id);
create index if not exists idx_conv_inbox on public.conversations(inbox_id);
create index if not exists idx_conv_last_msg on public.conversations(organisation_id, last_message_at desc);
create index if not exists idx_conv_contact on public.conversations(contact_id);

create table if not exists public.conversation_participants (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  role            text not null default 'watcher',  -- assignee | watcher | mentioned
  created_at      timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create table if not exists public.conversation_tags (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  tag_id          uuid not null references public.tags(id) on delete cascade,
  primary key (conversation_id, tag_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- messages
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  direction        message_direction not null,
  author_type      message_author_type not null,
  author_id        uuid references auth.users(id) on delete set null, -- when agent
  contact_id       uuid references public.contacts(id) on delete set null,
  body             text,
  content_type     text not null default 'text',   -- text | html | template | event
  metadata         jsonb not null default '{}'::jsonb,
  external_id      text,                            -- provider message id
  in_reply_to      uuid references public.messages(id) on delete set null,
  delivery_status  message_delivery_status not null default 'sent',
  is_private       boolean not null default false,  -- internal note flag mirror
  ai_run_id        uuid,                            -- fk added in 0005
  sent_at          timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index if not exists idx_messages_conv on public.messages(conversation_id, created_at);
create index if not exists idx_messages_org on public.messages(organisation_id);
create unique index if not exists idx_messages_external on public.messages(organisation_id, external_id) where external_id is not null;

create table if not exists public.message_attachments (
  id            uuid primary key default gen_random_uuid(),
  message_id    uuid not null references public.messages(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  file_name     text not null,
  content_type  text not null,
  byte_size     bigint not null default 0,
  storage_path  text not null,       -- Supabase Storage object path
  width         integer,
  height        integer,
  created_at    timestamptz not null default now()
);
create index if not exists idx_attachments_message on public.message_attachments(message_id);

create table if not exists public.message_status_events (
  id            uuid primary key default gen_random_uuid(),
  message_id    uuid not null references public.messages(id) on delete cascade,
  status        message_delivery_status not null,
  provider_ts   timestamptz,
  detail        text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_msg_status_message on public.message_status_events(message_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- internal notes & mentions
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.internal_notes (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  author_id       uuid references auth.users(id) on delete set null,
  body            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_notes_conv on public.internal_notes(conversation_id, created_at);

create table if not exists public.mentions (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  note_id         uuid references public.internal_notes(id) on delete cascade,
  mentioned_user  uuid not null references auth.users(id) on delete cascade,
  mentioned_by    uuid references auth.users(id) on delete set null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_mentions_user on public.mentions(mentioned_user) where read_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- tickets  (a conversation can be escalated into a tracked ticket)
-- ─────────────────────────────────────────────────────────────────────────────
create sequence if not exists ticket_number_seq;

create table if not exists public.tickets (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  number           bigint not null default nextval('ticket_number_seq'),
  conversation_id  uuid references public.conversations(id) on delete set null,
  subject          text not null,
  status           ticket_status not null default 'open',
  priority         conversation_priority not null default 'normal',
  category         text,
  assignee_id      uuid references auth.users(id) on delete set null,
  team_id          uuid references public.teams(id) on delete set null,
  channel_type     channel_type,
  contact_id       uuid references public.contacts(id) on delete set null,
  first_response_at timestamptz,
  resolved_at      timestamptz,
  sla_policy_id    uuid,
  sla_status       text,             -- ok | at_risk | breached
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index if not exists idx_tickets_org_status on public.tickets(organisation_id, status);
create unique index if not exists idx_tickets_number on public.tickets(organisation_id, number);

create table if not exists public.ticket_tags (
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  tag_id    uuid not null references public.tags(id) on delete cascade,
  primary key (ticket_id, tag_id)
);

create table if not exists public.ticket_assignments (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets(id) on delete cascade,
  assignee_id uuid references auth.users(id) on delete set null,
  team_id     uuid references public.teams(id) on delete set null,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.ticket_status_history (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets(id) on delete cascade,
  from_status ticket_status,
  to_status   ticket_status not null,
  changed_by  uuid references auth.users(id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_ticket_history on public.ticket_status_history(ticket_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- saved replies & saved views
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.saved_replies (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  title           text not null,
  shortcut        text,
  body            text not null,
  channel_type    channel_type,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.saved_views (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade, -- null = shared view
  name            text not null,
  icon            text,
  filters         jsonb not null default '{}'::jsonb,
  position        smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- updated_at triggers
create trigger trg_conv_updated before update on public.conversations for each row execute function public.set_updated_at();
create trigger trg_notes_updated before update on public.internal_notes for each row execute function public.set_updated_at();
create trigger trg_tickets_updated before update on public.tickets for each row execute function public.set_updated_at();
create trigger trg_saved_replies_updated before update on public.saved_replies for each row execute function public.set_updated_at();
create trigger trg_saved_views_updated before update on public.saved_views for each row execute function public.set_updated_at();

-- Ticket status change → history row
create or replace function public.log_ticket_status()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.ticket_status_history(ticket_id, from_status, to_status)
    values (new.id, old.status, new.status);
  end if;
  return new;
end; $$;
create trigger trg_ticket_status_log after update on public.tickets for each row execute function public.log_ticket_status();
