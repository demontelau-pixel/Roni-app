import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";
import { WalletRepositoryError } from "@/lib/wallet/repository";
import { enqueueAnalysis } from "@/lib/services/policy-extraction/job-runner";

/**
 * RONI Bloque 1 (corrección) — enqueues analysis for a document that
 * has ALREADY been uploaded directly to private Storage. This route no
 * longer runs the extraction itself: it only records a `queued` job
 * (`enqueueAnalysis`) and returns immediately. The actual work happens
 * later, out of band, when `app/api/cron/process-analysis-jobs/route.ts`
 * next fires — see that route and `vercel.json` for the schedule this
 * depends on, and `job-status/route.ts` for how the Wallet UI finds out
 * when it's done.
 *
 * `enqueueAnalysis` (`lib/services/policy-extraction/job-runner.ts`) is
 * what actually checks ownership (RLS + explicit `policy_id` match)
 * before doing anything with the document — this route is a thin
 * authentication + params wrapper around it, same function the
 * "Retry analysis" Server Action calls, so the two entry points can't
 * drift out of sync with each other.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ policyId: string; documentId: string }> }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: { code: "unauthenticated", message: "Please sign in." } }, { status: 401 });
  }

  const { policyId, documentId } = await params;
  const supabase = await createClient();

  try {
    const result = await enqueueAnalysis(supabase, { policyId, documentId });

    if (result.outcome === "already_in_progress") {
      return NextResponse.json({ ok: true, data: { status: "already_in_progress", jobStatus: result.job.status } });
    }
    if (result.outcome === "attempt_limit_reached") {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "attempt_limit_reached",
            message: "This document has already reached the maximum number of analysis attempts.",
          },
        },
        { status: 429 },
      );
    }

    return NextResponse.json({ ok: true, data: { status: "queued", jobStatus: result.job.status } });
  } catch (error) {
    const message = error instanceof WalletRepositoryError ? "That document could not be found." : "Something went wrong while queuing that document for analysis.";
    return NextResponse.json({ ok: false, error: { code: "analyze_failed", message } }, { status: error instanceof WalletRepositoryError ? 404 : 500 });
  }
}
