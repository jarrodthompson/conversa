import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySvixSignature } from "@/lib/channels/email/verify";
import { ingestEmailPayload } from "@/lib/channels/email/ingest";
import type { EmailWebhookPayload } from "@/lib/channels/email/types";

export const runtime = "nodejs";

/** Simple health check. */
export function GET() {
  return NextResponse.json({ ok: true, endpoint: "email-webhook" });
}

/**
 * POST — Resend inbound emails and delivery events. Verifies the Svix signature,
 * then ingests idempotently (keyed by the svix event id).
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");

  if (!verifySvixSignature(raw, { id, timestamp, signature }, process.env.RESEND_WEBHOOK_SECRET)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: EmailWebhookPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const result = await ingestEmailPayload(admin, payload, id!);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[email webhook] ingest error", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
