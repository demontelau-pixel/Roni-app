"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { getPolicy, getPolicyDocuments } from "@/lib/wallet/repository";
import { enqueueAnalysis } from "@/lib/services/policy-extraction/job-runner";

/**
 * "Retry analysis" (M3.3 §8/§9 — the Policy Dashboard's
 * "Analysis failed — retry" state needs an actual action behind it,
 * and re-running extraction is also how someone picks up a newly
 * configured AI provider without re-uploading their document).
 *
 * RONI Bloque 1 (corrección): this used to duplicate almost the entire
 * extraction+save+evidence pipeline that the upload route also ran
 * inline — two independent copies of the same logic that could (and
 * did) drift apart. Both now call the exact same `enqueueAnalysis`
 * (`lib/services/policy-extraction/job-runner.ts`), which only ever
 * records a `queued` job and returns — the actual analysis runs later,
 * out of band, when the Vercel Cron worker
 * (`app/api/cron/process-analysis-jobs/route.ts`) next fires. This is
 * also what makes a retry SAFE in a way a second inline copy of the old
 * code never was: it durably records the attempt before any AI
 * provider is ever called, refuses to queue a second concurrent attempt
 * for the same document (so mashing "Retry" twice can't trigger two AI
 * calls or two charges), and caps how many attempts one document can
 * ever accumulate.
 *
 * SECURITY: `getPolicy`/`getPolicyDocuments` are both RLS-scoped AND
 * carry the repository's own explicit `owner_user_id` filter (see
 * `lib/wallet/repository.ts`'s file-level note), and `enqueueAnalysis`
 * repeats an explicit ownership check of its own on the document right
 * before touching it — the same ownership-check pattern used by the
 * signed-url route and every other per-policy endpoint.
 *
 * This is a fresh, additive `policy_extracted_data` row like every
 * other extraction pass (never an overwrite) — a person's own manual
 * corrections are never destroyed by a retry (M3.3 §7); see
 * `getEffectiveAutoPolicyFacts`, which is what makes that true at read
 * time regardless of how many extraction rows pile up.
 */
export async function retryPolicyExtraction(policyId: string): Promise<void> {
  await requireUser(`/wallet/${policyId}`);
  const supabase = await createClient();

  const policy = await getPolicy(supabase, policyId);
  if (!policy) redirect("/wallet");

  const documents = await getPolicyDocuments(supabase, policyId);
  const mostRecentDocument = documents[0] ?? null;
  if (!mostRecentDocument) {
    // Nothing to re-analyze (a policy created purely from manual
    // entry, with no uploaded document) — quietly return to the
    // dashboard rather than erroring; there's no document-based
    // extraction to retry.
    redirect(`/wallet/${policyId}`);
  }

  // Every outcome here (queued, already in progress, or attempt limit
  // reached) is a normal, expected state — never surfaced to this
  // action's caller as an error. The Policy Dashboard's status poll
  // (`job-status/route.ts`, `AnalysisStatus.tsx`) is what shows the
  // actual outcome once the cron worker picks the job up — this action
  // only has to get it queued.
  await enqueueAnalysis(supabase, { policyId, documentId: mostRecentDocument.id }).catch(() => {
    // `enqueueAnalysis` only throws for "this document doesn't exist
    // or doesn't belong to you" — which can't actually happen here
    // since `mostRecentDocument` just came from this same user's own
    // RLS-scoped `getPolicyDocuments` call. Swallowed defensively
    // rather than crashing the redirect below.
  });

  redirect(`/wallet/${policyId}`);
}
