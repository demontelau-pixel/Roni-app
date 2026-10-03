import "server-only";
import { documentTextExtractor } from "@/lib/services/document-text";
import type { DocumentTextExtractor, ExtractedDocumentPage } from "@/lib/services/document-text/types";
import { deriveOverallConfidence } from "@/lib/services/policy-extraction/confidence";
import { sanitizeAutoPolicyFacts } from "@/lib/wallet/validate-auto-policy-facts";
import { emptyAutoPolicyFacts } from "@/lib/wallet/schemas/auto-policy";
import type {
  PolicyExtractionEvidenceItem,
  PolicyExtractionInput,
  PolicyExtractionProvider,
  PolicyExtractionResult,
} from "@/lib/services/policy-extraction/types";

/**
 * The real, LLM-backed `PolicyExtractionProvider`.
 *
 * ARCHITECTURE (revised): sends the ACTUAL PDF to Claude as a native
 * `document` content block (Anthropic Messages API, generally
 * available on every current model — no beta header, no separate
 * OCR/vision pipeline to build or maintain) rather than a flattened
 * text dump. This is the fix for the real failure mode this system
 * shipped with: a declarations page lays facts out in a TABLE
 * (coverage name | limit | deductible | premium, in columns), and
 * flattening that table to a linear string of words interleaves a
 * coverage's limit with its premium and the next row's numbers —
 * `pdf-parse`'s own output for a real test policy read, in order:
 * "PROPERTY DAMAGE LIABILITY ... PERSONAL INJURY PROTECTION ...
 * DEDUCTIBLES ... $ /Accident ... SEMI-ANNUALIZED PREMIUMS ... 220
 * ... $10,000/Person ... 894" — the limit, deductible, and premium
 * for two different coverages, all run together with no column
 * boundary left. No prompt engineering over that text can reliably
 * recover which number belongs to which column; the table structure
 * itself has to survive to the model. Sending the real PDF (which
 * Claude reads as both text AND the actual laid-out page image) does
 * that directly, using a documented, current Anthropic capability
 * instead of custom table-reconstruction logic.
 *
 * `DocumentTextExtractor` (`lib/services/document-text/`) is still
 * used, but demoted to a SECONDARY, best-effort cross-reference layer
 * — its page-numbered plain text rides along as a supplementary
 * message block the system prompt explicitly tells the model to trust
 * LESS than the actual document for anything table-shaped, and to use
 * only for things like disambiguating an OCR-unfriendly character. If
 * text extraction fails entirely (a scanned policy, an encrypted-
 * looking PDF `pdf-parse` can't read), that no longer blocks real AI
 * extraction the way it used to — the document itself is still sent
 * and Claude can still read it visually. Page numbers in the
 * `evidence` array are the model's own, self-reported against the
 * actual PDF pages it was shown (1-based, exactly how a person would
 * cite "page 3" of the same document) — not derived from the text
 * layer, so a missing/failed text extraction doesn't create a mismatch
 * between the two.
 *
 * Calls the Anthropic Messages API directly via `fetch()` — no
 * `@anthropic-ai/sdk` dependency — using `tool_choice: {type: "auto"}`
 * plus a `strict: true` tool schema (with `additionalProperties: false`
 * on every object) so the reply, when the model does call the tool, is
 * schema-constrained JSON, never freeform prose to parse. (Anthropic's
 * document-citations feature was deliberately NOT used here — it's a
 * free-text/quote-the-source feature oriented at prose answers, its
 * interaction with strict structured tool use isn't documented, and
 * this pipeline's own `evidence` array already gets page-grounded
 * citations a different, already-validated way: the model self-reports
 * them as part of the same structured tool call.)
 *
 * NOTE ON `tool_choice` (checked against Claude Sonnet 5.5's own
 * migration guide before wiring up real API access): forced tool use
 * (`tool_choice: {type: "tool"|"any", ...}`) is REJECTED with a 400
 * error on Claude Sonnet 5.5 and later — only `{type: "auto"}` combined
 * with a `strict` tool is supported there. `{type: "auto"}` + `strict`
 * is also valid on Claude Sonnet 5 (both are on Anthropic's supported-
 * models list for structured outputs/strict tool use), so this one
 * code path works unmodified across both `ANTHROPIC_EXTRACTION_MODEL`
 * values instead of needing a model-version branch. Because
 * `tool_choice: "auto"` no longer GUARANTEES the model calls the tool,
 * `SYSTEM_PROMPT` below explicitly instructs it to always do so — and
 * if it doesn't (or the reply is otherwise malformed), that's still
 * just a `"no-tool-use-block"` -> safe `"failed"` result below, exactly
 * like every other error case here. Never a crash, never a fabricated
 * fact.
 *
 * GRACEFUL DEGRADATION (brief §4/§5: "If no AI provider is currently
 * configured, the app must continue functioning gracefully. Do not
 * invent results."): the `ANTHROPIC_API_KEY` presence check below
 * happens BEFORE the text extractor even runs, and before any network
 * call — an unconfigured environment makes zero outbound requests and
 * returns a safe, honestly-labeled `"needs_review"` result, the exact
 * shape `DevFallbackExtractionProvider` already returns.
 *
 * NEVER TRUSTED BLINDLY: this provider's raw model output is not
 * persisted directly — `PolicyExtractionService.run()` (the ONLY
 * caller of any provider) re-validates every field of `facts` through
 * `sanitizeAutoPolicyFacts` and every evidence item through its own
 * shape check, exactly as it does for every other provider. This
 * class additionally runs `sanitizeAutoPolicyFacts` itself before
 * returning, purely so a bad/malformed model response can't produce a
 * TypeScript type mismatch inside this file — the service's own pass
 * is what actually enforces the contract for persistence.
 */
export class AnthropicExtractionProvider implements PolicyExtractionProvider {
  readonly id = "anthropic:messages-api";

  constructor(
    private readonly textExtractor: DocumentTextExtractor = documentTextExtractor,
    private readonly apiKey: string | undefined = process.env.ANTHROPIC_API_KEY,
    private readonly model: string = process.env.ANTHROPIC_EXTRACTION_MODEL?.trim() || "claude-sonnet-5",
  ) {}

  async extractPolicyDocument(input: PolicyExtractionInput): Promise<PolicyExtractionResult> {
    // Presence check happens first and makes no network call either
    // way — an environment with no key configured behaves exactly
    // like `DevFallbackExtractionProvider`, never a crash and never a
    // fabricated result.
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      return {
        facts: emptyAutoPolicyFacts(),
        evidence: [],
        extractionStatus: "needs_review",
        extractedBy: `${this.id}:not-configured`,
        overallConfidence: null,
        roniSummary: null,
      };
    }

    // Upload validation (`lib/wallet/upload-validation.ts`) only
    // accepts `application/pdf` today — this provider's native-
    // document path depends on that being true. If it's ever loosened
    // to accept something else, fail safely here (a "needs_review" the
    // Policy Dashboard already knows how to show) instead of sending
    // the wrong media type to the API and getting a confusing 400.
    if (input.mimeType !== "application/pdf") {
      return {
        facts: emptyAutoPolicyFacts(),
        evidence: [],
        extractionStatus: "needs_review",
        extractedBy: `${this.id}:unsupported-mime-type`,
        overallConfidence: null,
        roniSummary: null,
      };
    }

    // Best-effort, SECONDARY signal only — see the class doc comment.
    // A failure here (scanned PDF, `pdf-parse` choking on this file)
    // does not stop extraction: the real PDF is still sent below.
    // Reused from the job-runner when available, so this doesn't run
    // `pdf-parse` a second time over bytes it already extracted once
    // (see `PolicyExtractionInput.precomputedTextResult`).
    const textResult =
      input.precomputedTextResult ?? (await this.textExtractor.extractText({ fileBytes: input.fileBytes, mimeType: input.mimeType }));
    const supplementaryPages = textResult.status === "success" ? textResult.pages : [];

    let raw: RawAnthropicExtraction;
    try {
      raw = await callAnthropicExtraction(this.apiKey, this.model, input.fileBytes, supplementaryPages);
    } catch (error) {
      // Network failure, timeout, non-2xx response, or a malformed/
      // missing tool-use reply. Never forwarded to the client or
      // logged with document contents (brief §11/§12, "SECURITY" /
      // "ERROR HANDLING") — just a short, server-side diagnostic tag.
      const reason = error instanceof AnthropicExtractionError ? error.reason : "unknown";
      console.error(`[policy-extraction] anthropic provider failed: ${reason}`);
      return {
        facts: emptyAutoPolicyFacts(),
        evidence: [],
        extractionStatus: "failed",
        extractedBy: `${this.id}:${reason}`,
        overallConfidence: null,
        roniSummary: null,
      };
    }

    const facts = sanitizeAutoPolicyFacts(raw.facts);
    const evidence = sanitizeEvidence(raw.evidence);
    const overallConfidence = deriveOverallConfidence(evidence.map((e) => e.confidence));
    const roniSummary = typeof raw.roniSummary === "string" && raw.roniSummary.trim().length > 0 ? raw.roniSummary.trim() : null;

    return {
      facts,
      evidence,
      extractionStatus: evidence.length > 0 ? "complete" : "needs_review",
      extractedBy: `${this.id}:${this.model}`,
      overallConfidence,
      roniSummary,
    };
  }
}

class AnthropicExtractionError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
  }
}

interface RawAnthropicExtraction {
  facts: unknown;
  evidence: unknown;
  roniSummary: unknown;
}

/** Same defensive shape-check `PolicyExtractionService` uses, applied here too so a malformed evidence array never reaches `deriveOverallConfidence` with the wrong shape. The service re-checks this independently — this is belt-and-suspenders, not a substitute. */
function sanitizeEvidence(items: unknown): PolicyExtractionEvidenceItem[] {
  if (!Array.isArray(items)) return [];
  const out: PolicyExtractionEvidenceItem[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    if (typeof item.fieldPath !== "string" || item.fieldPath.trim().length === 0) continue;
    const confidence = typeof item.confidence === "number" && Number.isFinite(item.confidence) ? Math.min(1, Math.max(0, item.confidence)) : null;
    const pageNumber = typeof item.pageNumber === "number" && Number.isInteger(item.pageNumber) && item.pageNumber > 0 ? item.pageNumber : null;
    out.push({
      fieldPath: item.fieldPath,
      valueText: typeof item.valueText === "string" ? item.valueText : null,
      confidence,
      pageNumber,
      snippet: typeof item.snippet === "string" ? item.snippet.slice(0, 500) : null,
    });
  }
  return out;
}

/**
 * A hard ceiling on how much SUPPLEMENTARY OCR text is sent per
 * request — the primary content is now the actual PDF (governed by
 * Anthropic's own 32MB request / ~100-page document limits, already
 * well under this app's own 15MB upload cap), so this only bounds the
 * secondary cross-reference text layer. A policy whose OCR text
 * exceeds it gets its later pages' text dropped from this pass rather
 * than the request failing outright — the PDF itself (all pages) is
 * still sent in full either way, so no page's facts are actually
 * unreachable, only the OCR-text safety net for later pages.
 */
const MAX_SUPPLEMENTARY_TEXT_CHARS = 120_000;

function buildPageMarkedText(pages: ExtractedDocumentPage[]): string {
  let budget = MAX_SUPPLEMENTARY_TEXT_CHARS;
  const parts: string[] = [];
  for (const page of pages) {
    if (budget <= 0) break;
    const header = `--- Page ${page.pageNumber} ---\n`;
    const text = page.text.length > budget ? page.text.slice(0, budget) : page.text;
    parts.push(header + text);
    budget -= header.length + text.length;
  }
  return parts.join("\n\n");
}

const SYSTEM_PROMPT = `You are an insurance-document data extraction system. You are given the ACTUAL PDF of a single auto insurance policy document — its real pages, laid out exactly as printed, including tables, columns, and checkboxes — not a flattened text dump. You may also be given supplementary OCR text extracted from the same pages. Your ONLY job is to call the record_auto_policy_extraction tool with facts drawn STRICTLY from the document.

Rules you must follow exactly:
1. Use ONLY the supplied policy document (and, where present, the supplementary OCR text). Never use outside insurance knowledge, typical policy conventions, or assumptions to fill in a missing fact.
2. TABLES: declarations pages present coverages, limits, deductibles, and premiums as a TABLE — read each row and column by its actual visual position in the document, not by proximity in any flattened text. A number in the "premium" column is a premium, never a limit, even if it sits right next to a limit in reading order. If supplementary OCR text conflicts with what the document's actual layout shows, trust the document's layout — OCR text extraction can interleave separate table columns into one run of words.
3. If a field's value is not explicitly stated in the document, or you are not confident, set it to null. Never guess, estimate, or infer a plausible-sounding value.
4. Never fabricate premiums, limits, dates, vehicles, drivers, exclusions, or deductibles. An invented value is worse than a null value.
5. For every boolean "included" coverage flag: set true only when the document explicitly states the coverage is present; set false only when the document explicitly states the coverage is absent/excluded/waived (including a page that explicitly says a coverage was NOT purchased/elected — that is a confident, explicit false, not null); set null when the document simply does not mention it at all. Do not treat "not mentioned" as false, and do not treat "explicitly declined/not offered" as null.
6. Distinguish the policy's total/term premium from any one coverage's own premium — do not report a single coverage's line-item premium as if it were the policy total, and do not report the policy total as if it were one coverage's premium.
7. For every fact you DO extract with reasonable confidence, add one entry to the evidence array citing the page it came from (fieldPath, a short valueText, a confidence between 0 and 1, the pageNumber matching the document's own page as shown — page 1 is the first page you were given, and a short verbatim-ish snippet of the source text). Do not add an evidence entry for a field you left null.
8. roniSummary must be a short, factual, plain-language summary built ONLY from the facts you extracted in this same call — never a new fact that isn't already in the structured fields, never a recommendation or opinion. If you extracted virtually nothing, return null for roniSummary rather than a padded, empty-sounding summary.
9. VIN: extract the full VIN only if it is explicitly printed in the document; do not partially reconstruct or guess characters.
10. Money fields are plain numbers (no currency symbols, no commas). Dates are ISO 8601 (YYYY-MM-DD) if a full date is stated; if only a partial date is stated, leave the field null rather than guessing the missing part.
11. This document may contain only some of the sections described in the schema (e.g. no drivers section, or no exclusions). Leave everything not present as null/empty — do not pad the response to look complete.
12. You MUST call the record_auto_policy_extraction tool exactly once as your entire response, every time, even if the document is nearly empty or unrelated to auto insurance — in that case call it with every field null/empty rather than replying with plain text. Never respond without calling this tool.`;

function buildToolSchema(): Record<string, unknown> {
  const nullableString = { type: ["string", "null"] } as const;
  const nullableNumber = { type: ["number", "null"] } as const;
  const nullableBool = { type: ["boolean", "null"] } as const;

  const limitPair = {
    type: "object",
    properties: { perPerson: nullableNumber, perAccident: nullableNumber },
    required: ["perPerson", "perAccident"],
    additionalProperties: false,
  };
  const singleLimit = { type: "object", properties: { limit: nullableNumber }, required: ["limit"], additionalProperties: false };
  const deductibleCoverage = {
    type: "object",
    properties: { included: nullableBool, deductible: nullableNumber },
    required: ["included", "deductible"],
    additionalProperties: false,
  };
  const uninsuredMotorist = {
    type: "object",
    properties: { included: nullableBool, perPerson: nullableNumber, perAccident: nullableNumber },
    required: ["included", "perPerson", "perAccident"],
    additionalProperties: false,
  };

  // NOTE: every `type: "object"` node below carries `additionalProperties:
  // false` — required for Anthropic's "strict" tool use (the tool
  // definition below sets `strict: true`; see this file's top-of-class
  // doc comment for why). Without it on EVERY object, not just the
  // top-level one, a strict-mode request is rejected.
  return {
    type: "object",
    properties: {
      facts: {
        type: "object",
        properties: {
          policy: {
            type: "object",
            properties: {
              carrier: nullableString,
              policyNumber: nullableString,
              status: { type: ["string", "null"], enum: ["active", "pending", "expired", "cancelled", null] },
              effectiveDate: nullableString,
              expirationDate: nullableString,
              state: nullableString,
              premiumAmount: nullableNumber,
              premiumFrequency: { type: ["string", "null"], enum: ["monthly", "quarterly", "semi_annual", "annual", "other", null] },
              termPremium: nullableNumber,
            },
            required: [
              "carrier",
              "policyNumber",
              "status",
              "effectiveDate",
              "expirationDate",
              "state",
              "premiumAmount",
              "premiumFrequency",
              "termPremium",
            ],
            additionalProperties: false,
          },
          insured: {
            type: "object",
            properties: {
              namedInsured: nullableString,
              address: nullableString,
              drivers: {
                type: "array",
                items: {
                  type: "object",
                  properties: { name: nullableString, dateOfBirth: nullableString, licenseState: nullableString },
                  required: ["name", "dateOfBirth", "licenseState"],
                  additionalProperties: false,
                },
              },
            },
            required: ["namedInsured", "address", "drivers"],
            additionalProperties: false,
          },
          vehicles: {
            type: "array",
            items: {
              type: "object",
              properties: {
                year: nullableNumber,
                make: nullableString,
                model: nullableString,
                vin: nullableString,
                usage: { type: ["string", "null"], enum: ["commute", "pleasure", "business", "rideshare", "farm", null] },
                annualMileage: nullableNumber,
                lienholder: nullableString,
              },
              required: ["year", "make", "model", "vin", "usage", "annualMileage", "lienholder"],
              additionalProperties: false,
            },
          },
          coverages: {
            type: "object",
            properties: {
              bodilyInjury: { anyOf: [limitPair, { type: "null" }] },
              propertyDamage: { anyOf: [singleLimit, { type: "null" }] },
              personalInjuryProtection: {
                type: "object",
                properties: { included: nullableBool, limit: nullableNumber, deductible: nullableNumber },
                required: ["included", "limit", "deductible"],
                additionalProperties: false,
              },
              medicalPayments: {
                type: "object",
                properties: { included: nullableBool, limit: nullableNumber },
                required: ["included", "limit"],
                additionalProperties: false,
              },
              uninsuredMotorist,
              underinsuredMotorist: uninsuredMotorist,
              collision: deductibleCoverage,
              comprehensive: deductibleCoverage,
              rentalReimbursement: {
                type: "object",
                properties: { included: nullableBool, limitPerDay: nullableNumber, maxDays: nullableNumber },
                required: ["included", "limitPerDay", "maxDays"],
                additionalProperties: false,
              },
              roadsideAssistance: {
                type: "object",
                properties: { included: nullableBool, details: nullableString },
                required: ["included", "details"],
                additionalProperties: false,
              },
            },
            required: [
              "bodilyInjury",
              "propertyDamage",
              "personalInjuryProtection",
              "medicalPayments",
              "uninsuredMotorist",
              "underinsuredMotorist",
              "collision",
              "comprehensive",
              "rentalReimbursement",
              "roadsideAssistance",
            ],
            additionalProperties: false,
          },
          other: {
            type: "object",
            properties: {
              discounts: { type: "array", items: { type: "string" } },
              importantExclusions: { type: "array", items: { type: "string" } },
            },
            required: ["discounts", "importantExclusions"],
            additionalProperties: false,
          },
        },
        required: ["policy", "insured", "vehicles", "coverages", "other"],
        additionalProperties: false,
      },
      evidence: {
        type: "array",
        items: {
          type: "object",
          properties: {
            fieldPath: { type: "string" },
            valueText: nullableString,
            confidence: { type: "number" },
            pageNumber: { type: "number" },
            snippet: nullableString,
          },
          required: ["fieldPath", "confidence", "pageNumber"],
          additionalProperties: false,
        },
      },
      roniSummary: nullableString,
    },
    required: ["facts", "evidence", "roniSummary"],
    additionalProperties: false,
  };
}

const REQUEST_TIMEOUT_MS = 90_000;

/**
 * Builds the user message's `content` array: the real PDF as a native
 * `document` block (Anthropic Messages API, generally available on
 * every current model — no `anthropic-beta` header needed, verified
 * against Anthropic's current PDF-support docs before wiring this up),
 * followed by a short instruction, followed by the supplementary OCR
 * text block ONLY when the text layer actually produced something —
 * an empty/failed text extraction just means that block is omitted,
 * not that the request is malformed.
 */
function buildUserContent(fileBytes: Buffer, supplementaryPages: ExtractedDocumentPage[]): unknown[] {
  const content: unknown[] = [
    {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: fileBytes.toString("base64"),
      },
    },
  ];

  if (supplementaryPages.length > 0) {
    content.push({
      type: "text",
      text:
        "Supplementary OCR text extracted from the same document, page by page — use it only to help read small or unclear characters. " +
        "If it disagrees with what the actual document pages above show (especially inside any table), the document itself is correct, not this text:\n\n" +
        buildPageMarkedText(supplementaryPages),
    });
  } else {
    content.push({
      type: "text",
      text: "Extract the structured facts from the policy document above by calling record_auto_policy_extraction.",
    });
  }

  return content;
}

async function callAnthropicExtraction(
  apiKey: string,
  model: string,
  fileBytes: Buffer,
  supplementaryPages: ExtractedDocumentPage[],
): Promise<RawAnthropicExtraction> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildUserContent(fileBytes, supplementaryPages),
          },
        ],
        tools: [
          {
            name: "record_auto_policy_extraction",
            description: "Records the structured facts extracted from the supplied auto insurance policy document.",
            input_schema: buildToolSchema(),
            strict: true,
          },
        ],
        tool_choice: { type: "auto" },
      }),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    throw new AnthropicExtractionError(timedOut ? "timeout" : "network-error");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // Never forward the response body upstream — it could echo back
    // request content, and in any case the brief asks for a friendly
    // UI state, not raw provider diagnostics.
    throw new AnthropicExtractionError(`api-error-${response.status}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AnthropicExtractionError("invalid-json-response");
  }

  const toolUse = extractToolUseInput(body);
  if (!toolUse) {
    throw new AnthropicExtractionError("no-tool-use-block");
  }
  return toolUse;
}

/** Anthropic's Messages API reply shape (only the fields this provider reads) — a `content` array that may mix `thinking`, `text`, and `tool_use` blocks. `tool_choice: {type: "auto"}` means a `tool_use` block is no longer guaranteed (see this file's top-of-class note on why forced tool use isn't used) — `SYSTEM_PROMPT` instructs the model to always call the tool, but this function still scans for and validates a real `tool_use` block rather than assuming one is present. */
function extractToolUseInput(body: unknown): RawAnthropicExtraction | null {
  if (!body || typeof body !== "object") return null;
  const content = (body as Record<string, unknown>).content;
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    if (b.type === "tool_use" && b.input && typeof b.input === "object") {
      const input = b.input as Record<string, unknown>;
      return { facts: input.facts, evidence: input.evidence, roniSummary: input.roniSummary };
    }
  }
  return null;
}
