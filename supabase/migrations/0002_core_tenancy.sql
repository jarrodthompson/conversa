-- Conversa · 0002 · Core tenancy: organisations, users, roles, teams
-- Supabase's `auth.users` is the canonical identity table. `user_profiles`
-- extends it with app data; `organisation_members` grants a user a role in an org.

-- ─────────────────────────────────────────────────────────────────────────────
-- user_profiles  (1:1 with auth.users)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text,
  avatar_url   text,
  phone        text,
  timezone     text not null default 'UTC',
  locale       text not null default 'en',
  mfa_enabled  boolean not null default false,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- organisations
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.organisations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  industry      text,
  logo_url      text,
  brand_color   text default '#06B6D4',
  timezone      text not null default 'UTC',
  locale        text not null default 'en',
  onboarding_step smallint not null default 0,   -- 0..9 wizard progress
  onboarded_at  timestamptz,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists idx_org_slug on public.organisations(slug) where deleted_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- organisation_members  (user ↔ org with a role)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.organisation_members (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            org_role not null default 'support_agent',
  is_default      boolean not null default false,  -- default org on login
  status          text not null default 'active',  -- active | suspended
  invited_by      uuid references auth.users(id) on delete set null,
  invited_at      timestamptz,
  accepted_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organisation_id, user_id)
);
create index if not exists idx_org_members_user on public.organisation_members(user_id);
create index if not exists idx_org_members_org on public.organisation_members(organisation_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Membership helper (SECURITY DEFINER so RLS policies can call it without recursion)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organisation_members m
    where m.organisation_id = org
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.has_org_role(org uuid, roles org_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organisation_members m
    where m.organisation_id = org
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(roles)
  );
$$;

-- Roles the current user administers (owner/org_admin) — used for management writes.
create or replace function public.can_manage_org(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_role(org, array['owner','org_admin']::org_role[]);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- roles & permissions  (fine-grained catalogue; org_role is the coarse default)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.permissions (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,        -- e.g. 'conversations.assign'
  description text not null,
  category    text not null default 'general'
);

create table if not exists public.roles (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade, -- null = system role
  name            text not null,
  base_role       org_role not null default 'support_agent',
  is_system       boolean not null default false,
  description     text,
  permission_keys text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organisation_id, name)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- teams & team_members
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.teams (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name            text not null,
  description     text,
  color           text default '#06B6D4',
  routing_strategy text not null default 'manual', -- manual | round_robin | skill
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists idx_teams_org on public.teams(organisation_id);

create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  is_lead    boolean not null default false,
  skills     text[] not null default '{}',
  capacity   smallint not null default 20,  -- max concurrent conversations
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);
create index if not exists idx_team_members_user on public.team_members(user_id);

-- Presence / availability lives with the member profile per org.
create table if not exists public.agent_availability (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  presence        text not null default 'offline', -- online | away | offline
  accepting       boolean not null default true,
  working_hours   jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now(),
  unique (organisation_id, user_id)
);

-- updated_at triggers
create trigger trg_user_profiles_updated before update on public.user_profiles for each row execute function public.set_updated_at();
create trigger trg_org_updated before update on public.organisations for each row execute function public.set_updated_at();
create trigger trg_org_members_updated before update on public.organisation_members for each row execute function public.set_updated_at();
create trigger trg_roles_updated before update on public.roles for each row execute function public.set_updated_at();
create trigger trg_teams_updated before update on public.teams for each row execute function public.set_updated_at();

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, full_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
