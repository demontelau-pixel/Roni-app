import type { ExtractedField } from "@/lib/wallet/schemas/extracted-field";
import { bucketConfidence } from "@/lib/services/policy-extraction/confidence";

interface FactRowProps {
  label: string;
  /** A pre-formatted display string, or `null`/`undefined` to show "Not determined." */
  displayValue: string | null | undefined;
  /** When given, renders the field's citation (page or "You told RONI this") next to the value — see `lib/wallet/annotate.ts`. */
  field?: ExtractedField<unknown>;
}

/**
 * One line of the Policy Dashboard: a label, its value (or an honest
 * "Not determined" — brief principle 5), and, when available, where
 * that value came from. This is the one place that renders an
 * `ExtractedField`'s citation, so every dashboard section stays
 * consistent without repeating the same three-line JSX everywhere.
 *
 * RONI Bloque 1 (corrección), fix #3: a page citation is never shown as
 * plain fact — it's always labeled "Verified" or "Unverified reference"
 * based on `field.evidenceVerified`, which is computed server-side by
 * `verify-evidence.ts` against this app's own independent page count
 * and OCR text, never by the model's own `confidence`. A citation this
 * app couldn't independently confirm (or confirmed doesn't hold up)
 * reads as "Unverified reference," never silently presented the same
 * way as a confirmed one.
 *
 * Also the one place a low-confidence *important* fact becomes
 * visually identifiable as needing review (brief, "CONFIDENCE":
 * "Low-confidence important facts should be visually identifiable as
 * requiring review") — a small "Needs review" tag next to the
 * citation, shown only when the field actually has a value and a real
 * confidence score below the "medium" band (`bucketConfidence`,
 * `lib/services/policy-extraction/confidence.ts`). A manually-entered
 * fact has no confidence at all (`null`) and never gets this tag —
 * "the person told RONI this" isn't something to flag for review.
 */
export function FactRow({ label, displayValue, field }: FactRowProps) {
  let citation: string | null = null;
  let citationVerified: boolean | null = null;
  let needsReview = false;
  if (field && field.value !== null && field.value !== undefined) {
    if (field.sourcePage !== null) {
      citation = `Page ${field.sourcePage}`;
      citationVerified = field.evidenceVerified;
    } else {
      citation = "You told RONI this";
    }
    needsReview = bucketConfidence(field.confidence) === "needs_review";
  }

  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-right font-semibold">
        {displayValue ?? <span className="font-normal text-muted">Not determined</span>}
        {citation && <span className="ml-2 text-xs font-normal text-muted">· {citation}</span>}
        {citationVerified === true && (
          <span className="ml-2 rounded-full bg-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            Verified
          </span>
        )}
        {citationVerified === false && (
          <span className="ml-2 rounded-full bg-warnbg px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warn">
            Unverified reference
          </span>
        )}
        {needsReview && (
          <span className="ml-2 rounded-full bg-warnbg px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warn">
            Needs review
          </span>
        )}
      </span>
    </div>
  );
}
