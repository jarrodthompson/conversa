import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWhatsAppSignature } from "@/lib/channels/whatsapp/verify";
import { ingestWhatsAppPayload } from "@/lib/channels/whatsapp/ingest";
import type { WhatsAppWebhookPayload } from "@/lib/channels/whatsapp/types";

export const runtime = "nodejs";

/**
 * GET — Meta webhook verification handshake.
 * Echoes hub.challenge when the verify token matches.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * POST — inbound messages and status updates.
 * Verifies the HMAC signature, then ingests idempotently. Always returns 200 on
 * accepted/ignored events so Meta does not needlessly retry; only signature
 * failures and unexpected errors return non-2xx.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWhatsAppSignature(raw, signature, process.env.WHATSAPP_APP_SECRET)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const result = await ingestWhatsAppPayload(admin, payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[whatsapp webhook] ingest error", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
