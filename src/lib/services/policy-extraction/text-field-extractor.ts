import "server-only";
import {
  emptyAutoPolicyFacts,
  type AutoPolicyFacts,
  type AutoPolicySummary,
} from "@/lib/wallet/schemas/auto-policy";
import type { ExtractedDocumentPage } from "@/lib/services/document-text/types";
import type { PolicyExtractionEvidenceItem } from "@/lib/services/policy-extraction/types";

/**
 * The Task-15 layer of the M3.2 pipeline: turns real, already-
 * extracted page text (`DocumentTextExtractor`'s output) into
 * `AutoPolicyFacts` plus real evidence citations, using deterministic
 * regex/keyword matching — NOT an AI model. This is what the brief's
 * "analyze insurance information → normalize important facts" step
 * means when no AI provider/API key is configured (brief: "If the
 * environment does not currently contain an AI provider/API key, DO
 * NOT fake extracted policy information... implement the real
 * provider interface").
 *
 * Every rule below follows the same shape: look for a label an Auto
 * declarations page actually uses (e.g. "Bodily Injury Liability"),
 * then look for a value near it (a dollar amount, a date, a keyword
 * like "not covered"). If a label is found but nothing recognizable
 * follows it, the field stays `null` — this file never fills in a
 * plausible-looking value it didn't actually read (brief principle
 * 1). Every value that IS extracted carries the real page it came
 * from and a short snippet of the surrounding text, because those are
 * exactly what `saveExtractionEvidence` needs to make the fact
 * traceable (brief principle 3).
 *
 * Confidence is assigned by pattern strength, not invented per field:
 *   - 0.85 — a label and a well-formed value (a `$` amount, a
 *     two-part `X/Y` limit, a recognized date) within a short window
 *     right after the label — the strongest signal this heuristic can
 *     have.
 *   - 0.65 — a label matched and a plausible but weaker-signal value
 *     (a bare number with no `$`, a value found further away in the
 *     window) — still grounded in real text, just less certain it's
 *     the right token.
 * Nothing here reports a confidence above what a regex match over
 * plain text actually warrants; the brief's ">= 0.90 high confidence"
 * band is intentionally left for a future real AI/OCR provider that
 * can justify it.
 *
 * KNOWN LIMITATION (documented here and in the M3.2 report): this is
 * a heuristic text-pattern matcher, not a document understanding
 * model. It works well against typical US Auto declarations-page
 * layouts and will legitimately return `null` (not a wrong guess) for
 * unusual layouts, scanned text with OCR artifacts, or non-English
 * documents. That is the intended, safe failure mode — a person can
 * always fill in what RONI missed via "Add policy details."
 */

const STRONG_CONFIDENCE = 0.85;
const WEAK_CONFIDENCE = 0.65;

interface LabelMatch {
  pageNumber: number;
  /** The text immediately following the label, bounded to a short window — this is also what a returned field's `snippet` is built from, so evidence never carries more of the document than necessary. */
  windowText: string;
}

interface FieldHit<T> {
  value: T;
  pageNumber: number;
  snippet: string;
  confidence: number;
  /** The raw text the value was parsed from — stored as `valueText` on the evidence row, kept separate from the typed `value` (matches `ExtractionEvidence.valueText`'s own doc comment). */
  raw: string;
}

/** Finds every occurrence of `labelRe` across all pages, in page order, each paired with a bounded window of text right after it. */
function findLabelOccurrences(pages: ExtractedDocumentPage[], labelRe: RegExp, windowAfter = 220): LabelMatch[] {
  const flags = labelRe.flags.includes("g") ? labelRe.flags : `${labelRe.flags}g`;
  const out: LabelMatch[] = [];
  for (const page of pages) {
    const re = new RegExp(labelRe.source, flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(page.text)) !== null) {
      const start = m.index + m[0].length;
      out.push({ pageNumber: page.pageNumber, windowText: page.text.slice(start, start + windowAfter) });
      if (re.lastIndex === m.index) re.lastIndex += 1; // guards against a zero-length label match looping forever
    }
  }
  return out;
}

function snippetOf(windowText: string, maxLen = 140): string {
  const trimmed = windowText.replace(/\s+/g, " ").trim();
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed;
}

/** Safe capture-group access — `noUncheckedIndexedAccess` types every regex-array index as possibly `undefined`, which this centralizes into one honest `null` check instead of a non-null assertion at each call site. */
function cap(m: RegExpExecArray | RegExpMatchArray | null, i: number): string | null {
  if (!m) return null;
  const v = m[i];
  return typeof v === "string" ? v : null;
}

function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const MONEY_RE = /\$\s*([\d]{1,3}(?:,\d{3})*(?:\.\d{2})?)/;
const BARE_NUMBER_RE = /\b([\d]{2,3}(?:,\d{3})+|[\d]{3,7})\b/;
const TWO_MONEY_RE = /\$?\s*([\d]{1,3}(?:,\d{3})*)\s*\/\s*\$?\s*([\d]{1,3}(?:,\d{3})*)/;
const NEGATIVE_RE = /\b(not\s+covered|not\s+included|no\s+coverage|excluded|waived|declined|rejected|n\/a)\b/i;

/** First label occurrence (in document order) whose window yields a value, per `extractor`. Returns `null` — never a guess — when no occurrence yields one. */
function firstFieldHit<T>(matches: LabelMatch[], extractor: (window: string) => { value: T; confidence: number; raw: string } | null): FieldHit<T> | null {
  for (const m of matches) {
    const hit = extractor(m.windowText);
    if (hit) return { ...hit, pageNumber: m.pageNumber, snippet: snippetOf(m.windowText) };
  }
  return null;
}

function moneyHit(window: string): { value: number; confidence: number; raw: string } | null {
  const strong = MONEY_RE.exec(window);
  const strongRaw = cap(strong, 1);
  if (strongRaw !== null) {
    const value = parseMoney(strongRaw);
    if (value !== null) return { value, confidence: STRONG_CONFIDENCE, raw: strong?.[0] ?? strongRaw };
  }
  const weak = BARE_NUMBER_RE.exec(window);
  const weakRaw = cap(weak, 1);
  if (weakRaw !== null) {
    const value = parseMoney(weakRaw);
    if (value !== null) return { value, confidence: WEAK_CONFIDENCE, raw: weak?.[0] ?? weakRaw };
  }
  return null;
}

function twoMoneyHit(window: string): { value: { a: number; b: number }; confidence: number; raw: string } | null {
  const m = TWO_MONEY_RE.exec(window);
  if (!m) return null;
  const aRaw = cap(m, 1);
  const bRaw = cap(m, 2);
  const a = aRaw !== null ? parseMoney(aRaw) : null;
  const b = bRaw !== null ? parseMoney(bRaw) : null;
  if (a === null || b === null) return null;
  const matchText = m[0] ?? "";
  const confidence = window.slice(0, m.index + matchText.length).includes("$") ? STRONG_CONFIDENCE : WEAK_CONFIDENCE;
  return { value: { a, b }, confidence, raw: matchText };
}

/** `true`/`false` from an explicit negative keyword or a found money value near the label; `null` when the window has neither (found the label, nothing conclusive after it — stays "not determined," never guessed). */
function includedHit(window: string, hasValue: boolean): { value: boolean; confidence: number; raw: string } | null {
  const neg = NEGATIVE_RE.exec(window);
  if (neg) return { value: false, confidence: STRONG_CONFIDENCE, raw: neg[0] };
  if (hasValue) return { value: true, confidence: STRONG_CONFIDENCE, raw: window.slice(0, 24) };
  return null;
}

const POLICY_NUMBER_RE = /policy\s*(?:number|no\.?|#)\s*[:\-]?\s*/i;
const POLICY_NUMBER_VALUE_RE = /\b([A-Z0-9][A-Z0-9\-]{4,19})\b/;
const EFFECTIVE_DATE_RE = /effective\s*date\s*[:\-]?\s*/i;
const EXPIRATION_DATE_RE = /expir(?:ation|es|y)\s*date\s*[:\-]?\s*/i;
const DATE_VALUE_RE = /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4})\b/;
const PREMIUM_RE = /(?:total\s+|full\s+term\s+|policy\s+)?premium\s*[:\-]?\s*/i;
const STATE_LABEL_RE = /\bstate\s*[:\-]?\s*/i;
const NAMED_INSURED_RE = /named\s+insured\s*[:\-]?\s*/i;
const NAME_VALUE_RE = /\b([A-Z][a-zA-Z.'\-]+(?:\s+[A-Z][a-zA-Z.'\-]+){0,3})\b/;

const US_STATE_CODES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
]);

const KNOWN_CARRIERS = [
  "Progressive","GEICO","State Farm","Allstate","Liberty Mutual","USAA","Nationwide","Farmers Insurance",
  "Farmers","Travelers","American Family","Esurance","Safeco","Mercury Insurance","The Hartford","Hartford",
  "Root Insurance","National General","Kemper","MetLife","Auto-Owners","Erie Insurance","Amica",
];

function extractPolicySummary(pages: ExtractedDocumentPage[]): { summary: Partial<AutoPolicySummary>; evidence: PolicyExtractionEvidenceItem[] } {
  const evidence: PolicyExtractionEvidenceItem[] = [];
  const summary: Partial<AutoPolicySummary> = {};

  // Carrier — matched against a fixed list of known US Auto carrier
  // names rather than a generic pattern (there's no reliable
  // structural marker for "this is the carrier's name" on a
  // declarations page), so this stays a real text match, never a
  // guess: if no known name appears verbatim, `carrier` stays `null`.
  for (const page of pages) {
    const found = KNOWN_CARRIERS.find((name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(page.text));
    if (found) {
      summary.carrier = found;
      evidence.push({ fieldPath: "policy.carrier", valueText: found, confidence: 0.75, pageNumber: page.pageNumber, snippet: found });
      break;
    }
  }

  const policyNumberHit = firstFieldHit(findLabelOccurrences(pages, POLICY_NUMBER_RE, 60), (w) => {
    const m = POLICY_NUMBER_VALUE_RE.exec(w);
    const value = cap(m, 1);
    return value !== null ? { value, confidence: STRONG_CONFIDENCE, raw: m?.[0] ?? value } : null;
  });
  if (policyNumberHit) {
    summary.policyNumber = policyNumberHit.value;
    evidence.push(evidenceFrom("policy.policyNumber", policyNumberHit));
  }

  const effectiveHit = firstFieldHit(findLabelOccurrences(pages, EFFECTIVE_DATE_RE, 40), (w) => {
    const m = DATE_VALUE_RE.exec(w);
    const raw = cap(m, 1);
    if (raw === null) return null;
    const value = normalizeDate(raw);
    return value !== null ? { value, confidence: STRONG_CONFIDENCE, raw } : null;
  });
  if (effectiveHit) {
    summary.effectiveDate = effectiveHit.value;
    evidence.push(evidenceFrom("policy.effectiveDate", effectiveHit));
  }

  const expirationHit = firstFieldHit(findLabelOccurrences(pages, EXPIRATION_DATE_RE, 40), (w) => {
    const m = DATE_VALUE_RE.exec(w);
    const raw = cap(m, 1);
    if (raw === null) return null;
    const value = normalizeDate(raw);
    return value !== null ? { value, confidence: STRONG_CONFIDENCE, raw } : null;
  });
  if (expirationHit) {
    summary.expirationDate = expirationHit.value;
    evidence.push(evidenceFrom("policy.expirationDate", expirationHit));
  }

  const stateHit = firstFieldHit(findLabelOccurrences(pages, STATE_LABEL_RE, 10), (w) => {
    const m = /\b([A-Z]{2})\b/.exec(w);
    const value = cap(m, 1);
    return value !== null && US_STATE_CODES.has(value) ? { value, confidence: STRONG_CONFIDENCE, raw: value } : null;
  });
  if (stateHit) {
    summary.state = stateHit.value;
    evidence.push(evidenceFrom("policy.state", stateHit));
  }

  const premiumHit = firstFieldHit(findLabelOccurrences(pages, PREMIUM_RE, 40), moneyHit);
  if (premiumHit) {
    summary.premiumAmount = premiumHit.value;
    evidence.push(evidenceFrom("policy.premiumAmount", premiumHit));
  }

  const freqMatch = pages.map((p) => p.text).join(" ").match(/\b(monthly|quarterly|semi-annual|semiannual|annual|annually|six[- ]month|twelve[- ]month)\b/i);
  const freqRaw = cap(freqMatch, 1);
  if (freqRaw !== null) {
    summary.premiumFrequency = normalizeFrequency(freqRaw);
  }

  const namedInsuredHit = firstFieldHit(findLabelOccurrences(pages, NAMED_INSURED_RE, 60), (w) => {
    const m = NAME_VALUE_RE.exec(w);
    const value = cap(m, 1);
    return value !== null ? { value: value.trim(), confidence: STRONG_CONFIDENCE, raw: m?.[0] ?? value } : null;
  });

  return { summary, evidence: namedInsuredHit ? [...evidence, evidenceFromInsured(namedInsuredHit)] : evidence };
}

function evidenceFromInsured(hit: FieldHit<string>): PolicyExtractionEvidenceItem {
  return { fieldPath: "insured.namedInsured", valueText: hit.raw, confidence: hit.confidence, pageNumber: hit.pageNumber, snippet: hit.snippet };
}

function evidenceFrom<T>(fieldPath: string, hit: FieldHit<T>): PolicyExtractionEvidenceItem {
  return { fieldPath, valueText: hit.raw, confidence: hit.confidence, pageNumber: hit.pageNumber, snippet: hit.snippet };
}

function normalizeDate(raw: string): string | null {
  // Keeps this deliberately simple: normalize `MM/DD/YYYY` (and
  // 2-digit years) to ISO `YYYY-MM-DD`; a spelled-out date
  // ("January 5, 2025") is left as-is rather than hand-rolled-parsed,
  // since a wrong hand-parsed date is worse than an honest raw string
  // the person can correct via "Add policy details."
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(raw.trim());
  const mm = cap(slash, 1);
  const dd = cap(slash, 2);
  const yy = cap(slash, 3);
  if (mm === null || dd === null || yy === null) return raw.trim();
  const year = yy.length === 2 ? `20${yy}` : yy;
  return `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function normalizeFrequency(raw: string): AutoPolicySummary["premiumFrequency"] {
  const v = raw.toLowerCase();
  if (v.startsWith("month")) return "monthly";
  if (v.startsWith("quarter")) return "quarterly";
  if (v.includes("semi") || v.startsWith("six")) return "semi_annual";
  if (v.startsWith("annual") || v.startsWith("twelve")) return "annual";
  return "other";
}

interface CoverageExtraction {
  facts: AutoPolicyFacts["coverages"];
  evidence: PolicyExtractionEvidenceItem[];
}

function extractCoverages(pages: ExtractedDocumentPage[], base: AutoPolicyFacts["coverages"]): CoverageExtraction {
  const evidence: PolicyExtractionEvidenceItem[] = [];
  // Plain JSON-shaped data (numbers/strings/booleans/null only), so a
  // JSON round-trip is a safe, dependency-free deep clone — avoids
  // relying on `structuredClone`'s runtime/lib-version availability
  // for what is otherwise a one-line copy.
  const coverages: AutoPolicyFacts["coverages"] = JSON.parse(JSON.stringify(base));

  const biHit = firstFieldHit(findLabelOccurrences(pages, /bodily\s+injury(?:\s+liability)?/i, 160), twoMoneyHit);
  if (biHit) {
    coverages.bodilyInjury = { perPerson: biHit.value.a, perAccident: biHit.value.b };
    evidence.push(evidenceFrom("coverages.bodilyInjury.perPerson", { ...biHit, value: biHit.value.a }));
    evidence.push(evidenceFrom("coverages.bodilyInjury.perAccident", { ...biHit, value: biHit.value.b }));
  }

  const pdHit = firstFieldHit(findLabelOccurrences(pages, /property\s+damage(?:\s+liability)?/i, 100), moneyHit);
  if (pdHit) {
    coverages.propertyDamage = { limit: pdHit.value };
    evidence.push(evidenceFrom("coverages.propertyDamage.limit", pdHit));
  }

  const pipMatches = findLabelOccurrences(pages, /personal\s+injury\s+protection|\bpip\b/i, 100);
  const pipMoney = firstFieldHit(pipMatches, moneyHit);
  const pipIncluded = firstFieldHit(pipMatches, (w) => includedHit(w, pipMoney !== null));
  if (pipIncluded) {
    coverages.personalInjuryProtection.included = pipIncluded.value;
    evidence.push(evidenceFrom("coverages.personalInjuryProtection.included", pipIncluded));
  }
  if (pipMoney) {
    coverages.personalInjuryProtection.limit = pipMoney.value;
    evidence.push(evidenceFrom("coverages.personalInjuryProtection.limit", pipMoney));
  }
  const pipDeductible = firstFieldHit(findLabelOccurrences(pages, /personal\s+injury\s+protection[^.]{0,60}?deductible|\bpip\b[^.]{0,60}?deductible/i, 40), moneyHit);
  if (pipDeductible) {
    coverages.personalInjuryProtection.deductible = pipDeductible.value;
    evidence.push(evidenceFrom("coverages.personalInjuryProtection.deductible", pipDeductible));
  }

  const medPayMatches = findLabelOccurrences(pages, /medical\s+payments|\bmed\s*pay\b/i, 100);
  const medPayMoney = firstFieldHit(medPayMatches, moneyHit);
  const medPayIncluded = firstFieldHit(medPayMatches, (w) => includedHit(w, medPayMoney !== null));
  if (medPayIncluded) {
    coverages.medicalPayments.included = medPayIncluded.value;
    evidence.push(evidenceFrom("coverages.medicalPayments.included", medPayIncluded));
  }
  if (medPayMoney) {
    coverages.medicalPayments.limit = medPayMoney.value;
    evidence.push(evidenceFrom("coverages.medicalPayments.limit", medPayMoney));
  }

  extractMotoristCoverage(pages, coverages, evidence);

  const collisionMatches = findLabelOccurrences(pages, /\bcollision\b/i, 100);
  const collisionDeductible = firstFieldHit(collisionMatches, (w) => {
    const m = /deductible\D{0,15}(\$?[\d,]+)/i.exec(w) ?? MONEY_RE.exec(w);
    if (!m) return null;
    const value = parseMoney(m[1] ?? m[0]);
    return value !== null ? { value, confidence: STRONG_CONFIDENCE, raw: m[0] } : null;
  });
  const collisionIncluded = firstFieldHit(collisionMatches, (w) => includedHit(w, collisionDeductible !== null));
  if (collisionIncluded) {
    coverages.collision.included = collisionIncluded.value;
    evidence.push(evidenceFrom("coverages.collision.included", collisionIncluded));
  }
  if (collisionDeductible) {
    coverages.collision.deductible = collisionDeductible.value;
    evidence.push(evidenceFrom("coverages.collision.deductible", collisionDeductible));
  }

  const comprehensiveMatches = findLabelOccurrences(pages, /\bcomprehensive\b/i, 100);
  const comprehensiveDeductible = firstFieldHit(comprehensiveMatches, (w) => {
    const m = /deductible\D{0,15}(\$?[\d,]+)/i.exec(w) ?? MONEY_RE.exec(w);
    if (!m) return null;
    const value = parseMoney(m[1] ?? m[0]);
    return value !== null ? { value, confidence: STRONG_CONFIDENCE, raw: m[0] } : null;
  });
  const comprehensiveIncluded = firstFieldHit(comprehensiveMatches, (w) => includedHit(w, comprehensiveDeductible !== null));
  if (comprehensiveIncluded) {
    coverages.comprehensive.included = comprehensiveIncluded.value;
    evidence.push(evidenceFrom("coverages.comprehensive.included", comprehensiveIncluded));
  }
  if (comprehensiveDeductible) {
    coverages.comprehensive.deductible = comprehensiveDeductible.value;
    evidence.push(evidenceFrom("coverages.comprehensive.deductible", comprehensiveDeductible));
  }

  const rentalMatches = findLabelOccurrences(pages, /rental\s+reimbursement|rental\s+car\s+coverage/i, 120);
  const rentalPerDay = firstFieldHit(rentalMatches, (w) => {
    const m = /\$?\s*([\d,]+)\s*(?:\/|per)\s*day/i.exec(w);
    const raw = cap(m, 1);
    if (raw === null) return null;
    const value = parseMoney(raw);
    return value !== null ? { value, confidence: STRONG_CONFIDENCE, raw: m?.[0] ?? raw } : null;
  });
  const rentalMaxDays = firstFieldHit(rentalMatches, (w) => {
    const m = /(\d{1,3})\s*days?\b/i.exec(w);
    const raw = cap(m, 1);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? { value, confidence: WEAK_CONFIDENCE, raw: m?.[0] ?? raw } : null;
  });
  const rentalIncluded = firstFieldHit(rentalMatches, (w) => includedHit(w, rentalPerDay !== null || rentalMaxDays !== null));
  if (rentalIncluded) {
    coverages.rentalReimbursement.included = rentalIncluded.value;
    evidence.push(evidenceFrom("coverages.rentalReimbursement.included", rentalIncluded));
  }
  if (rentalPerDay) {
    coverages.rentalReimbursement.limitPerDay = rentalPerDay.value;
    evidence.push(evidenceFrom("coverages.rentalReimbursement.limitPerDay", rentalPerDay));
  }
  if (rentalMaxDays) {
    coverages.rentalReimbursement.maxDays = rentalMaxDays.value;
    evidence.push(evidenceFrom("coverages.rentalReimbursement.maxDays", rentalMaxDays));
  }

  const roadsideMatches = findLabelOccurrences(pages, /roadside\s+assistance|towing(?:\s*(?:and|&)\s*labor)?/i, 120);
  const roadsideIncluded = firstFieldHit(roadsideMatches, (w) => includedHit(w, /\$/.test(w) || /included/i.test(w)));
  if (roadsideIncluded) {
    coverages.roadsideAssistance.included = roadsideIncluded.value;
    evidence.push(evidenceFrom("coverages.roadsideAssistance.included", roadsideIncluded));
    if (roadsideIncluded.value) {
      const detailsSnippet = snippetOf(roadsideMatches[0]?.windowText ?? "", 80);
      if (detailsSnippet) {
        coverages.roadsideAssistance.details = detailsSnippet;
        evidence.push({ fieldPath: "coverages.roadsideAssistance.details", valueText: detailsSnippet, confidence: WEAK_CONFIDENCE, pageNumber: roadsideMatches[0]?.pageNumber ?? null, snippet: detailsSnippet });
      }
    }
  }

  return { facts: coverages, evidence };
}

/** Uninsured vs. Underinsured Motorist is the one place the label text itself decides which field(s) a value belongs to — a combined "Uninsured/Underinsured Motorist" line genuinely describes both, so both get the same real value rather than one being guessed from the other. */
function extractMotoristCoverage(pages: ExtractedDocumentPage[], coverages: AutoPolicyFacts["coverages"], evidence: PolicyExtractionEvidenceItem[]): void {
  const combinedMatches = findLabelOccurrences(pages, /uninsured\s*\/\s*underinsured\s+motorist|\bum\s*\/\s*uim\b/i, 150);
  const uimOnlyMatches = findLabelOccurrences(pages, /(?<!\/)\bunderinsured\s+motorist\b/i, 150);
  const umOnlyMatches = findLabelOccurrences(pages, /\buninsured\s+motorist\b(?!\s*\/)/i, 150);

  applyMotoristMatches(combinedMatches, coverages.uninsuredMotorist, evidence, "coverages.uninsuredMotorist");
  applyMotoristMatches(combinedMatches, coverages.underinsuredMotorist, evidence, "coverages.underinsuredMotorist");
  applyMotoristMatches(umOnlyMatches, coverages.uninsuredMotorist, evidence, "coverages.uninsuredMotorist");
  applyMotoristMatches(uimOnlyMatches, coverages.underinsuredMotorist, evidence, "coverages.underinsuredMotorist");
}

function applyMotoristMatches(
  matches: LabelMatch[],
  target: { included: boolean | null; perPerson: number | null; perAccident: number | null },
  evidence: PolicyExtractionEvidenceItem[],
  basePath: string,
): void {
  if (matches.length === 0 || target.included !== null) return; // already resolved by an earlier (more specific) pattern
  const moneyHitResult = firstFieldHit(matches, twoMoneyHit);
  const includedResult = firstFieldHit(matches, (w) => includedHit(w, moneyHitResult !== null));
  if (includedResult) {
    target.included = includedResult.value;
    evidence.push(evidenceFrom(`${basePath}.included`, includedResult));
  }
  if (moneyHitResult) {
    target.perPerson = moneyHitResult.value.a;
    target.perAccident = moneyHitResult.value.b;
    evidence.push(evidenceFrom(`${basePath}.perPerson`, { ...moneyHitResult, value: moneyHitResult.value.a }));
    evidence.push(evidenceFrom(`${basePath}.perAccident`, { ...moneyHitResult, value: moneyHitResult.value.b }));
  }
}

export interface AutoTextExtractionResult {
  facts: AutoPolicyFacts;
  evidence: PolicyExtractionEvidenceItem[];
}

/**
 * The one entry point this file exposes. Takes real per-page text
 * (never the raw PDF bytes — that's `DocumentTextExtractor`'s job)
 * and returns a normalized, current-schema `AutoPolicyFacts` plus
 * every citation found along the way. Vehicles and drivers are
 * intentionally left for the person to confirm via "Add policy
 * details" today — the two require reliably segmenting a "Schedule of
 * Vehicles"/"Drivers" table, which varies too much by carrier layout
 * for a first, deterministic pass to do safely without a much higher
 * false-match rate than the coverage fields above; extending this
 * function to attempt them is a natural, isolated follow-up (see the
 * M3.2 report's "known limitations").
 */
export function extractAutoPolicyFactsFromPages(pages: ExtractedDocumentPage[]): AutoTextExtractionResult {
  const base = emptyAutoPolicyFacts();
  if (pages.length === 0) return { facts: base, evidence: [] };

  const { summary, evidence: summaryEvidence } = extractPolicySummary(pages);
  const { facts: coverages, evidence: coverageEvidence } = extractCoverages(pages, base.coverages);

  const facts: AutoPolicyFacts = {
    ...base,
    policy: { ...base.policy, ...summary },
    coverages,
  };

  return { facts, evidence: [...summaryEvidence, ...coverageEvidence] };
}
