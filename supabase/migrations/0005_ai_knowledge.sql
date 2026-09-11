-- Conversa · 0005 · AI agents, runs, feedback, knowledge base

-- ─────────────────────────────────────────────────────────────────────────────
-- ai_agents & versions
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.ai_agents (
  id                  uuid primary key default gen_random_uuid(),
  organisation_id     uuid not null references public.organisations(id) on delete cascade,
  name                text not null,
  status              ai_agent_status not null default 'draft',
  tone                text not null default 'friendly',      -- friendly | formal | concise | playful
  language            text not null default 'en',
  channels            channel_type[] not null default '{}',
  greeting            text,
  fallback_message    text,
  operating_hours     jsonb not null default '{}'::jsonb,
  allowed_topics      text[] not null default '{}',
  prohibited_topics   text[] not null default '{}',
  confidence_threshold numeric(3,2) not null default 0.60,
  handoff_conditions  jsonb not null default '{}'::jsonb,
  provider            text not null default 'demo',           -- demo | anthropic | openai
  model               text,
  current_version     integer not null default 1,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  constraint chk_confidence check (confidence_threshold >= 0 and confidence_threshold <= 1)
);
create index if not exists idx_ai_agents_org on public.ai_agents(organisation_id);

create table if not exists public.ai_agent_versions (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references public.ai_agents(id) on delete cascade,
  version     integer not null,
  snapshot    jsonb not null,               -- full config at publish time
  published_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (agent_id, version)
);

create table if not exists public.ai_agent_sources (
  id                  uuid primary key default gen_random_uuid(),
  agent_id            uuid not null references public.ai_agents(id) on delete cascade,
  collection_id       uuid,                 -- fk to knowledge_collections below
  created_at          timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- knowledge base
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.knowledge_collections (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name            text not null,
  description     text,
  parent_id       uuid references public.knowledge_collections(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_kcoll_org on public.knowledge_collections(organisation_id);

-- Now that collections exist, wire the agent-sources fk.
alter table public.ai_agent_sources
  drop constraint if exists ai_agent_sources_collection_fk,
  add constraint ai_agent_sources_collection_fk
  foreign key (collection_id) references public.knowledge_collections(id) on delete cascade;

create table if not exists public.knowledge_articles (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  collection_id   uuid references public.knowledge_collections(id) on delete set null,
  title           text not null,
  slug            text,
  body            text not null default '',
  status          knowledge_status not null default 'draft',
  index_status    index_status not null default 'pending',
  tags            text[] not null default '{}',
  version         integer not null default 1,
  source_type     text not null default 'article',  -- article | faq | text
  owner_id        uuid references auth.users(id) on delete set null,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists idx_karticles_org on public.knowledge_articles(organisation_id, status);
create index if not exists idx_karticles_body_trgm on public.knowledge_articles using gin (body gin_trgm_ops);

create table if not exists public.knowledge_article_versions (
  id          uuid primary key default gen_random_uuid(),
  article_id  uuid not null references public.knowledge_articles(id) on delete cascade,
  version     integer not null,
  title       text not null,
  body        text not null,
  edited_by   uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (article_id, version)
);

create table if not exists public.knowledge_documents (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  collection_id   uuid references public.knowledge_collections(id) on delete set null,
  file_name       text not null,
  content_type    text not null,            -- application/pdf, docx, text/csv…
  byte_size       bigint not null default 0,
  storage_path    text not null,
  source_url      text,                     -- for public URL imports
  index_status    index_status not null default 'pending',
  uploaded_by     uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_kdocs_org on public.knowledge_documents(organisation_id);

-- Chunks: the indexed units the AI cites. Embeddings kept as jsonb for demo mode
-- (swap to pgvector `vector` column when the embedding provider is configured).
create table if not exists public.knowledge_chunks (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  article_id      uuid references public.knowledge_articles(id) on delete cascade,
  document_id     uuid references public.knowledge_documents(id) on delete cascade,
  chunk_index     integer not null default 0,
  content         text not null,
  token_count     integer,
  embedding       jsonb,                    -- placeholder; pgvector-ready
  created_at      timestamptz not null default now()
);
create index if not exists idx_kchunks_article on public.knowledge_chunks(article_id);
create index if not exists idx_kchunks_content_trgm on public.knowledge_chunks using gin (content gin_trgm_ops);

-- Knowledge gaps detected from unresolved / low-confidence questions.
create table if not exists public.knowledge_gaps (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  question        text not null,
  occurrences     integer not null default 1,
  last_seen_at    timestamptz not null default now(),
  resolved        boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ai_runs & feedback  (every AI action recorded for audit)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.ai_runs (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  agent_id        uuid references public.ai_agents(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  kind            text not null default 'suggestion',  -- suggestion | reply | summary | rewrite | classify
  provider        text not null default 'demo',
  model           text,
  input           jsonb not null default '{}'::jsonb,
  output          text,
  confidence      numeric(3,2),
  cited_chunks    uuid[] not null default '{}',
  escalated       boolean not null default false,
  escalation_reason text,
  latency_ms      integer,
  token_usage     jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_airuns_conv on public.ai_runs(conversation_id);
create index if not exists idx_airuns_org on public.ai_runs(organisation_id, created_at desc);

-- Wire messages.ai_run_id now that ai_runs exists.
alter table public.messages
  drop constraint if exists messages_ai_run_fk,
  add constraint messages_ai_run_fk foreign key (ai_run_id) references public.ai_runs(id) on delete set null;

create table if not exists public.ai_feedback (
  id          uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  ai_run_id   uuid not null references public.ai_runs(id) on delete cascade,
  rating      smallint,                  -- -1 | 0 | 1
  corrected_text text,
  reviewer_id uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create trigger trg_ai_agents_updated before update on public.ai_agents for each row execute function public.set_updated_at();
create trigger trg_karticles_updated before update on public.knowledge_articles for each row execute function public.set_updated_at();
create trigger trg_kdocs_updated before update on public.knowledge_documents for each row execute function public.set_updated_at();
create trigger trg_kcoll_updated before update on public.knowledge_collections for each row execute function public.set_updated_at();
