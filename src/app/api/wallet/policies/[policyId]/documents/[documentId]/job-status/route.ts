import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";
import { getLatestAnalysisJob, getPolicyDocument } from "@/lib/wallet/repository";

/**
 * RONI Bloque 1 (corrección), fix #3 — the "authorized status query"
 * the reviewer asked for: an RLS-scoped, per-user endpoint the Wallet
 * UI polls to show the REAL state of the current/most recent analysis
 * job for one document, instead of a fixed "please wait" spinner that
 * isn't actually connected to anything.
 *
 * AUTHORIZATION: same pattern as every other per-document endpoint in
 * this app (`signed-url/route.ts`, `analyze/route.ts`) —
 * `getPolicyDocument` is RLS-scoped AND carries its own explicit
 * `owner_user_id` check, so a request for a document id belonging to
 * another user (or that doesn't exist) is a 404, never a leak of that
 * job's status or existence.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ policyId: string; documentId: string }> }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: { code: "unauthenticated", message: "Please sign in." } }, { status: 401 });
  }

  const { policyId, documentId } = await params;
  const supabase = await createClient();

  const document = await getPolicyDocument(supabase, documentId);
  if (!document || document.policyId !== policyId) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Document not found." } }, { status: 404 });
  }

  const job = await getLatestAnalysisJob(supabase, documentId);
  if (!job) {
    return NextResponse.json({ ok: true, data: { job: null } });
  }

  return NextResponse.json({
    ok: true,
    data: {
      job: {
        status: job.status,
        attemptNumber: job.attemptNumber,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        errorReason: job.errorReason,
      },
    },
  });
}
