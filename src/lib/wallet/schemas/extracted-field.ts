/**
 * The UI-facing wrapper the M3.1–M3.4 brief asks for:
 *
 *   type ExtractedField<T> = {
 *     value: T | null;
 *     confidence: number | null;
 *     sourcePage: number | null;
 *     sourceText?: string | null;
 *     evidenceVerified: boolean | null;
 *   };
 *
 * This is deliberately NOT how facts are stored. `policy_extracted_data.data`
 * (M3.0, migration 0002) stores the plain `AutoPolicyFacts` shape —
 * one JSONB blob, no per-field wrapper — because that is what the
 * repository layer, the `AutoPolicyFacts` schema, and the DB comments
 * were already built around, and rewriting that storage shape now
 * would touch working M3.0 infrastructure for no functional gain: a
 * per-field wrapper buys nothing in the database, where fields are
 * read and written as a whole document.
 *
 * Where the wrapper earns its keep is the *display* layer: a
 * component rendering "Collision deductible" wants the value AND its
 * confidence AND its citation together, without a bespoke join per
 * field. `lib/wallet/annotate.ts` builds exactly that view on demand,
 * by combining an `AutoPolicyFacts` object with its sibling
 * `ExtractionEvidence[]` rows (`policy_extracted_data_evidence`,
 * looked up by `fieldPath`) — see that file for the mapping. Nothing
 * about this reconciliation changes migrations 0001–0003 or the
 * existing `AutoPolicyFacts` schema.
 */
export interface ExtractedField<T> {
  value: T | null;
  /** As declared BY THE MODEL — display only, never treated as proof this citation is accurate. See `evidenceVerified` for what this app itself independently confirmed. */
  confidence: number | null;
  sourcePage: number | null;
  sourceText?: string | null;
  /**
   * RONI Bloque 1 (corrección) — whether BOTH independent checks
   * (`isEvidenceVerified`, `lib/wallet/types.ts`) passed for this
   * field's citation: the cited page is real and in range, AND the
   * cited snippet was actually found on it, per this app's own
   * `pdf-parse`/OCR text — never per the model's own say-so. `null`
   * when there's no citation to verify at all (`sourcePage === null`).
   * A UI must never render `sourcePage`/`sourceText` as if they were
   * confirmed unless this is `true`.
   */
  evidenceVerified: boolean | null;
}

/** An `ExtractedField` with no evidence behind it — the default for any fact that has no matching row in `policy_extracted_data_evidence`. */
export function unsourcedField<T>(value: T | null): ExtractedField<T> {
  return { value, confidence: null, sourcePage: null, sourceText: null, evidenceVerified: null };
}
