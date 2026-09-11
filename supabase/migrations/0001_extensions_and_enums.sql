-- Conversa · 0001 · Extensions, enums, and shared helpers
-- Multi-tenant omnichannel customer-service platform.
-- All tables live in the `public` schema and are isolated per organisation via RLS.

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";        -- fuzzy search on contacts/messages
create extension if not exists "citext";         -- case-insensitive email

-- ─────────────────────────────────────────────────────────────────────────────
-- Enumerated types
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  create type org_role as enum (
    'platform_admin', 'owner', 'org_admin', 'support_manager',
    'support_agent', 'marketing', 'reporting'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type channel_type as enum (
    'whatsapp', 'web_chat', 'email', 'messenger', 'instagram', 'sms'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type connection_status as enum ('disconnected', 'connecting', 'connected', 'error', 'demo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type conversation_status as enum ('open', 'pending', 'waiting', 'snoozed', 'resolved', 'spam');
exception when duplicate_object then null; end $$;

do $$ begin
  create type conversation_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_direction as enum ('inbound', 'outbound');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_author_type as enum ('contact', 'agent', 'ai', 'bot', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_delivery_status as enum ('queued', 'sent', 'delivered', 'read', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_status as enum ('open', 'pending', 'on_hold', 'resolved', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sentiment as enum ('positive', 'neutral', 'negative');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ai_agent_status as enum ('draft', 'published', 'paused', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type knowledge_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type index_status as enum ('pending', 'indexing', 'indexed', 'failed', 'stale');
exception when duplicate_object then null; end $$;

do $$ begin
  create type flow_status as enum ('draft', 'published', 'paused', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type broadcast_status as enum ('draft', 'scheduled', 'sending', 'sent', 'paused', 'failed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type recipient_status as enum ('queued', 'sent', 'delivered', 'read', 'replied', 'failed', 'opted_out');
exception when duplicate_object then null; end $$;

do $$ begin
  create type consent_status as enum ('opted_in', 'opted_out', 'pending', 'unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type automation_status as enum ('active', 'disabled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type run_result as enum ('success', 'failed', 'skipped', 'escalated');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger helper
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
