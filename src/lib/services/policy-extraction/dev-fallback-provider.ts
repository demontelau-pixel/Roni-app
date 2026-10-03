import "server-only";
import { emptyAutoPolicyFacts } from "@/lib/wallet/schemas/auto-policy";
import type { PolicyExtractionInput, PolicyExtractionProvider, PolicyExtractionResult } from "@/lib/services/policy-extraction/types";

/**
 * The dev/demo extraction adapter (M3.1–M3.4 brief, "DEVELOPMENT
 * FALLBACK"): this environment has no OCR/LLM provider configured
 * (no `POLICY_EXTRACTION_PROVIDER` credentials), so there is no way
 * to read a real fact out of the uploaded PDF without inventing one.
 * Per the brief's explicit rule — "do not present fabricated values
 * as real extraction" and "do not create fake evidence" — this
 * provider does neither:
 *
 *   - every fact comes back `null` (`emptyAutoPolicyFacts()` — never
 *     a guessed carrier, date, or amount);
 *   - it returns zero evidence citations (there is nothing it
 *     actually read, so there is nothing to cite);
 *   - `extractionStatus` is `"needs_review"`, the schema's own
 *     wording for "ran, found nothing usable, a person should look at
 *     this" (`extraction_status` check constraint, migration 0002) —
 *     not `"complete"`, which would imply the automatic pass
 *     succeeded;
 *   - `extractedBy` is prefixed `"dev-fallback:"` so nothing
 *     downstream (Policy Dashboard, Ask Roni, logs) can mistake this
 *     for a real provider's output.
 *
 * The Policy Dashboard's response to an empty, `needs_review`
 * extraction is to invite the person to fill in the policy's facts
 * themselves (`/wallet/[policyId]/facts`) — those become real facts
 * with `extractedBy: "manual"`, which this provider never sets, since
 * a person telling RONI what their own policy says is not the same
 * claim as RONI having read it there.
 *
 * A real provider (`POLICY_EXTRACTION_PROVIDER=openai:...`, a
 * self-hosted OCR pipeline, etc.) implements this same
 * `PolicyExtractionProvider` interface and is swapped in at
 * `lib/services/policy-extraction/index.ts` — nothing in the upload
 * route, the repository, or any UI needs to change when that happens.
 */
export class DevFallbackExtractionProvider implements PolicyExtractionProvider {
  readonly id = "dev-fallback:no-provider-configured";

  async extractPolicyDocument(_input: PolicyExtractionInput): Promise<PolicyExtractionResult> {
    void _input;
    return {
      facts: emptyAutoPolicyFacts(),
      evidence: [],
      extractionStatus: "needs_review",
      extractedBy: this.id,
      overallConfidence: null,
      roniSummary: null,
    };
  }
}
