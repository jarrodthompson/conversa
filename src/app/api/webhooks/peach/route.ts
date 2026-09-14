import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhook, isSuccessCode, peachConfigured } from "@/lib/billing/peach";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ ok: true, endpoint: "peach-webhook" });
}

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Parses Peach's webhook body (JSON, or form-urlencoded fallback). */
function parseBody(raw: string, contentType: string): Record<string, unknown> {
  if (contentType.includes("application/json")) {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
  return out;
}

/** Peach Payments webhook — verifies HMAC, then activates the paid plan. */
export async function POST(request: NextRequest) {
  if (!peachConfigured() || !process.env.PEACH_WEBHOOK_SECRET) {
    return new NextResponse("Peach not configured", { status: 503 });
  }

  const raw = await request.text();
  const ok = verifyWebhook(raw, `${appUrl}/api/webhooks/peach`, {
    algorithm: request.headers.get("x-webhook-signature-algorithm"),
    timestamp: request.headers.get("x-webhook-timestamp"),
    id: request.headers.get("x-webhook-id"),
    signature: request.headers.get("x-webhook-signature"),
  });
  if (!ok) return new NextResponse("Invalid signature", { status: 401 });

  const body = parseBody(raw, request.headers.get("content-type") ?? "");
  const checkoutId = (body.checkoutId ?? body.id) as string | undefined;
  // result.code may arrive nested (JSON) or flattened ("result.code").
  const resultCode =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((body.result as any)?.code as string | undefined) ?? (body["result.code"] as string | undefined);

  if (!checkoutId) return NextResponse.json({ received: true, note: "no checkoutId" });

  try {
    const admin = createAdminClient();
    const { data: sub } = await admin
      .from("organisation_subscriptions")
      .select("organisation_id, peach_pending_plan_id")
      .eq("peach_checkout_id", checkoutId)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = sub as any;
    if (!s) return NextResponse.json({ received: true, note: "unknown checkout" });

    if (isSuccessCode(resultCode)) {
      const periodEnd = new Date(Date.now() + 30 * 864e5).toISOString();
      const patch: Record<string, unknown> = {
        status: "active",
        current_period_end: periodEnd,
        peach_checkout_id: null,
        peach_pending_plan_id: null,
        updated_at: new Date().toISOString(),
      };
      if (s.peach_pending_plan_id) patch.plan_id = s.peach_pending_plan_id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await admin.from("organisation_subscriptions").update(patch as any).eq("organisation_id", s.organisation_id);
    } else {
      await admin.from("integration_logs").insert({
        organisation_id: s.organisation_id,
        level: "warn",
        message: `Peach payment not successful (code ${resultCode ?? "?"})`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        context: { checkoutId } as any,
      });
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[peach webhook] error", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
