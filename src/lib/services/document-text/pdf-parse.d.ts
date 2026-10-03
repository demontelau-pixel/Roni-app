/**
 * Minimal ambient type declaration for `pdf-parse` — this project
 * deliberately does NOT depend on `@types/pdf-parse` (a second,
 * separately-versioned package this sandbox has no way to install or
 * verify against) on top of `pdf-parse` itself. This declares only
 * the small surface `pdf-parse-extractor.ts` actually calls, matching
 * `pdf-parse`'s documented (CommonJS, `module.exports = fn`) API.
 *
 * `pageData` in `PdfParsePageRenderer` is intentionally `unknown`
 * rather than a fully-typed `pdf.js` page proxy — `pdf-parse` doesn't
 * export that type, and hand-rolling it here would be guessing at an
 * internal shape of a transitive dependency. `pdf-parse-extractor.ts`
 * narrows it with a runtime check before calling `getTextContent()`.
 */
declare module "pdf-parse" {
  export interface PdfParseResult {
    numpages: number;
    numrender: number;
    text: string;
    info: unknown;
    metadata: unknown;
    version: string;
  }

  export type PdfParsePageRenderer = (pageData: unknown) => Promise<string>;

  export interface PdfParseOptions {
    pagerender?: PdfParsePageRenderer;
    max?: number;
  }

  function pdfParse(dataBuffer: Buffer, options?: PdfParseOptions): Promise<PdfParseResult>;
  export default pdfParse;
}
