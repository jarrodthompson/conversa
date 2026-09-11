-- Conversa · 0008 · Row-Level Security
-- Strategy:
--   * Every org-scoped table is readable/writable only by active members of that
--     org, enforced by public.is_org_member(organisation_id).
--   * Child/junction tables without an organisation_id column are gated by an
--     EXISTS join to their parent.
--   * Reference tables (permissions, subscription_plans) are world-readable to
--     authenticated users.
--   * Server-side routes that must bypass RLS (public web-chat widget, inbound
--     webhooks) use the service_role key, which bypasses RLS by design.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Generic org-isolation policy for every table with an organisation_id column
--    (excluding `roles`, which has nullable org for shared system roles).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t record;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'organisation_id'
      and c.table_name <> 'roles'
  loop
    execute format('alter table public.%I enable row level security;', t.table_name);
    execute format('drop policy if exists org_isolation on public.%I;', t.table_name);
    execute format(
      'create policy org_isolation on public.%I
         for all to authenticated
         using (public.is_org_member(organisation_id))
         with check (public.is_org_member(organisation_id));',
      t.table_name
    );
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. organisations  (membership-based)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.organisations enable row level security;
drop policy if exists org_select on public.organisations;
create policy org_select on public.organisations
  for select to authenticated
  using (public.is_org_member(id));

drop policy if exists org_insert on public.organisations;
create policy org_insert on public.organisations
  for insert to authenticated
  with check (created_by = auth.uid());   -- any authed user can create a new org

drop policy if exists org_update on public.organisations;
create policy org_update on public.organisations
  for update to authenticated
  using (public.can_manage_org(id))
  with check (public.can_manage_org(id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. user_profiles  (self + fellow org members can read)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.user_profiles enable row level security;
drop policy if exists profile_self on public.user_profiles;
create policy profile_self on public.user_profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profile_read_coworkers on public.user_profiles;
create policy profile_read_coworkers on public.user_profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.organisation_members a
      join public.organisation_members b on a.organisation_id = b.organisation_id
      where a.user_id = auth.uid() and b.user_id = user_profiles.id
        and a.status = 'active'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. organisation_members  (members read their orgs; managers write)
-- ─────────────────────────────────────────────────────────────────────────────
-- The generic loop already covered this table. Refine: only managers may write.
drop policy if exists org_isolation on public.organisation_members;
create policy members_select on public.organisation_members
  for select to authenticated
  using (public.is_org_member(organisation_id) or user_id = auth.uid());
create policy members_write on public.organisation_members
  for insert to authenticated
  with check (public.can_manage_org(organisation_id));
create policy members_update on public.organisation_members
  for update to authenticated
  using (public.can_manage_org(organisation_id))
  with check (public.can_manage_org(organisation_id));
create policy members_delete on public.organisation_members
  for delete to authenticated
  using (public.can_manage_org(organisation_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. roles  (system roles world-readable; org roles member-readable, manager-writable)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.roles enable row level security;
drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select to authenticated
  using (organisation_id is null or public.is_org_member(organisation_id));
create policy roles_write on public.roles
  for all to authenticated
  using (organisation_id is not null and public.can_manage_org(organisation_id))
  with check (organisation_id is not null and public.can_manage_org(organisation_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Reference tables — world-readable to authenticated users
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.permissions enable row level security;
drop policy if exists permissions_read on public.permissions;
create policy permissions_read on public.permissions for select to authenticated using (true);

alter table public.subscription_plans enable row level security;
drop policy if exists plans_read on public.subscription_plans;
create policy plans_read on public.subscription_plans for select to authenticated using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Junction / child tables without organisation_id — gate via parent EXISTS
-- ─────────────────────────────────────────────────────────────────────────────
-- helper macro emulated inline per table.

-- team_members → teams
alter table public.team_members enable row level security;
drop policy if exists team_members_rls on public.team_members;
create policy team_members_rls on public.team_members
  for all to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and public.is_org_member(t.organisation_id)))
  with check (exists (select 1 from public.teams t where t.id = team_id and public.is_org_member(t.organisation_id)));

-- contact_field_values → contacts
alter table public.contact_field_values enable row level security;
drop policy if exists cfv_rls on public.contact_field_values;
create policy cfv_rls on public.contact_field_values
  for all to authenticated
  using (exists (select 1 from public.contacts c where c.id = contact_id and public.is_org_member(c.organisation_id)))
  with check (exists (select 1 from public.contacts c where c.id = contact_id and public.is_org_member(c.organisation_id)));

-- contact_tags → contacts
alter table public.contact_tags enable row level security;
drop policy if exists ctags_rls on public.contact_tags;
create policy ctags_rls on public.contact_tags
  for all to authenticated
  using (exists (select 1 from public.contacts c where c.id = contact_id and public.is_org_member(c.organisation_id)))
  with check (exists (select 1 from public.contacts c where c.id = contact_id and public.is_org_member(c.organisation_id)));

-- conversation_participants → conversations
alter table public.conversation_participants enable row level security;
drop policy if exists cparts_rls on public.conversation_participants;
create policy cparts_rls on public.conversation_participants
  for all to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and public.is_org_member(c.organisation_id)))
  with check (exists (select 1 from public.conversations c where c.id = conversation_id and public.is_org_member(c.organisation_id)));

-- conversation_tags → conversations
alter table public.conversation_tags enable row level security;
drop policy if exists convtags_rls on public.conversation_tags;
create policy convtags_rls on public.conversation_tags
  for all to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and public.is_org_member(c.organisation_id)))
  with check (exists (select 1 from public.conversations c where c.id = conversation_id and public.is_org_member(c.organisation_id)));

-- message_status_events → messages
alter table public.message_status_events enable row level security;
drop policy if exists mse_rls on public.message_status_events;
create policy mse_rls on public.message_status_events
  for all to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id and public.is_org_member(m.organisation_id)))
  with check (exists (select 1 from public.messages m where m.id = message_id and public.is_org_member(m.organisation_id)));

-- ticket_tags → tickets
alter table public.ticket_tags enable row level security;
drop policy if exists ttags_rls on public.ticket_tags;
create policy ttags_rls on public.ticket_tags
  for all to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id and public.is_org_member(t.organisation_id)))
  with check (exists (select 1 from public.tickets t where t.id = ticket_id and public.is_org_member(t.organisation_id)));

-- ticket_assignments → tickets
alter table public.ticket_assignments enable row level security;
drop policy if exists tassign_rls on public.ticket_assignments;
create policy tassign_rls on public.ticket_assignments
  for all to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id and public.is_org_member(t.organisation_id)))
  with check (exists (select 1 from public.tickets t where t.id = ticket_id and public.is_org_member(t.organisation_id)));

-- ticket_status_history → tickets
alter table public.ticket_status_history enable row level security;
drop policy if exists tsh_rls on public.ticket_status_history;
create policy tsh_rls on public.ticket_status_history
  for all to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id and public.is_org_member(t.organisation_id)))
  with check (exists (select 1 from public.tickets t where t.id = ticket_id and public.is_org_member(t.organisation_id)));

-- ai_agent_versions → ai_agents
alter table public.ai_agent_versions enable row level security;
drop policy if exists aiver_rls on public.ai_agent_versions;
create policy aiver_rls on public.ai_agent_versions
  for all to authenticated
  using (exists (select 1 from public.ai_agents a where a.id = agent_id and public.is_org_member(a.organisation_id)))
  with check (exists (select 1 from public.ai_agents a where a.id = agent_id and public.is_org_member(a.organisation_id)));

-- ai_agent_sources → ai_agents
alter table public.ai_agent_sources enable row level security;
drop policy if exists aisrc_rls on public.ai_agent_sources;
create policy aisrc_rls on public.ai_agent_sources
  for all to authenticated
  using (exists (select 1 from public.ai_agents a where a.id = agent_id and public.is_org_member(a.organisation_id)))
  with check (exists (select 1 from public.ai_agents a where a.id = agent_id and public.is_org_member(a.organisation_id)));

-- knowledge_article_versions → knowledge_articles
alter table public.knowledge_article_versions enable row level security;
drop policy if exists kav_rls on public.knowledge_article_versions;
create policy kav_rls on public.knowledge_article_versions
  for all to authenticated
  using (exists (select 1 from public.knowledge_articles a where a.id = article_id and public.is_org_member(a.organisation_id)))
  with check (exists (select 1 from public.knowledge_articles a where a.id = article_id and public.is_org_member(a.organisation_id)));

-- chatbot_versions → chatbot_flows
alter table public.chatbot_versions enable row level security;
drop policy if exists cbver_rls on public.chatbot_versions;
create policy cbver_rls on public.chatbot_versions
  for all to authenticated
  using (exists (select 1 from public.chatbot_flows f where f.id = flow_id and public.is_org_member(f.organisation_id)))
  with check (exists (select 1 from public.chatbot_flows f where f.id = flow_id and public.is_org_member(f.organisation_id)));
