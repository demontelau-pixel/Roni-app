import type { ExtractionStatus } from "@/lib/wallet/types";

/**
 * The user-facing processing state the M3.1 brief asks for
 * ("uploading / processing / ready / failed"). `"uploading"` is
 * purely a client-side, in-flight-request state — nothing is
 * persisted for it, since the upload and the (synchronous, dev-
 * fallback) extraction both happen within one request/response
 * cycle today (see `/wallet/upload`'s `UploadForm`). Everything else
 * is derived from the latest `policy_extracted_data.extraction_status`
 * row, so a future *asynchronous* real provider — one that answers
 * the upload request immediately with `"pending"`/`"processing"` and
 * finishes the actual extraction later — needs no new states here and
 * no UI redesign, only a client that polls `/wallet/[policyId]` (or a
 * dedicated status endpoint) until this function returns `"ready"` or
 * `"failed"`.
 */
export type WalletProcessingState = "uploading" | "processing" | "ready" | "failed" | "needs_review" | "no_documents";

export function deriveProcessingState(latestExtractionStatus: ExtractionStatus | null): WalletProcessingState {
  if (latestExtractionStatus === null) return "no_documents";
  switch (latestExtractionStatus) {
    case "pending":
    case "processing":
      return "processing";
    case "complete":
      return "ready";
    case "failed":
      return "failed";
    case "needs_review":
      return "needs_review";
  }
}

export interface ProcessingStateDisplay {
  label: string;
  tone: "good" | "warn" | "grey" | "default";
}

/**
 * M3.3 §8 asks for this exact wording on the Policy Dashboard's status
 * banner: "Analyzing policy...", "Policy analyzed", "Some details need
 * review", "Scanned document — additional processing required",
 * "Analysis failed — retry". The first four map directly from
 * `WalletProcessingState`; the scanned-document case additionally
 * depends on `extractedBy` (a `"needs_review"` row from OCR-required
 * text is a different situation from one where the extractor just
 * didn't recognize anything) — see `policyStatusLabel` below, which is
 * what the Policy Dashboard actually renders.
 */
export function processingStateDisplay(state: WalletProcessingState): ProcessingStateDisplay {
  switch (state) {
    case "uploading":
      return { label: "Uploading…", tone: "grey" };
    case "processing":
      return { label: "Analyzing policy...", tone: "grey" };
    case "ready":
      return { label: "Policy analyzed", tone: "good" };
    case "failed":
      return { label: "Analysis failed — retry", tone: "warn" };
    case "needs_review":
      return { label: "Some details need review", tone: "warn" };
    case "no_documents":
      return { label: "No document yet", tone: "default" };
  }
}

/**
 * The label the Policy Dashboard's status pill actually renders —
 * `processingStateDisplay`'s label, except for the one case that needs
 * more than the bare `extraction_status` to describe accurately: a
 * scanned/OCR-required document is technically a `"needs_review"` row
 * (see `nonSuccessExtractionResult`, `lib/services/policy-extraction/text-status.ts`),
 * but "Some details need review" undersells it — the brief's own
 * wording for this specific case is "Scanned document — additional
 * processing required".
 */
export function policyStatusLabel(extractedBy: string | null, state: WalletProcessingState): ProcessingStateDisplay {
  if (state === "needs_review" && (extractedBy ?? "").includes("ocr_required")) {
    return { label: "Scanned document — additional processing required", tone: "warn" };
  }
  return processingStateDisplay(state);
}
