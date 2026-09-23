import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";
import type { CookieToSet } from "@/lib/supabase/cookies";

/**
 * Supabase client for Server Components, Server Actions, and Route
 * Handlers. Reads/writes the auth session via Next.js's cookie store
 * so RLS sees the signed-in user on the server, same as it would in
 * the browser.
 *
 * Still only uses the publishable key — M3.0 deliberately has no
 * secret/service-role key anywhere (see the M3.0 setup doc for why).
 * Every table this touches is protected by Row Level Security, so a
 * server-side client with the publishable key can only do what the
 * signed-in user themselves is allowed to do.
 *
 * Must be created fresh per request (it closes over that request's
 * cookies) — never module-level singleton this.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component (not a Server Action or
            // Route Handler) — Next.js doesn't allow setting cookies
            // there. This is safe to ignore as long as the session
            // refresh in `src/middleware.ts` is also running, which
            // is what actually keeps the session alive across
            // requests. See Supabase's Next.js SSR docs.
          }
        },
      },
    },
  );
}
