import "server-only";
import { sanitizeAutoPolicyFacts } from "@/lib/wallet/validate-auto-policy-facts";
import { emptyAutoPolicyFacts } from "@/lib/wallet/schemas/auto-policy";
import type {
  PolicyExtractionEvidenceItem,
  PolicyExtractionInput,
  PolicyExtractionProvider,
  PolicyExtractionResult,
} from "@/lib/services/policy-extraction/types";

/**
 * `PolicyExtractionService` — the orchestration layer the M3.2 brief
 * asks for. This is the ONE place that calls a `PolicyExtractionProvider`
 * and is the only thing the upload route (or any future background
 * job — see this file's own note below) talks to. It exists
 * separately from any one provider so the "never trust provider
 * output directly" rule (brief, "VALIDATION") is enforced exactly
 * once, for every provider, instead of being every provider's own
 * responsibility to remember:
 *
 *   1. runs the configured provider, containing any exception it
 *      throws into a safe `"failed"` result — a provider is never
 *      allowed to crash the upload route (brief: "Wallet must never
 *      crash because extraction failed");
 *   2. re-validates the provider's `facts` through
 *      `sanitizeAutoPolicyFacts` — even a "trusted" first-party
 *      provider's output is not exempt, so a future bug in a provider
 *      (or a future AI provider's malformed JSON) can't smuggle a
 *      wrongly-typed value, an invented enum, or an untyped extra key
 *      into the database as if it were validated;
 *   3. re-validates every evidence item's shape before it's allowed
 *      anywhere near `saveExtractionEvidence` — a malformed item is
 *      dropped rather than corrupting a row or crashing the save;
 *   4. clamps `overallConfidence` into `[0, 1]` (or `null`) rather
 *      than trusting a provider's arithmetic.
 *
 * FUTURE ASYNC PROCESSING (brief, "UPLOAD/PROCESSING FLOW": "if
 * processing cannot happen synchronously/safely in the current
 * environment, structure it so background processing can be added
 * later"): `run()` is a plain async function with no assumption that
 * its caller is an HTTP request — a future queue/background-job
 * handler can call the exact same method with the exact same
 * `PolicyExtractionInput` it already has (the document is already in
 * Storage by the time this runs); only the caller changes, not this
 * service or either layer beneath it.
 */
export class PolicyExtractionService {
  constructor(private readonly provider: PolicyExtractionProvider) {}

  async run(input: PolicyExtractionInput): Promise<PolicyExtractionResult> {
    let raw: PolicyExtractionResult;
    try {
      raw = await this.provider.extractPolicyDocument(input);
    } catch {
      // A provider threw instead of returning a result — treated
      // exactly like any other real processing failure, never
      // propagated up to crash the upload (brief: "Wallet must never
      // crash because extraction failed"). The thrown error itself is
      // never inspected or forwarded — it could contain document
      // contents or internal details (brief, "SECURITY").
      return {
        facts: emptyAutoPolicyFacts(),
        evidence: [],
        extractionStatus: "failed",
        extractedBy: `${this.provider.id}:threw`,
        overallConfidence: null,
        roniSummary: null,
      };
    }

    return {
      facts: sanitizeAutoPolicyFacts(raw.facts),
      evidence: sanitizeEvidenceItems(raw.evidence),
      extractionStatus: raw.extractionStatus,
      extractedBy: raw.extractedBy,
      overallConfidence: clampConfidence(raw.overallConfidence),
      roniSummary: sanitizeRoniSummary(raw.roniSummary),
    };
  }
}

/**
 * Same defensive spirit as the rest of this file's sanitizers: a
 * provider's `roniSummary` is untrusted output like any other field.
 * Only a non-empty string survives; anything else (wrong type, an
 * accidentally-empty string) becomes `null` rather than persisting a
 * blank or malformed "analysis" to the database. Capped at a generous
 * length so a misbehaving provider can't write an unbounded blob into
 * `policy_extracted_data.roni_summary`.
 */
function sanitizeRoniSummary(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > 4000 ? trimmed.slice(0, 4000) : trimmed;
}

function clampConfidence(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null;
}

/** Same defensive spirit as `sanitizeAutoPolicyFacts` (`lib/wallet/validate-auto-policy-facts.ts`), applied to evidence items instead of facts — a malformed item (wrong type, missing `fieldPath`) is dropped, never passed through to corrupt a row. */
function sanitizeEvidenceItems(items: unknown): PolicyExtractionEvidenceItem[] {
  if (!Array.isArray(items)) return [];
  const out: PolicyExtractionEvidenceItem[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    if (typeof item.fieldPath !== "string" || item.fieldPath.trim().length === 0) continue;
    out.push({
      fieldPath: item.fieldPath,
      valueText: typeof item.valueText === "string" ? item.valueText : null,
      confidence: clampConfidence(item.confidence),
      pageNumber: typeof item.pageNumber === "number" && Number.isInteger(item.pageNumber) && item.pageNumber > 0 ? item.pageNumber : null,
      snippet: typeof item.snippet === "string" ? item.snippet : null,
    });
  }
  return out;
}
