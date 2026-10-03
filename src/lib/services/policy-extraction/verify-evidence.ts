import "server-only";
import type { DocumentTextResult } from "@/lib/services/document-text/types";
import type { PolicyExtractionEvidenceItem } from "@/lib/services/policy-extraction/types";

/**
 * The ONLY place `pageVerified`/`snippetVerified` (migration 0007) are
 * ever computed. Deliberately NOT part of `AnthropicExtractionProvider`
 * or any other `PolicyExtractionProvider` — a provider's own output is
 * exactly what's being checked here, so it must never also be the thing
 * doing the checking. This runs strictly AFTER a provider has already
 * returned its `evidence` array, against this app's OWN independent
 * source of truth: the real page count and OCR text this app itself
 * extracted from the document (`DocumentTextExtractor`/`pdf-parse`) —
 * never anything the model claimed, and never the model's own
 * `confidence` value.
 *
 * Reviewer's requirement this exists to satisfy: "Las páginas y
 * fragmentos que devuelve la IA no deben presentarse automáticamente
 * como evidencia verificada... No uses la confianza declarada por el
 * modelo como prueba de exactitud."
 *
 * Both checks are three-state (`true` / `false` / `null`) and never
 * collapse "couldn't check" into "false" — see each function's doc
 * comment for exactly when `null` applies. `job-runner.ts` calls
 * `verifyEvidenceItems` once per analysis attempt, before evidence is
 * ever saved via `saveExtractionEvidence`.
 */
export interface VerifiedEvidenceItem extends PolicyExtractionEvidenceItem {
  pageVerified: boolean | null;
  snippetVerified: boolean | null;
}

/**
 * `true`  — `pageNumber` is a real, in-range page of this document,
 *           per this app's own independently-known page count.
 * `false` — `pageNumber` is out of range (e.g. the model cited page 12
 *           of a 6-page document) — a real, confirmed problem with the
 *           citation, not a missing check.
 * `null`  — either `pageNumber` itself is missing, or this document's
 *           real page count couldn't be determined at all (e.g.
 *           `pdf-parse` is unavailable, or the file was unreadable) —
 *           "we don't know," never defaulted to `true` or `false`.
 */
function verifyPage(pageNumber: number | null, totalPages: number | null): boolean | null {
  if (pageNumber === null) return null;
  if (totalPages === null) return null;
  if (!Number.isInteger(pageNumber) || pageNumber < 1) return false;
  return pageNumber <= totalPages;
}

/** Lowercases and collapses whitespace so a citation surviving a line-wrap or double-space difference still matches — this is intentionally forgiving about FORMATTING, never about the actual words. */
function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * `true`  — the cited snippet was actually found (formatting-insensitive,
 *           substring match) inside this app's own OCR text for the
 *           cited page.
 * `false` — this app has real OCR text for that page, and the snippet
 *           is genuinely not in it — a real, confirmed mismatch.
 * `null`  — there is no OCR text for that page to check the snippet
 *           against (no snippet cited, no page cited, the document's
 *           text extraction didn't succeed at all, or that specific
 *           page has no text — e.g. it was blank or image-only in an
 *           otherwise-readable document). This is NOT the same claim as
 *           `false`: the underlying fact can still be correct even when
 *           this app simply has no independent text to compare against.
 */
function verifySnippet(pageNumber: number | null, snippet: string | null, textResult: DocumentTextResult): boolean | null {
  if (pageNumber === null) return null;
  const trimmedSnippet = snippet?.trim();
  if (!trimmedSnippet) return null;
  if (textResult.status !== "success") return null;

  const page = textResult.pages.find((p) => p.pageNumber === pageNumber);
  if (!page || page.text.trim().length === 0) return null;

  return normalizeForMatch(page.text).includes(normalizeForMatch(trimmedSnippet));
}

/**
 * Runs both independent checks over a provider's raw evidence array.
 * Never mutates or re-derives `fieldPath`/`valueText`/`confidence` —
 * only adds the two new, server-computed fields.
 */
export function verifyEvidenceItems(
  items: PolicyExtractionEvidenceItem[],
  textResult: DocumentTextResult,
): VerifiedEvidenceItem[] {
  return items.map((item) => ({
    ...item,
    pageVerified: verifyPage(item.pageNumber, textResult.totalPages),
    snippetVerified: verifySnippet(item.pageNumber, item.snippet, textResult),
  }));
}
