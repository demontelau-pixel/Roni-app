import type { WalletProcessingState } from "@/lib/wallet/processing-state";

/**
 * Maps an extraction's `extractedBy` provenance string (and its
 * processing state) to the exact, user-safe copy the M3.2 brief
 * specifies ("ERROR HANDLING"):
 *
 *   Unreadable PDF         -> "RONI couldn't read this document."
 *   Scanned document       -> "This policy may require OCR."
 *   AI provider unavailable -> "Automatic policy analysis is
 *                              temporarily unavailable."
 *   Extraction uncertain    -> "RONI found policy information that
 *                              needs your review."
 *
 * `extractedBy` is a plain provenance string (never a stack trace or
 * raw error), so this is a safe string to pattern-match against — see
 * `TextExtractionPolicyProvider`'s own doc comment for exactly which
 * strings it produces for each case. This function never surfaces
 * `extractedBy` itself to the person; it only reads it to choose one
 * of these four fixed, honest sentences (brief: "Never expose raw
 * secrets or internal stack traces to users").
 */
export interface ExtractionUserMessage {
  title: string;
  body: string;
}

export function extractionUserMessage(
  extractedBy: string | null,
  processingState: WalletProcessingState,
): ExtractionUserMessage | null {
  if (processingState !== "needs_review" && processingState !== "failed") return null;

  const by = extractedBy ?? "";

  if (by.includes("unreadable")) {
    return {
      title: "RONI couldn't read this document.",
      body: "The uploaded file couldn't be read as a policy PDF. You can try uploading it again, or add the policy's details yourself below.",
    };
  }

  if (by.includes("ocr_required")) {
    return {
      title: "This policy may require OCR.",
      body: "This document looks like a scanned image rather than searchable text, so RONI couldn't read it automatically. Add the policy's details yourself for now — OCR support is planned.",
    };
  }

  if (by.includes("unavailable") || by.includes("no-provider-configured") || by.includes("threw")) {
    return {
      title: "Automatic policy analysis is temporarily unavailable.",
      body: "Automatic extraction isn't configured in this environment right now, so nothing was guessed. Add the policy's details yourself and RONI will remember them.",
    };
  }

  return {
    title: "RONI found policy information that needs your review.",
    body: "RONI read this document but couldn't confidently determine some (or any) of its details. Review and fill in anything missing below.",
  };
}
