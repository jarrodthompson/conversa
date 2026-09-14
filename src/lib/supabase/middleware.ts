import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

/** Routes that never require authentication. */
const PUBLIC_PREFIXES = [
  "/",
  "/features",
  "/pricing",
  "/about",
  "/contact",
  "/demo",
  "/legal",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/auth",
  "/widget",
  "/api/webhooks",
  "/api/widget",
];

function isPublic(pathname: string) {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (p) => p !== "/" && (pathname === p || pathname.startsWith(p + "/")),
  );
}

/**
 * Refreshes the Supabase session on every request and guards the /app area.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Before Supabase env is configured, don't attempt auth — let all routes
  // render so the app is inspectable. Protected routes still guard below only
  // when a client can be created.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return response;
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAppRoute = pathname.startsWith("/app") || pathname.startsWith("/onboarding");

  if (isAppRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Signed-in users landing on auth pages go to the app (or their pending
  // destination, e.g. an invitation link they were asked to sign in for).
  if (user && ["/login", "/register"].includes(pathname)) {
    const nextParam = request.nextUrl.searchParams.get("next");
    const url = request.nextUrl.clone();
    url.pathname = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/app/inbox";
    url.search = "";
    return NextResponse.redirect(url);
  }

  void isPublic; // exported helper kept for future granular checks
  return response;
}
