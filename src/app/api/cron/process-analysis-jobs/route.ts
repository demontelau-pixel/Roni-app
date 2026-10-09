import { NextResponse } from "next/server";
import { verifyGitHubActionsOidc } from "@/lib/auth/github-actions-oidc";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runCronTick } from "@/lib/services/policy-extraction/job-runner";

export const runtime = "nodejs";
/** Vercel Pro/Hobby maximum supported duration; processQueuedJob remains bounded to three sequential jobs. */
export const maxDuration = 300;

/**
 * Durable worker endpoint for queued policy analyses.
 *
 * Preferred authentication is a short-lived GitHub Actions OIDC token. The
 * route verifies the token's signature, issuer, audience, repository, and the
 * exact scheduled workflow on main, so no CRON_SECRET has to be copied between
 * GitHub and Vercel. A legacy CRON_SECRET remains supported only for existing
 * manual or third-party schedulers during migration.
 */
export async function POST(request: Request) {
  return handleCronRequest(request);
}

/** Vercel's native Cron uses GET; accepting it preserves a future Vercel Cron migration. */
export async function GET(request: Request) {
  return handleCronRequest(request);
}

function legacySecretMatches(request: Request): boolean {
  const legacySecret = process.env.CRON_SECRET;
  if (!legacySecret) return false;
  return request.headers.get("authorization") === `Bearer ${legacySecret}`;
}

async function authorized(request: Request): Promise<boolean> {
  if (legacySecretMatches(request)) return true;

  const oidc = await verifyGitHubActionsOidc(request);
  if (oidc.ok) return true;

  // Deliberately useful to restricted server logs but never reflected in the
  // HTTP response. It identifies the rejected authentication *category*
  // without logging a token, secret, claim payload, fingerprint, or document.
  console.error(`[cron/process-analysis-jobs] unauthorized: ${oidc.reason}`);
  return false;
}

async function handleCronRequest(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized." } }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleClient();
    const summary = await runCronTick(supabase);
    return NextResponse.json({ ok: true, data: summary });
  } catch (error) {
    // Never forward raw Storage, database, provider, or document errors.
    console.error("[cron/process-analysis-jobs] tick failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ ok: false, error: { code: "tick_failed", message: "The analysis job worker failed." } }, { status: 500 });
  }
}
