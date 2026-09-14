import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Peach redirects the shopper back here (as a POST) after checkout. Payment
 * status is applied authoritatively by the webhook; this just returns the user
 * to the billing page. 303 turns the POST into a GET so the browser lands on it.
 */
function back() {
  return NextResponse.redirect(`${appUrl}/app/settings/billing?checkout=complete`, 303);
}

export function GET() {
  return back();
}

export function POST(_request: NextRequest) {
  void _request;
  return back();
}
