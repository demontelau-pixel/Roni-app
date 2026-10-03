/**
 * The lowest layer of the M3.2 extraction pipeline (brief,
 * "DOCUMENT EXTRACTION ARCHITECTURE" — `DocumentTextExtractor`): turns
 * the raw bytes of an uploaded policy document into per-page plain
 * text. Nothing above this layer (the field extractor in
 * `lib/services/policy-extraction/`, the Policy Dashboard, Ask Roni)
 * ever parses a PDF itself — they all go through this interface, so
 * the actual PDF/OCR library underneath can be swapped (a different
 * parser, a real OCR provider for scanned documents) without touching
 * anything else.
 *
 * This is deliberately a separate seam from `PolicyExtractionProvider`
 * (`lib/services/policy-extraction/types.ts`): that layer turns text
 * into normalized `AutoPolicyFacts`; this layer only turns bytes into
 * text. A future OCR-backed extractor, or a future AI provider that
 * reads the PDF directly (e.g. a multimodal model) without needing
 * this text layer at all, both fit cleanly on either side of this
 * boundary without the other needing to change.
 */

/**
 * What actually happened when this extractor tried to read the
 * document — never collapsed into a single "did it work" boolean,
 * because the Policy Dashboard and the upload flow need to say
 * different, honest things for each (brief, "ERROR HANDLING"):
 *
 *   - `"success"`        — real text was found; `pages` is populated.
 *   - `"ocr_required"`   — the document parsed, but it has little or
 *                          no extractable text (a scanned/image-only
 *                          PDF) — text extraction did NOT succeed, so
 *                          `pages` stays empty rather than reporting
 *                          success with near-nothing in it.
 *   - `"unreadable"`     — the file could not be parsed as a PDF at
 *                          all (corrupt, password-protected, not
 *                          actually a PDF despite its extension).
 *   - `"unavailable"`    — no working text-extraction library is
 *                          available in this environment right now
 *                          (e.g. `pdf-parse` hasn't been installed
 *                          yet) — this is the "provider not
 *                          configured" state the brief asks for,
 *                          applied to this layer.
 */
export type DocumentTextStatus = "success" | "ocr_required" | "unreadable" | "unavailable";

export interface ExtractedDocumentPage {
  /** 1-based, matching how a person reads and cites a page in a real document. */
  pageNumber: number;
  text: string;
}

export interface DocumentTextResult {
  status: DocumentTextStatus;
  /** Always `[]` unless `status === "success"`. */
  pages: ExtractedDocumentPage[];
  /** The document's page count, when the library can report it even on a non-`"success"` result (e.g. a scanned PDF still has a known page count). `null` when not knowable. */
  totalPages: number | null;
  /** Which extractor produced this result, e.g. `"pdf-parse"` — stored as part of `extractedBy` upstream so nothing downstream has to guess where the text came from. */
  extractedBy: string;
  /** A short, user-safe reason for a non-`"success"` status — never a raw error message or stack trace (brief, "SECURITY": "no PDF contents logged unnecessarily," and "ERROR HANDLING": "never expose raw secrets or internal stack traces"). `null` on success. */
  reason: string | null;
}

export interface DocumentTextExtractorInput {
  fileBytes: Buffer;
  mimeType: string | null;
}

export interface DocumentTextExtractor {
  /** A stable id for this implementation — folded into `DocumentTextResult.extractedBy`. */
  readonly id: string;
  extractText(input: DocumentTextExtractorInput): Promise<DocumentTextResult>;
}
