import type { DocumentTextResult } from "@/lib/services/document-text/types";
import type { AutoPolicyFacts } from "@/lib/wallet/schemas/auto-policy";
import type { ExtractionStatus, WalletCategory } from "@/lib/wallet/types";

/**
 * The seam between "how a policy document gets read" and everything
 * downstream (the Wallet repository, the Policy Dashboard, Ask Roni
 * Policy Mode). Mirrors the pattern already established by
 * `InsuranceQuoteProvider` (`lib/services/quote-provider.ts`) and
 * `HealthQuoteProvider` (`lib/services/health-quote-provider.ts`):
 * one interface, one or more implementations behind it, swappable
 * without touching the callers.
 *
 * Only Auto (`AutoPolicyFacts`) is implemented today, per the M3.1–
 * M3.4 brief — `category` is threaded through so a future provider
 * that also handles Health/Home/etc. can dispatch on it without a
 * second interface, the way `InsuranceQuoteProvider.getOptions`
 * already dispatches on `PolicyCategory`.
 */
export interface PolicyExtractionInput {
  category: WalletCategory;
  policyId: string;
  documentId: string;
  /** The uploaded file's raw bytes, already downloaded from Storage by the caller — a provider never touches Storage itself. */
  fileBytes: Buffer;
  originalFilename: string | null;
  mimeType: string | null;
  /**
   * The job-runner (`lib/services/policy-extraction/job-runner.ts`)
   * runs `DocumentTextExtractor` exactly once per analysis attempt —
   * both to feed a provider's own supplementary-text pass AND to
   * independently verify the evidence a provider returns
   * (`verify-evidence.ts`) — and passes that single result here so no
   * provider needs to run `pdf-parse` a second time over the same
   * bytes. Optional and provider-owned as a fallback: a provider called
   * directly without a job-runner (e.g. from a test) still works by
   * running its own extractor when this is omitted.
   */
  precomputedTextResult?: DocumentTextResult;
}

/** One evidence citation a provider found while extracting — shaped for a direct pass to `saveExtractionEvidence` (`lib/wallet/repository.ts`) once `extractedDataId` is known. */
export interface PolicyExtractionEvidenceItem {
  /** Dot-path convention documented in `lib/wallet/annotate.ts` — e.g. `"coverages.collision.deductible"`. */
  fieldPath: string;
  valueText: string | null;
  confidence: number | null;
  pageNumber: number | null;
  snippet: string | null;
}

export interface PolicyExtractionResult {
  facts: AutoPolicyFacts;
  evidence: PolicyExtractionEvidenceItem[];
  extractionStatus: ExtractionStatus;
  /** Provenance string stored in `policy_extracted_data.extracted_by` — never fabricated, always names the real source (M3.0 §"other" note; M3.1–M3.4 brief principle 8). */
  extractedBy: string;
  overallConfidence: number | null;
  /**
   * A plain-language, factual summary derived ONLY from `facts` above
   * — AI analysis, never a source of new facts itself (M3.2 principle
   * 2 / M3.3 §2 "RONI SUMMARY"). Stored in its own column
   * (`policy_extracted_data.roni_summary`), never folded into `facts`
   * — see `supabase/migrations/0005_policy_extraction_summary.sql`.
   * `null` when a provider has nothing to summarize (no facts found)
   * or doesn't produce one at all.
   */
  roniSummary: string | null;
}

export interface PolicyExtractionProvider {
  /** A stable id for this implementation, used as a prefix for `extractedBy` so the Policy Dashboard and Ask Roni can always say plainly where a fact came from. */
  readonly id: string;
  extractPolicyDocument(input: PolicyExtractionInput): Promise<PolicyExtractionResult>;
}
