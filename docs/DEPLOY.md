# Deploying Conversa to Vercel

The repo is ready to deploy as-is. It uses the same Supabase project that's already
migrated and seeded, so there's **no database step** — you only set env vars.

## 1. Import the repo

1. Go to <https://vercel.com/new> and **Import** `jarrodthompson/conversa`.
2. Framework preset: **Next.js** (auto-detected). Leave build/output settings default.
   - `.npmrc` (`legacy-peer-deps=true`) is committed so Vercel's `npm install`
     resolves dev-dependency peers exactly like local.

## 2. Environment variables

Add these under **Project → Settings → Environment Variables** (Production + Preview).

### Required (runtime)
| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://skxholkfrcwyemyjybdx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service-role key (secret) |
| `NEXT_PUBLIC_APP_URL` | your Vercel URL, e.g. `https://conversa.vercel.app` |
| `NEXT_PUBLIC_APP_NAME` | `Conversa` |
| `AI_PROVIDER` | `demo` |
| `CRON_SECRET` | a long random string (enables the cron sweep — see §4) |

> Set `NEXT_PUBLIC_APP_URL` to the real domain after the first deploy, then redeploy —
> it's used for auth email (verify/reset) redirect links.

### Optional (channels — leave unset to stay in demo mode)
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`,
`WHATSAPP_APP_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET`,
`META_APP_SECRET`, `META_PAGE_ACCESS_TOKEN`.

> `SUPABASE_DB_URL` is **not** needed at runtime — it's only for local
> `npm run db:push` / `db:seed`. Don't add it to Vercel.

## 3. Supabase auth redirect URLs

In the Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL**: `https://<your-vercel-domain>`
- **Redirect URLs**: add `https://<your-vercel-domain>/auth/callback`

Without this, email confirmation and password-reset links won't complete in production.

## 4. Cron — time-based automation sweep

`vercel.json` schedules the sweep every 15 minutes:

```json
{ "crons": [{ "path": "/api/cron/sweep", "schedule": "*/15 * * * *" }] }
```

- When a `CRON_SECRET` env var exists, **Vercel automatically sends
  `Authorization: Bearer <CRON_SECRET>`** with each cron invocation, which the
  endpoint verifies — so no extra wiring is needed.
- **Plan note:** Vercel **Hobby** runs crons at most **once per day**; change the
  schedule to e.g. `0 * * * *` (hourly) or `0 9 * * *` (daily) if the 15-minute
  cadence is rejected. **Pro** supports the 15-minute schedule.
- You can trigger it manually any time:
  `curl -H "Authorization: Bearer <CRON_SECRET>" https://<domain>/api/cron/sweep`

## 5. Channel webhooks (only when going live)

Point providers at your deployed URLs and set the matching env vars:
- WhatsApp: `https://<domain>/api/webhooks/whatsapp` (verify token = `WHATSAPP_VERIFY_TOKEN`)
- Email (Resend): `https://<domain>/api/webhooks/email` (signing secret = `RESEND_WEBHOOK_SECRET`)

## 6. Deploy

Click **Deploy**. Every push to `main` redeploys automatically. After the first
deploy, set `NEXT_PUBLIC_APP_URL` to the real domain and redeploy once.
