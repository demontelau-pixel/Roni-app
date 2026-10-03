import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  WalletRepositoryError,
  claimQueuedAnalysisJobs,
  createAnalysisJob,
  downloadPolicyDocumentBytesService,
  getActiveAnalysisJob,
  getLatestAnalysisJob,
  getPolicyDocument,
  getPolicyDocumentService,
  getPolicyService,
  recoverStaleProcessingJobs,
  saveExtractedPolicyDataService,
  saveExtractionEvidenceService,
  updateAnalysisJobService,
} from "@/lib/wallet/repository";
import { documentTextExtractor } from "@/lib/services/document-text";
import { extractPolicyDocument } from "@/lib/services/policy-extraction";
import { verifyEvidenceItems } from "@/lib/services/policy-extraction/verify-evidence";
import { emptyAutoPolicyFacts } from "@/lib/wallet/schemas/auto-policy";
import type { ExtractionStatus, PolicyAnalysisJob, PolicyDocument } from "@/lib/wallet/types";

type Client = Awaited<ReturnType<typeof createClient>>;
type ServiceClient = ReturnType<typeof createServiceRoleClient>;

/**
 * RONI Bloque 1 (corrección), fix #2 — split into two halves that run
 * in two genuinely different places:
 *
 *   - `enqueueAnalysis` (this file, below): called from the user's own
 *     RLS-scoped request (the analyze route, the retry action). It
 *     does the ownership check, the stale/duplicate/attempt-limit
 *     bookkeeping, and writes a `policy_analysis_jobs` row with
 *     `status: "queued"` — and returns immediately. It NEVER calls the
 *     AI provider itself and never blocks on it.
 *   - `processQueuedJob` (below): called ONLY from
 *     `app/api/cron/process-analysis-jobs/route.ts` — a worker route
 *     fired on its OWN schedule, by an external scheduler (see that
 *     route's header comment and `.env.example` — Vercel Hobby's own
 *     Cron feature only runs once/day, so `vercel.json` intentionally
 *     declares no `crons` entry here), completely independent of
 *     whoever uploaded or retried the document, and independent of
 *     that original request's lifetime. THIS is what makes analysis
 *     durable in the sense the reviewer asked for: a job's actual
 *     processing no longer happens "inside the HTTP request" at all —
 *     it happens whenever the next tick picks it up, which continues
 *     to happen even if the person who triggered it closes their
 *     browser, loses their connection, or the original request times
 *     out.
 *
 * See `app/api/cron/process-analysis-jobs/route.ts` and `.env.example`
 * for exactly how that tick gets triggered and the required
 * `CRON_SECRET` / `SUPABASE_SERVICE_ROLE_KEY` configuration this split
 * depends on — documented in full in the delivery report, since this
 * is new required infrastructure, not just new code.
 */
export const MAX_ANALYSIS_ATTEMPTS = 5;

/**
 * How long a `processing` job is trusted before the cron worker's own
 * recovery sweep (`recoverStaleProcessingJobs`) treats it as abandoned.
 * Comfortably above `REQUEST_TIMEOUT_MS` in `anthropic-provider.ts`
 * (90s) plus the rest of one job's own work (Storage download,
 * `pdf-parse`, saving rows).
 */
export const STALE_JOB_TIMEOUT_MS = 5 * 60 * 1000;

/** How many queued jobs one cron invocation claims and runs, sequentially, before returning — bounded so one invocation can't run past Vercel's own function-duration limit even on a plan with a short one. Tune alongside `vercel.json`'s cron interval: a lower limit here needs a shorter interval to keep up with upload volume. */
export const JOBS_PER_CRON_TICK = 3;

export type EnqueueAnalysisResult =
  | { outcome: "queued"; job: PolicyAnalysisJob }
  | { outcome: "already_in_progress"; job: PolicyAnalysisJob }
  | { outcome: "attempt_limit_reached"; attempts: number };

function isStale(job: PolicyAnalysisJob): boolean {
  const reference = job.startedAt ?? job.createdAt;
  const startedMs = Date.parse(reference);
  if (Number.isNaN(startedMs)) return true;
  return Date.now() - startedMs > STALE_JOB_TIMEOUT_MS;
}

/**
 * Called from a normal, RLS-scoped user request (the analyze route,
 * the retry action). Does everything that needs the user's own
 * session — ownership check, stale-job recovery for THIS document (so
 * a person isn't blocked waiting on a job the cron worker will also
 * eventually recover, but doesn't have to wait for that), attempt-limit
 * check, and finally records the new job as `queued`. Never calls the
 * AI provider and never downloads the file — that's `processQueuedJob`'s
 * job, run later by the cron worker.
 */
export async function enqueueAnalysis(supabase: Client, input: { policyId: string; documentId: string }): Promise<EnqueueAnalysisResult> {
  // OWNERSHIP CHECK: `getPolicyDocument` is both RLS-scoped AND carries
  // its own explicit `owner_user_id` filter — a documentId belonging to
  // another user, or that doesn't exist, resolves to `null` here.
  const document = await getPolicyDocument(supabase, input.documentId);
  if (!document || document.policyId !== input.policyId) {
    throw new WalletRepositoryError("That document does not exist or does not belong to this policy.");
  }

  const active = await getActiveAnalysisJob(supabase, input.documentId);
  if (active && !isStale(active)) {
    return { outcome: "already_in_progress", job: active };
  }
  // A stale active job for THIS document is left for the cron worker's
  // own `recoverStaleProcessingJobs` sweep to close out — it runs on
  // every tick regardless of whether anyone is looking at this policy
  // right now, so there's no need to duplicate that write here too.
  // `createAnalysisJob`'s unique index still protects against a race if
  // both happen to run at once.

  const previousLatest = await getLatestAnalysisJob(supabase, input.documentId);
  const attemptsSoFar = previousLatest?.attemptNumber ?? 0;
  if (attemptsSoFar >= MAX_ANALYSIS_ATTEMPTS) {
    return { outcome: "attempt_limit_reached", attempts: attemptsSoFar };
  }

  const created = await createAnalysisJob(supabase, { policyId: input.policyId, documentId: input.documentId });
  if (created.outcome === "already_in_progress") {
    return { outcome: "already_in_progress", job: created.job };
  }
  return { outcome: "queued", job: created.job };
}

/** `ExtractionStatus` values a provider can legitimately return (`"pending"`/`"processing"` never do) mapped onto `AnalysisJobStatus`. */
function toJobStatus(status: ExtractionStatus): "complete" | "failed" | "needs_review" {
  if (status === "complete" || status === "failed" || status === "needs_review") return status;
  return "needs_review";
}

class JobOwnershipError extends WalletRepositoryError {}

/**
 * The application-level half of the ownership guard (the database half
 * is migration 0009's trigger). A service-role client bypasses RLS
 * entirely — nothing stops it from reading or writing ANY row — so
 * this function is what makes the worker itself, independent of the
 * database, refuse to touch a policy or document that isn't really the
 * one this specific job names: it re-reads both rows fresh (never
 * trusting `job.policyId`/`job.documentId`/`job.ownerUserId` as given)
 * and confirms every cross-reference:
 *
 *   - the document named by `job.documentId` actually exists;
 *   - that document's own `policyId` equals `job.policyId`;
 *   - that document's own `ownerUserId` equals `job.ownerUserId`;
 *   - the policy named by `job.policyId` actually exists;
 *   - that policy's own `ownerUserId` equals `job.ownerUserId`.
 *
 * Migration 0009 already makes an inconsistent row impossible to write
 * in the first place — this is deliberate defense in depth, not
 * redundant: it also catches the case where the rows were consistent
 * when the job was created but a later, unrelated change (a policy
 * transferred, a document deleted and its id reused by nothing — not
 * possible today, but this function doesn't assume that stays true
 * forever) would otherwise let a worker process the wrong person's
 * data. On any mismatch this throws `JobOwnershipError`, which
 * `processQueuedJob` turns into a `failed` job with a safe, specific
 * `error_reason` — never a silent skip and never processing anyway.
 */
async function assertJobOwnership(supabase: ServiceClient, job: PolicyAnalysisJob): Promise<{ document: PolicyDocument }> {
  const document = await getPolicyDocumentService(supabase, job.documentId);
  if (!document) {
    throw new JobOwnershipError(`Job ${job.id}: document ${job.documentId} does not exist.`);
  }
  if (document.policyId !== job.policyId) {
    throw new JobOwnershipError(`Job ${job.id}: document ${job.documentId} belongs to a different policy than this job names.`);
  }
  if (document.ownerUserId !== job.ownerUserId) {
    throw new JobOwnershipError(`Job ${job.id}: document ${job.documentId} is not owned by this job's own owner_user_id.`);
  }

  const policy = await getPolicyService(supabase, job.policyId);
  if (!policy) {
    throw new JobOwnershipError(`Job ${job.id}: policy ${job.policyId} does not exist.`);
  }
  if (policy.ownerUserId !== job.ownerUserId) {
    throw new JobOwnershipError(`Job ${job.id}: policy ${job.policyId} is not owned by this job's own owner_user_id.`);
  }

  return { document };
}

/**
 * Runs ONE already-claimed job to completion. Called only by the cron
 * worker (`app/api/cron/process-analysis-jobs/route.ts`), on a
 * service-role client, for a job `claimQueuedAnalysisJobs` has already
 * atomically flipped to `"processing"` — this function's only
 * remaining responsibility is re-validating ownership
 * (`assertJobOwnership`), then doing the actual work and recording the
 * outcome, never claiming or re-claiming.
 */
export async function processQueuedJob(supabase: ServiceClient, job: PolicyAnalysisJob): Promise<void> {
  try {
    const { document } = await assertJobOwnership(supabase, job);
    const fileBytes = await downloadPolicyDocumentBytesService(supabase, document);

    const textResult = await documentTextExtractor.extractText({
      fileBytes,
      mimeType: document.mimeType,
    });

    const extraction = await extractPolicyDocument({
      category: "auto",
      policyId: job.policyId,
      documentId: job.documentId,
      fileBytes,
      originalFilename: document.originalFilename,
      mimeType: document.mimeType,
      precomputedTextResult: textResult,
    });

    const verifiedEvidence = verifyEvidenceItems(extraction.evidence, textResult);

    const savedExtraction = await saveExtractedPolicyDataService(supabase, job.ownerUserId, {
      policyId: job.policyId,
      documentId: job.documentId,
      category: "auto",
      schemaVersion: extraction.facts.schemaVersion,
      data: extraction.facts,
      extractionStatus: extraction.extractionStatus,
      extractedBy: extraction.extractedBy,
      overallConfidence: extraction.overallConfidence,
      roniSummary: extraction.roniSummary,
    });

    await saveExtractionEvidenceService(
      supabase,
      job.ownerUserId,
      verifiedEvidence.map((item) => ({
        extractedDataId: savedExtraction.id,
        fieldPath: item.fieldPath,
        valueText: item.valueText,
        confidence: item.confidence,
        documentId: job.documentId,
        pageNumber: item.pageNumber,
        snippet: item.snippet,
        pageVerified: item.pageVerified,
        snippetVerified: item.snippetVerified,
      })),
    );

    await updateAnalysisJobService(supabase, job.id, {
      status: toJobStatus(extraction.extractionStatus),
      extractedDataId: savedExtraction.id,
      finishedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof JobOwnershipError) {
      // Never forward the detailed message (it names real ids) beyond
      // this server-side log line — `error_reason` on the row itself
      // stays the same safe, fixed tag as every other failure case.
      console.error("[job-runner] ownership mismatch:", error.message);

      // An ownership mismatch means this job's own policy_id/document_id/
      // owner_user_id did not cross-check against the real rows — i.e.
      // we can no longer trust that `job.ownerUserId` is actually who
      // should own a saved extraction, or that `job.policyId`/
      // `job.documentId` are the right place to attach one. Writing a
      // `policy_extracted_data` row here (even an empty "failed" one, as
      // every other error branch below does) would mean persisting data
      // keyed by references this function just determined it can't
      // trust. So: mark only the job itself as failed, save nothing, and
      // return — no `saveExtractedPolicyDataService` call at all.
      await updateAnalysisJobService(supabase, job.id, {
        status: "failed",
        errorReason: "ownership-mismatch",
        finishedAt: new Date().toISOString(),
        extractedDataId: null,
      }).catch(() => {
        // If even this fails, the job is left at `"processing"` — the
        // NEXT cron tick's `recoverStaleProcessingJobs` sweep is the
        // backstop that eventually closes it out once it goes stale.
      });
      return;
    }

    const errorReason = error instanceof WalletRepositoryError ? "storage-read-failed" : "processing-error";

    const failedExtraction = await saveExtractedPolicyDataService(supabase, job.ownerUserId, {
      policyId: job.policyId,
      documentId: job.documentId,
      category: "auto",
      schemaVersion: emptyAutoPolicyFacts().schemaVersion,
      data: emptyAutoPolicyFacts(),
      extractionStatus: "failed",
      extractedBy: "job-runner:threw",
      overallConfidence: null,
      roniSummary: null,
    }).catch(() => null);

    await updateAnalysisJobService(supabase, job.id, {
      status: "failed",
      errorReason,
      finishedAt: new Date().toISOString(),
      extractedDataId: failedExtraction?.id ?? null,
    }).catch(() => {
      // If even this fails, the job is left at `"processing"` — the
      // NEXT cron tick's `recoverStaleProcessingJobs` sweep is the
      // backstop that eventually closes it out once it goes stale.
    });
  }
}

export interface CronTickSummary {
  recoveredStaleJobs: number;
  claimedJobs: number;
}

/**
 * The entire body of one cron invocation
 * (`app/api/cron/process-analysis-jobs/route.ts`): recover anything
 * stuck across every user, then claim and run a small, bounded batch
 * of queued jobs. Kept here (rather than inline in the route) so it's
 * unit-testable independent of Next.js's route-handler plumbing.
 */
export async function runCronTick(supabase: ServiceClient): Promise<CronTickSummary> {
  const staleBefore = new Date(Date.now() - STALE_JOB_TIMEOUT_MS).toISOString();
  const recoveredStaleJobs = await recoverStaleProcessingJobs(supabase, staleBefore);

  const claimedJobs = await claimQueuedAnalysisJobs(supabase, JOBS_PER_CRON_TICK);
  for (const job of claimedJobs) {
    // Sequential, not `Promise.all` — bounds this invocation's total
    // network/CPU usage to roughly `JOBS_PER_CRON_TICK` times one
    // job's own worst case, which is what actually needs to stay under
    // Vercel's function-duration limit.
    await processQueuedJob(supabase, job);
  }

  return { recoveredStaleJobs, claimedJobs: claimedJobs.length };
}
