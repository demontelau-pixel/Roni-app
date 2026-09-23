import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import type { CookieToSet } from "@/lib/supabase/cookies";

/**
 * M3.0 auth foundation: this ONLY refreshes the Supabase session
 * cookie on each request, the way Supabase's own Next.js SSR docs
 * recommend. It does not check whether anyone is signed in and never
 * redirects — Marketplace, Home, Ask Roni and every other route stay
 * exactly as open as they are today.
 *
 * Route protection (e.g. requiring sign-in for /wallet) is
 * deliberately NOT implemented here yet — see
 * `src/lib/auth/session.ts` for the per-route helper a future
 * milestone will call from inside the Wallet pages themselves. Adding
 * that check here, globally, is exactly what M3.0 was told not to do
 * yet ("do not force a login screen into every existing route").
 *
 * Defensive by design: if the Supabase env vars aren't set (e.g. a
 * misconfigured deploy), this skips Supabase entirely rather than
 * throwing — a missing env var here must never take down Marketplace
 * or Health.
 */
export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  // <Database> isn't needed for anything this file actually queries
  // (only `supabase.auth.getUser()` below) — it's here so this call's
  // generic inference matches `lib/supabase/server.ts`'s exactly,
  // removing one variable from why `cookies.setAll`'s inferred type
  // could differ between the two. See `lib/supabase/cookies.ts` for
  // the full explanation of why `setAll` is explicitly typed at all.
  const supabase = createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Touching auth here (rather than just reading the cookie) is what
  // actually triggers Supabase to refresh an expiring session token.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every route except: Next's static assets, image
     * optimization, the favicon, common static file extensions, and
     * RONI's own API routes (which build their own server client
     * per-request when they need one, e.g. nothing under
     * /api/health/* needs a user session at all today).
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
