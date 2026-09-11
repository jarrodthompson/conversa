# Conversa

An original, multi-tenant **omnichannel customer-service platform** — shared inbox,
AI support agents, chatbots, broadcasts, contacts, knowledge base, automation and
analytics — across WhatsApp, email, web chat and social.

> Product name, logo, colours and copy are placeholders and designed to be
> swapped easily. Pricing and testimonials are demonstration data. Nothing here
> is affiliated with any other brand.

## Stack

- **Next.js 16** (App Router) · React 19 · **TypeScript (strict)**
- **Tailwind CSS v4** (CSS-first tokens) · hand-built shadcn-style UI · Lucide icons
- **Supabase** — Postgres, Auth, Realtime, Storage · Row-Level Security throughout
- TanStack Query · React Hook Form · Zod · Recharts · dnd-kit · date-fns
- Vitest · Playwright (scaffolded)

## Getting started

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in your Supabase project values:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # server only, never exposed
SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@<pooler-host>:5432/postgres
```

> New Supabase projects usually require the **connection pooler** host
> (`aws-0-<region>.pooler.supabase.com`, user `postgres.<ref>`) rather than the
> direct `db.<ref>.supabase.co` host. Copy it from
> Dashboard → Settings → Database → Connection string.

### 3. Apply the schema and seed demo data

```bash
npm run db:push     # applies supabase/migrations/*.sql
npm run db:seed     # creates the "Grovefield Supplies" demo org + data
npm run db:types    # (optional) generate typed DB definitions from the live schema
```

### 4. Run

```bash
npm run dev
```

Open <http://localhost:3000>.

## Demo login

After seeding, sign in at `/login`:

| Role            | Email                          | Password         |
| --------------- | ------------------------------ | ---------------- |
| Owner           | `ava.owner@conversa.demo`      | `ConversaDemo!23` |
| Support Manager | `noah.manager@conversa.demo`   | `ConversaDemo!23` |
| Support Agent   | `priya.agent@conversa.demo`    | `ConversaDemo!23` |
| Marketing       | `sara.marketing@conversa.demo` | `ConversaDemo!23` |

## Project structure

```
src/
  app/
    (marketing)/        Public marketing site (home, etc.)
    (auth)/             Login, register, forgot/reset password
    onboarding/         Organisation-creation wizard
    app/                Authenticated product (inbox, contacts, reports, …)
    auth/callback/      Email-confirmation / reset code exchange
  components/
    ui/                 Design-system primitives (Button, Card, Menu, …)
    app/                Shell: sidebar, topbar, page header, empty states
    inbox/              Composer, conversation actions, channel/status meta
    marketing/          Nav, footer, hero inbox preview
    reports/            Recharts wrappers
  lib/
    supabase/           Browser / server / admin clients + middleware
    auth/               Session context, roles/capabilities, actions
    data/               Conversation queries and server actions
    validations/        Zod schemas
supabase/migrations/    Ordered SQL migrations (~60 tables + RLS)
scripts/                apply-migrations · seed · gen-types
```

## Roles

Platform Admin · Owner · Organisation Admin · Support Manager · Support Agent ·
Marketing · Reporting. Access is enforced both in the UI (capability checks) and
in the database (RLS policies keyed on organisation membership).

## AI

Runs in **demo mode** by default — deterministic, clearly-labelled responses, no
external provider. A provider abstraction allows Anthropic/OpenAI to be added by
setting `AI_PROVIDER` and the relevant key. Demo responses are never presented as
coming from a live model.

## Security & privacy

Multi-tenant isolation via RLS · server-side permission checks · Zod input
validation · audit logging · consent + suppression tables · idempotent webhook
storage. Having these building blocks does **not** by itself make the software
compliant or certified.

## Scripts

| Command            | Description                                   |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Start the dev server                          |
| `npm run build`    | Production build                              |
| `npm run typecheck`| `tsc --noEmit`                                |
| `npm run lint`     | ESLint                                        |
| `npm run db:push`  | Apply SQL migrations                          |
| `npm run db:seed`  | Seed the demo organisation                    |
| `npm run db:reset` | Migrate + seed                                |
| `npm run db:types` | Generate typed DB definitions                 |
| `npm test`         | Vitest                                        |
| `npm run test:e2e` | Playwright                                    |
