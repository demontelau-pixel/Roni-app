import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runCronTick } from "@/lib/services/policy-extraction/job-runner";

/**
 * RONI Bloque 1 (corrección), fix #2 — the actual durable, independent
 * execution mechanism: something calls this route on its own schedule,
 * unrelated to any user's own request, and whatever work is queued
 * runs then. This is what "durable processing" means beyond just
 * persisting state: a `policy_analysis_jobs` row being `queued` is not
 * itself execution — THIS route, firing on a timer regardless of who's
 * using the app right now, is what actually runs it.
 *
 * WHO CALLS THIS ROUTE (Vercel Hobby plan): `vercel.json` deliberately
 * declares NO `crons` entry — Vercel's own native Cron feature only
 * runs once every 24 hours on the Hobby (free) plan, which is too slow
 * for a real upload-and-analyze flow, and anything more frequent there
 * requires Vercel Pro. Instead, this route is designed to be triggered
 * by any EXTERNAL scheduler — cron-job.org, a GitHub Actions scheduled
 * workflow, Upstash QStash's own scheduling feature, etc. — sending
 * `POST` (or `GET`) with `Authorization: Bearer <CRON_SECRET>` on
 * whatever interval you configure there. This route itself does not
 * know or care which mechanism calls it; see `.env.example`'s
 * "Durable analysis job worker" section for concrete setup for each
 * option. (If you later move to Vercel Pro and want Vercel's own Cron
 * instead, add a `crons` entry back to `vercel.json` — Vercel sends
 * this exact same `Authorization: Bearer <CRON_SECRET>` header
 * automatically, so nothing in this route needs to change.)
 *
 * REQUIRED SETUP (documented in full in the delivery report):
 *   - An external scheduler configured to call this route on an
 *     interval (every 1–5 minutes is reasonable) — see `.env.example`.
 *   - `CRON_SECRET` — a random secret, set in this app's own
 *     environment variables AND given to whichever external scheduler
 *     you configure, which must send it back as
 *     `Authorization: Bearer <CRON_SECRET>` on every call. Reject
 *     anything else so this route can't be triggered by an arbitrary
 *     outside request.
 *   - `SUPABASE_SERVICE_ROLE_KEY` — see `lib/supabase/service-role.ts`
 *     for exactly why this one route needs it and nowhere else does.
 *
 * AUTOMATIC RECOVERY: every tick starts by sweeping for `processing`
 * jobs that have gone stale (`runCronTick` -> `recoverStaleProcessingJobs`)
 * BEFORE claiming new work — so a job orphaned by a worker crash gets
 * closed out and (via a person's own next retry, or a future
 * automatic-requeue policy) eligible to run again, automatically, on
 * this same schedule, with no one needing to notice or click anything.
 */
export async function POST(request: Request) {
  return handleCronRequest(request);
}

/** Vercel Cron sends GET by default; accept both so this works whether `vercel.json` (or a manual trigger) uses GET or POST. */
export async function GET(request: Request) {
  return handleCronRequest(request);
}

const BEARER_PREFIX = "Bearer ";

/**
 * TEMPORARY DIAGNOSTIC — added to find why production kept returning 401
 * even after a confirmed fresh, cache-less redeploy (new build, not a
 * promote/rollback) with an updated `CRON_SECRET`. This exists ONLY to
 * tell "the two secrets are different strings" apart from "the header
 * never arrived / arrived malformed" — WITHOUT ever exposing either
 * secret. Remove this function, its one call site below, and the
 * `node:crypto` import once the real cause is found and fixed.
 *
 * What this logs, and ONLY to Vercel's own restricted function logs
 * (`console.error`, never in the HTTP response — the public 401 stays
 * exactly as generic as it always was):
 *   - the deployment's own git commit / Vercel URL / environment, if
 *     Vercel's system env vars expose them, so a log line can be tied
 *     to a specific deployment;
 *   - whether CRON_SECRET is present and its length (not its value);
 *   - whether it contains whitespace (a classic copy-paste artifact);
 *   - whether the Authorization header is present at all, and whether
 *     it has exactly the `Bearer ` prefix this route's own comparison
 *     requires;
 *   - the length of the token after that prefix (not the token);
 *   - a SHA-256 fingerprint of each secret/token, truncated to 8 hex
 *     chars — but ONLY when that string is at least 32 characters long.
 *     A real `CRON_SECRET` is 64 hex chars (32 bytes of entropy from
 *     `openssl rand -hex 32`), so this always fires for a real secret;
 *     it's skipped below that length specifically so this can never be
 *     used to help brute-force a short/weak value.
 *
 * Two equal secrets always produce the same 8-char fingerprint; two
 * different secrets produce different fingerprints with overwhelming
 * probability. Comparing `expectedSecret.fingerprint` to
 * `receivedAuth.tokenFingerprint` in the log line is how this tells
 * "different value" apart from "header missing/malformed" without
 * either value ever being printed.
 */
function logUnauthorizedDiagnostic(request: Request, expectedSecret: string): void {
  const authHeader = request.headers.get("authorization");
  const hasExpectedBearerPrefix = authHeader !== null && authHeader.startsWith(BEARER_PREFIX);
  const token = hasExpectedBearerPrefix ? authHeader.slice(BEARER_PREFIX.length) : null;

  const fingerprint = (value: string): string => {
    if (value.length < 32) return "omitted-too-short";
    return createHash("sha256").update(value).digest("hex").slice(0, 8);
  };

  console.error(
    "[cron-diag:unauthorized]",
    JSON.stringify({
      deployment: {
        commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        commitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
        vercelUrl: process.env.VERCEL_URL ?? null,
        env: process.env.VERCEL_ENV ?? null,
      },
      expectedSecret: {
        present: expectedSecret.length > 0,
        length: expectedSecret.length,
        hasWhitespace: /\s/.test(expectedSecret),
        fingerprint: fingerprint(expectedSecret),
      },
      receivedAuth: {
        headerPresent: authHeader !== null,
        hasExpectedBearerPrefix,
        tokenLength: token === null ? null : token.length,
        tokenHasWhitespace: token === null ? null : /\s/.test(token),
        tokenFingerprint: token === null ? null : fingerprint(token),
      },
    }),
  );
}

async function handleCronRequest(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    // Fails CLOSED — never runs the job worker with no secret
    // configured, which would otherwise mean anyone who finds this URL
    // could trigger the AI provider repeatedly at this app's expense.
    return NextResponse.json({ ok: false, error: { code: "not_configured", message: "CRON_SECRET is not set." } }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${expectedSecret}`) {
    // TEMPORARY — see logUnauthorizedDiagnostic's own doc comment above.
    // The public response below is completely unchanged: still generic,
    // still 401, still reveals nothing. Only Vercel's own restricted
    // function logs get the extra (non-sensitive) detail.
    logUnauthorizedDiagnostic(request, expectedSecret);
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized." } }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleClient();
    const summary = await runCronTick(supabase);
    return NextResponse.json({ ok: true, data: summary });
  } catch (error) {
    // Never forward the raw error (could include Storage/DB internals)
    // — Vercel Cron logs the response status/body, which is enough to
    // notice a failing tick without leaking anything sensitive there.
    console.error("[cron/process-analysis-jobs] tick failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ ok: false, error: { code: "tick_failed", message: "The analysis job worker failed." } }, { status: 500 });
  }
}
