/**
 * Confidence bucketing (M3.2 brief, "CONFIDENCE"):
 *
 *   >= 0.90  high confidence
 *   0.70–0.89 medium confidence
 *   < 0.70   needs review
 *
 * Used by the Policy Dashboard to flag a low-confidence *important*
 * fact as needing review (brief: "Low-confidence important facts
 * should be visually identifiable as requiring review") and by
 * `deriveOverallConfidence` below for the one overall-confidence
 * method this app uses. Never invents a confidence for a field that
 * has none — `bucketConfidence(null)` is `null`, not a guessed band.
 */
export type ConfidenceBand = "high" | "medium" | "needs_review";

export function bucketConfidence(confidence: number | null | undefined): ConfidenceBand | null {
  if (confidence === null || confidence === undefined || !Number.isFinite(confidence)) return null;
  if (confidence >= 0.9) return "high";
  if (confidence >= 0.7) return "medium";
  return "needs_review";
}

/**
 * The one, explicit method this app uses to roll many per-field
 * confidences into a single `policy_extracted_data.overall_confidence`
 * (brief: "Overall extraction confidence may be derived only if the
 * method is explicit and reasonable" — so this is it, named and
 * documented rather than left implicit): the plain mean of every
 * field confidence the provider actually reported. Fields with no
 * confidence (manually entered, or a provider that doesn't score
 * itself) are excluded from the average rather than counted as 0 —
 * an unscored fact isn't evidence the extraction as a whole was
 * unreliable, it's just silent on the question. Returns `null` when
 * there is nothing to average, never a fabricated number.
 */
export function deriveOverallConfidence(confidences: ReadonlyArray<number | null>): number | null {
  const scored = confidences.filter((c): c is number => c !== null && Number.isFinite(c));
  if (scored.length === 0) return null;
  const mean = scored.reduce((sum, c) => sum + c, 0) / scored.length;
  return Math.round(mean * 100) / 100;
}
