import "server-only";
import { DevFallbackExtractionProvider } from "@/lib/services/policy-extraction/dev-fallback-provider";
import { TextExtractionPolicyProvider } from "@/lib/services/policy-extraction/text-extraction-provider";
import { AnthropicExtractionProvider } from "@/lib/services/policy-extraction/anthropic-provider";
import { PolicyExtractionService } from "@/lib/services/policy-extraction/service";
import type { PolicyExtractionInput, PolicyExtractionProvider, PolicyExtractionResult } from "@/lib/services/policy-extraction/types";

export type {
  PolicyExtractionEvidenceItem,
  PolicyExtractionInput,
  PolicyExtractionProvider,
  PolicyExtractionResult,
} from "@/lib/services/policy-extraction/types";
export { PolicyExtractionService } from "@/lib/services/policy-extraction/service";

/**
 * The provider the app currently uses — swap this line (or set
 * `POLICY_EXTRACTION_PROVIDER`), not the callers (same pattern as
 * `quoteProvider` in `lib/services/quote-provider.ts`).
 *
 *   - `"anthropic"` (default) — `AnthropicExtractionProvider`: sends
 *     the actual policy PDF to Claude as a native multimodal document
 *     (real page layout, tables, and columns — not flattened text),
 *     which is what real, accurate policy understanding depends on
 *     (a declarations page's coverage/limit/deductible/premium TABLE
 *     cannot be read correctly from flattened text alone — see this
 *     file's own extraction-quality history and `anthropic-provider.ts`'s
 *     class doc comment for the actual before/after example). Requires
 *     `ANTHROPIC_API_KEY` to be set server-side (see `.env.example`);
 *     with no key configured it degrades to the same safe,
 *     zero-network-call `"needs_review"` result as `dev-fallback`
 *     rather than failing or crashing the upload.
 *   - `"text-extract"` — `TextExtractionPolicyProvider`: real PDF text
 *     extraction (`pdf-parse`) + deterministic regex/keyword field
 *     extraction, no AI call at all. Kept as an explicit fallback (set
 *     `POLICY_EXTRACTION_PROVIDER=text-extract`) for an environment
 *     that deliberately can't or shouldn't call an external AI API.
 *   - `"dev-fallback"` — `DevFallbackExtractionProvider`: always
 *     returns empty facts and `"needs_review"`, no text extraction at
 *     all. Set `POLICY_EXTRACTION_PROVIDER=dev-fallback` to force this.
 *
 * A future real AI/OCR provider (a hosted OCR pipeline, a different
 * model vendor, etc.) is added as one more case here, implementing the
 * same `PolicyExtractionProvider` interface — nothing in
 * `PolicyExtractionService`, the upload route, the repository, or any
 * UI needs to change when that happens.
 */
function selectProvider(): PolicyExtractionProvider {
  const selected = process.env.POLICY_EXTRACTION_PROVIDER?.trim().toLowerCase();
  if (selected === "dev-fallback") return new DevFallbackExtractionProvider();
  if (selected === "text-extract") return new TextExtractionPolicyProvider();
  return new AnthropicExtractionProvider();
}

export const policyExtractionProvider: PolicyExtractionProvider = selectProvider();

/** The one orchestration entry point every caller uses — see `PolicyExtractionService` for what it adds on top of the raw provider (validation, crash-containment, confidence clamping). */
const policyExtractionService = new PolicyExtractionService(policyExtractionProvider);

/** Thin wrapper so callers (the upload route) depend on this module, not on `policyExtractionService`/`policyExtractionProvider` directly — matches `answerPolicyQuestion` in `lib/services/policy-qa/index.ts`. */
export async function extractPolicyDocument(input: PolicyExtractionInput): Promise<PolicyExtractionResult> {
  return policyExtractionService.run(input);
}
