-- Conversa · 0009 · Enable Supabase Realtime for the inbox
-- postgres_changes on these tables drives live updates (new messages, assignment
-- and status changes). RLS still applies, so clients only receive rows their
-- organisation membership allows them to SELECT.

-- Add tables to the realtime publication (guarded so re-runs are no-ops).
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.internal_notes;
exception when duplicate_object then null;
end $$;

-- REPLICA IDENTITY FULL so UPDATE/DELETE events carry the full row for filtering.
alter table public.messages replica identity full;
alter table public.conversations replica identity full;
alter table public.internal_notes replica identity full;
