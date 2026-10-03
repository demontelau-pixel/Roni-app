import "server-only";
import type { DocumentTextExtractor, DocumentTextExtractorInput, DocumentTextResult } from "@/lib/services/document-text/types";

/**
 * The safe "provider not configured" state for the text-extraction
 * layer (brief, "DOCUMENT EXTRACTION ARCHITECTURE": "provide a safe
 * 'provider not configured' state"). Used when no real text extractor
 * can run at all — today that only happens if `pdf-parse` itself
 * cannot be loaded (see `pdf-parse-extractor.ts`'s own dynamic-import
 * fallback, which returns this same shape inline); kept as a standalone
 * class too so `index.ts` always has an unconditionally safe extractor
 * to fall back to, never a thrown exception.
 *
 * Never fabricates pages or text — `pages` is always `[]`.
 */
export class UnavailableDocumentTextExtractor implements DocumentTextExtractor {
  readonly id = "unavailable";

  async extractText(_input: DocumentTextExtractorInput): Promise<DocumentTextResult> {
    void _input;
    return {
      status: "unavailable",
      pages: [],
      totalPages: null,
      extractedBy: this.id,
      reason: "No PDF text-extraction library is available in this environment yet.",
    };
  }
}
