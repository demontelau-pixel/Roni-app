import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * RONI Bloque 1 (corrección), fix #2 — the ONLY client in this app
 * built with the Supabase SECRET/service-role key, and used from
 * EXACTLY ONE place: `app/api/cron/process-analysis-jobs/route.ts`,
 * the Vercel Cron worker that runs analysis jobs independently of any
 * user's own HTTP request.
 *
 * WHY THIS IS NECESSARY (and not a step backward on this app's "RLS +
 * explicit owner check everywhere" rule): every other function in this
 * codebase runs on behalf of one signed-in user, using the request's
 * own session cookie (`lib/supabase/server.ts`) — that's what lets RLS
 * scope every query for free. A Vercel Cron invocation is NOT a user's
 * request: it has no session, no cookies, and legitimately needs to see
 * `policy_analysis_jobs` rows across every user to do its job (find
 * queued work, recover stale jobs) — RLS is specifically designed to
 * make that impossible for a normal client, so there is no RLS-scoped
 * way to do this at all.
 *
 * The trust boundary is: (1) `CRON_SECRET` gates who can invoke that
 * one route at all — see the route's own doc comment; (2) this client
 * is never imported anywhere else, so no normal request handler can
 * accidentally use it to bypass a user's own RLS; (3) the cron route
 * itself never accepts a caller-supplied user id or ownership claim —
 * every row it touches is one this app's own code already created via
 * the normal RLS-scoped path.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set to run the analysis-jobs cron worker.",
    );
  }
  return createSupabaseClient<Database>(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
