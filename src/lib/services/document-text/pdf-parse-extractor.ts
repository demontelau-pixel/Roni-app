import "server-only";
import type {
  DocumentTextExtractor,
  DocumentTextExtractorInput,
  DocumentTextResult,
  ExtractedDocumentPage,
} from "@/lib/services/document-text/types";

/**
 * The real `DocumentTextExtractor` (M3.2 brief: "If a reliable
 * server-side PDF text extraction library can be used now, implement
 * it"). Uses `pdf-parse` — a small, server-only wrapper around
 * Mozilla's `pdf.js` — with its `pagerender` hook so every extracted
 * character is attributed to the real page it came from. That per-
 * page attribution is the entire point: without it, evidence citations
 * (`"Source: Policy PDF · Page 6"`) would have to guess a page number,
 * which the brief explicitly forbids ("never fabricate... a page
 * number that doesn't exist").
 *
 * IMPORTANT — `pdf-parse` is imported dynamically (`await import(...)`)
 * rather than at module top level, for two independent reasons:
 *
 *   1. This module is an overlay patch dropped into an existing repo.
 *      Until `npm install` actually runs there, `pdf-parse` is not on
 *      disk — a static top-level `import "pdf-parse"` would make the
 *      whole app fail to build/boot the moment this file is touched
 *      anywhere in the import graph, even for requests that never
 *      extract a document. A dynamic import only fails *this* call,
 *      caught below, so the rest of the app is unaffected and the
 *      Wallet degrades to `"unavailable"` instead of crashing.
 *   2. Some versions of `pdf-parse` execute a demo/self-test file read
 *      at module-evaluation time when required in certain bundling
 *      setups (a known landmine in serverless environments, where that
 *      path doesn't exist). Dynamic, on-demand import means that code
 *      only ever runs inside this try/catch, at a time this function
 *      controls, never as a side effect of some unrelated route
 *      pulling in this file.
 *
 * This class never logs the PDF's bytes or extracted text (brief,
 * "SECURITY": "no PDF contents logged unnecessarily") — only counts
 * and the library's own error `.message` (never a full stack trace)
 * ever leave this function, and even that never reaches the person
 * (see `reason`'s doc comment on `DocumentTextResult`).
 */
export class PdfParseTextExtractor implements DocumentTextExtractor {
  readonly id = "pdf-parse";

  async extractText(input: DocumentTextExtractorInput): Promise<DocumentTextResult> {
    let pdfParse: (buf: Buffer, opts?: { pagerender?: (pageData: unknown) => Promise<string> }) => Promise<{ numpages: number; text: string }>;
    try {
      const mod = await import("pdf-parse");
      pdfParse = mod.default;
    } catch {
      // `pdf-parse` isn't installed (npm install hasn't run yet in the
      // repo this overlay was dropped into) or failed to load for some
      // other environment reason — never a crash, always the honest
      // "not available yet" state.
      return {
        status: "unavailable",
        pages: [],
        totalPages: null,
        extractedBy: this.id,
        reason: "The pdf-parse package is not installed. Run `npm install` to enable automatic PDF text extraction.",
      };
    }

    const pages: ExtractedDocumentPage[] = [];
    let pageCounter = 0;

    try {
      const result = await pdfParse(input.fileBytes, {
        pagerender: async (pageData: unknown) => {
          pageCounter += 1;
          const pageNumber = pageCounter;
          const text = await renderPageText(pageData);
          pages.push({ pageNumber, text });
          return text;
        },
      });

      const totalPages = result.numpages ?? pages.length;
      const totalTextLength = pages.reduce((sum, p) => sum + p.text.trim().length, 0);
      // A real digital policy PDF has hundreds of characters of body
      // text per page at minimum. A scanned/image-only PDF parses
      // "successfully" (pdf.js finds a valid page tree) but yields
      // little or no text layer — pdf-parse can't tell those apart on
      // its own, so this is the one heuristic in this file, and it
      // only ever downgrades a result to `"ocr_required"`; it never
      // upgrades one or invents text. 40 chars/page is deliberately
      // low (well below any real paragraph) so a document with even
      // sparse-but-real text is still treated as `"success"`.
      const looksScanned = totalPages > 0 && totalTextLength < totalPages * 40;

      if (looksScanned) {
        return {
          status: "ocr_required",
          pages: [],
          totalPages,
          extractedBy: this.id,
          reason: "This document appears to be a scanned image with no extractable text layer.",
        };
      }

      return {
        status: "success",
        pages,
        totalPages,
        extractedBy: this.id,
        reason: null,
      };
    } catch {
      // A real parse failure — corrupt file, password-protected,
      // not actually a PDF despite its extension/mime type, etc. The
      // library's own error text can include file-path or internal
      // details, so it is deliberately never forwarded here — only
      // this fixed, safe message is.
      return {
        status: "unreadable",
        pages: [],
        totalPages: null,
        extractedBy: this.id,
        reason: "This file could not be read as a PDF.",
      };
    }
  }
}

/** Concatenates one page's text items the way `pdf-parse`'s own default renderer does, inserting a newline where the text layer marks a line break so downstream regex matching isn't fighting run-on text. */
async function renderPageText(pageData: unknown): Promise<string> {
  if (!pageData || typeof pageData !== "object" || typeof (pageData as { getTextContent?: unknown }).getTextContent !== "function") {
    return "";
  }
  const textContent = await (pageData as { getTextContent: () => Promise<{ items: unknown[] }> }).getTextContent();
  let text = "";
  for (const raw of textContent.items) {
    const item = raw as { str?: unknown; hasEOL?: unknown };
    if (typeof item.str === "string") {
      text += item.str;
      text += item.hasEOL ? "\n" : " ";
    }
  }
  return text;
}
