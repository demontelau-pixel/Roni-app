import "server-only";
import { PdfParseTextExtractor } from "@/lib/services/document-text/pdf-parse-extractor";
import { UnavailableDocumentTextExtractor } from "@/lib/services/document-text/unavailable-extractor";
import type { DocumentTextExtractor } from "@/lib/services/document-text/types";

export type {
  DocumentTextExtractor,
  DocumentTextExtractorInput,
  DocumentTextResult,
  DocumentTextStatus,
  ExtractedDocumentPage,
} from "@/lib/services/document-text/types";

/**
 * The text extractor the app currently uses — swap this line (or set
 * `DOCUMENT_TEXT_EXTRACTOR=unavailable`), not the callers (same
 * pattern as `policyExtractionProvider` in
 * `lib/services/policy-extraction/index.ts`). `PdfParseTextExtractor`
 * already degrades to a safe `"unavailable"` result on its own if
 * `pdf-parse` can't be loaded, so this is the one real implementation
 * to reach for by default; the env override exists for the rare case
 * of wanting to force the safe no-op state (e.g. to verify the
 * Wallet's "provider not configured" UI path without uninstalling a
 * dependency). A future OCR-capable extractor would either replace
 * this line or be tried first, falling back to one of these two.
 */
function selectDocumentTextExtractor(): DocumentTextExtractor {
  if (process.env.DOCUMENT_TEXT_EXTRACTOR?.trim().toLowerCase() === "unavailable") {
    return new UnavailableDocumentTextExtractor();
  }
  return new PdfParseTextExtractor();
}

export const documentTextExtractor: DocumentTextExtractor = selectDocumentTextExtractor();
