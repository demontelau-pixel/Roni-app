import { NextResponse } from "next/server";
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
