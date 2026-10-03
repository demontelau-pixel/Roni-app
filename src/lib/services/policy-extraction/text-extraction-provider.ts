import "server-only";
import { documentTextExtractor } from "@/lib/services/document-text";
import type { DocumentTextExtractor } from "@/lib/services/document-text/types";
import { deriveOverallConfidence } from "@/lib/services/policy-extraction/confidence";
import { extractAutoPolicyFactsFromPages } from "@/lib/services/policy-extraction/text-field-extractor";
import { nonSuccessExtractionResult } from "@/lib/services/policy-extraction/text-status";
import { summarizeAutoPolicyFacts } from "@/lib/services/policy-extraction/summarize-auto-facts";
import type { PolicyExtractionInput, PolicyExtractionProvider, PolicyExtractionResult } from "@/lib/services/policy-extraction/types";

/**
 * The real, non-AI `PolicyExtractionProvider` (M3.2). Composes the two
 * lower layers the brief asks for: `DocumentTextExtractor` (turns the
 * PDF's bytes into real per-page text) and the regex/keyword field
 * extractor (turns that text into `AutoPolicyFacts` + evidence) —
 * neither of which this class knows the internals of, matching the
 * brief's "swap the PDF parser/OCR provider/AI model without
 * rewriting Wallet UI." A future AI-backed provider implements this
 * same `PolicyExtractionProvider` interface directly (it may still use
 * `DocumentTextExtractor` for the text, or read the PDF another way
 * entirely) and is swapped in at `lib/services/policy-extraction/index.ts`.
 *
 * Every non-`"success"` `DocumentTextResult` status maps to a safe,
 * honest `extractionStatus` — never a crash, never fabricated facts
 * (brief, "ERROR HANDLING"):
 *
 *   `"unavailable"`   -> `"needs_review"` (nothing was read; the
 *                        Policy Dashboard's "Add policy details"
 *                        fallback is exactly what covers this)
 *   `"unreadable"`    -> `"failed"` (the file itself couldn't be
 *                        parsed — this is a real processing failure,
 *                        not "found nothing")
 *   `"ocr_required"`  -> `"needs_review"` (a scanned document; the
 *                        Policy Dashboard's copy for this state names
 *                        OCR specifically — see `extractedBy`'s
 *                        `"ocr-required"` tag, read by
 *                        `lib/wallet/extraction-message.ts`)
 *   `"success"` but zero fields matched -> `"needs_review"` (real
 *                        text, but this heuristic extractor didn't
 *                        recognize anything in it — still not a
 *                        failure, just inconclusive)
 *   `"success"` with >=1 field matched -> `"complete"`
 */
export class TextExtractionPolicyProvider implements PolicyExtractionProvider {
  readonly id = "text-extract:regex-keyword";

  constructor(private readonly textExtractor: DocumentTextExtractor = documentTextExtractor) {}

  async extractPolicyDocument(input: PolicyExtractionInput): Promise<PolicyExtractionResult> {
    // Reused from the job-runner when available — see
    // `PolicyExtractionInput.precomputedTextResult`.
    const textResult =
      input.precomputedTextResult ?? (await this.textExtractor.extractText({ fileBytes: input.fileBytes, mimeType: input.mimeType }));

    if (textResult.status !== "success") {
      return nonSuccessExtractionResult(this.id, textResult);
    }

    const { facts, evidence } = extractAutoPolicyFactsFromPages(textResult.pages);
    const overallConfidence = deriveOverallConfidence(evidence.map((e) => e.confidence));

    return {
      facts,
      evidence,
      extractionStatus: evidence.length > 0 ? "complete" : "needs_review",
      extractedBy: `${this.id}:${textResult.extractedBy}`,
      overallConfidence,
      roniSummary: summarizeAutoPolicyFacts(facts),
    };
  }
}
