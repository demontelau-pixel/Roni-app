import "server-only";
import { emptyAutoPolicyFacts } from "@/lib/wallet/schemas/auto-policy";
import type { DocumentTextResult } from "@/lib/services/document-text/types";
import type { PolicyExtractionResult } from "@/lib/services/policy-extraction/types";

/**
 * Shared by every `PolicyExtractionProvider` that starts from real
 * page text (`TextExtractionPolicyProvider`, `AnthropicExtractionProvider`):
 * maps a non-`"success"` `DocumentTextResult` to a safe, honest
 * `PolicyExtractionResult`, so this mapping — and the `extractedBy` tag
 * shape `extraction-message.ts` pattern-matches against — stays
 * identical across providers instead of drifting.
 *
 *   `"unavailable"`  -> `"needs_review"` (nothing was read; "Add
 *                       policy details" covers it)
 *   `"unreadable"`   -> `"failed"` (a real processing failure)
 *   `"ocr_required"` -> `"needs_review"` (a scanned document)
 */
export function nonSuccessExtractionResult(providerId: string, textResult: DocumentTextResult): PolicyExtractionResult {
  const extractionStatus = textResult.status === "unreadable" ? "failed" : "needs_review";
  return {
    facts: emptyAutoPolicyFacts(),
    evidence: [],
    extractionStatus,
    extractedBy: `${providerId}:${textResult.status}:${textResult.extractedBy}`,
    overallConfidence: null,
    roniSummary: null,
  };
}
