import type { AnnotatedAutoPolicyFacts } from "@/lib/wallet/annotate";

/**
 * The seam for "Ask Roni about this policy" (M3.3). Same swappable-
 * provider pattern as `PolicyExtractionProvider`
 * (`lib/services/policy-extraction/types.ts`) — a future real LLM
 * provider implements this same interface, prompted with the same
 * `PolicyQAContext`, and is swapped in at
 * `lib/services/policy-qa/index.ts` without the Ask Roni route or UI
 * changing.
 */
export interface PolicyQAContext {
  policyId: string;
  /** Already-annotated so a provider can read both a fact and its citation together — see `lib/wallet/annotate.ts`. */
  facts: AnnotatedAutoPolicyFacts;
  /** e.g. `"Progressive"` — used to build a citation label like "Progressive Auto Policy · Page 17". `null` when the carrier itself isn't known. */
  carrierLabel: string | null;
  question: string;
}

export interface PolicyQACitation {
  /** Human-readable citation, e.g. `"Progressive Auto Policy · Page 17"` or `"You told RONI this"` for a manually-entered fact with no page evidence. Never fabricated — only built from a real `sourcePage`/`extractedBy` on the field it backs. */
  label: string;
  pageNumber: number | null;
}

export interface PolicyQAAnswer {
  answerText: string;
  citations: PolicyQACitation[];
  /**
   * `true` only when the answer is actually backed by a known fact
   * (extracted or manually entered) — `false` for the "I couldn't
   * determine that from this policy" response and for any general,
   * non-policy-specific remark. The UI uses this to decide whether to
   * render citation chips at all.
   */
  grounded: boolean;
}

export interface PolicyQAProvider {
  readonly id: string;
  answer(context: PolicyQAContext): Promise<PolicyQAAnswer>;
}
