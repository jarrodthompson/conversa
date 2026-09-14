-- ─────────────────────────────────────────────────────────────────────────────
-- Team invitations: invite a person by email to join an organisation with a role.
-- Acceptance is performed server-side with the service-role client (bypasses RLS)
-- because the invitee is not yet a member; management is gated to owners/admins.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.organisation_invitations (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  email           text not null,
  role            org_role not null default 'support_agent',
  token           text not null unique,
  status          text not null default 'pending',  -- pending | accepted | revoked
  invited_by      uuid references auth.users(id) on delete set null,
  expires_at      timestamptz not null default (now() + interval '7 days'),
  accepted_at     timestamptz,
  accepted_by     uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_org_invites_org on public.organisation_invitations(organisation_id);
create index if not exists idx_org_invites_email on public.organisation_invitations(lower(email));
-- Only one live (pending) invite per email per org.
create unique index if not exists uq_org_invites_pending
  on public.organisation_invitations(organisation_id, lower(email))
  where status = 'pending';

alter table public.organisation_invitations enable row level security;

-- Members can view their org's invitations; owners/admins manage them.
drop policy if exists org_invites_select on public.organisation_invitations;
create policy org_invites_select on public.organisation_invitations
  for select using (public.is_org_member(organisation_id));

drop policy if exists org_invites_manage on public.organisation_invitations;
create policy org_invites_manage on public.organisation_invitations
  for all using (public.can_manage_org(organisation_id))
  with check (public.can_manage_org(organisation_id));
