import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runTimeSweep } from "@/lib/automations/sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Time-based automation sweep endpoint, meant to be hit by a scheduler
 * (Vercel Cron, Supabase pg_cron/Edge scheduler, GitHub Actions, etc.).
 * Protected by CRON_SECRET via `Authorization: Bearer` or `?secret=`.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new NextResponse("CRON_SECRET not configured", { status: 503 });

  const auth = request.headers.get("authorization");
  const provided = auth?.replace(/^Bearer\s+/i, "") ?? request.nextUrl.searchParams.get("secret");
  if (provided !== secret) return new NextResponse("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const result = await runTimeSweep(admin);
  return NextResponse.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
