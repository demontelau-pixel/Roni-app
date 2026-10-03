import {
  AUTO_POLICY_SCHEMA_VERSION,
  emptyAutoPolicyFacts,
  type AutoCoverages,
  type AutoDriver,
  type AutoInsured,
  type AutoPolicyFacts,
  type AutoPolicySummary,
  type AutoVehicle,
  type DeductibleCoverage,
  type LimitPair,
  type MedicalPaymentsCoverage,
  type PersonalInjuryProtectionCoverage,
  type RentalReimbursementCoverage,
  type RoadsideAssistanceCoverage,
  type SingleLimit,
  type UninsuredMotoristCoverage,
  type VehicleUsage,
} from "@/lib/wallet/schemas/auto-policy";

/**
 * Defensively normalizes ANY value — a real extraction provider's raw
 * output, a hand-typed test fixture, or an already-stored
 * `policy_extracted_data.data` JSONB blob read back from the
 * database — into a valid, current-schema `AutoPolicyFacts`. Nothing
 * downstream (the repository, the Policy Dashboard, Ask Roni) ever
 * reads a provider's or the database's JSON directly; everything
 * passes through here first (M3.2 brief, "VALIDATION").
 *
 * Rules this enforces, deliberately without a schema-validation
 * library (this project has none, and adding one just for this would
 * be a second unverifiable new dependency alongside `pdf-parse` — see
 * `lib/services/document-text/pdf-parse-extractor.ts` — for a single,
 * fully hand-checkable function):
 *
 *   - a field of the wrong JS type never survives — it becomes `null`
 *     (or `[]` for an array field), never a coerced guess;
 *   - an enum-like string (e.g. `policy.status`, `vehicle.usage`) is
 *     kept only if it's one of the exact values the schema allows;
 *   - a nested object missing entirely, or not an object at all,
 *     becomes that section's own empty/`null` shape rather than
 *     throwing or propagating `undefined`;
 *   - unknown/extra keys on any input object are silently dropped —
 *     they are never copied through, so a provider can't smuggle an
 *     unreviewed field in as if it had been validated;
 *   - this same function also reads an OLDER `"auto.v1"` row's `data`
 *     safely: `auto.v1` had no `included` flag on PIP/Medical
 *     Payments/UM/UIM, so those fields are simply absent on such a
 *     row — absent is exactly what the type guards below already
 *     treat as "not determined," so an old row comes back with those
 *     three fields `null` rather than crashing on a missing key.
 *
 * This function can never make output MORE trustworthy than its
 * input — a provider that confidently reports a wrong value the right
 * *shape* will still sail through. It only guarantees the output is
 * well-formed `AutoPolicyFacts`, never that it's correct.
 */
export function sanitizeAutoPolicyFacts(candidate: unknown): AutoPolicyFacts {
  const empty = emptyAutoPolicyFacts();
  if (!isRecord(candidate)) return empty;

  return {
    schemaVersion: AUTO_POLICY_SCHEMA_VERSION,
    policy: sanitizePolicySummary(candidate.policy, empty.policy),
    insured: sanitizeInsured(candidate.insured, empty.insured),
    vehicles: sanitizeVehicles(candidate.vehicles),
    coverages: sanitizeCoverages(candidate.coverages, empty.coverages),
    other: sanitizeOther(candidate.other),
  };
}

// ---------------------------------------------------------------
// Generic primitive guards
// ---------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function bool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

// ---------------------------------------------------------------
// Semantic bounds (M3.3 §6, "VALIDATION": "Reject or null
// impossible/invalid values" — a step beyond `num`/`str`'s type
// checks above, which only guard against the wrong JS *type*. A
// provider (especially an AI one) can return a well-typed number
// that's still nonsense — a -$4,000 deductible, a 9,412 policy year,
// a 40,000,000-mile odometer — and this project's product rule is the
// same for a semantically-impossible value as for a wrongly-typed
// one: it becomes `null`, never a value the Policy Dashboard would
// display as if it were real.
// ---------------------------------------------------------------

const CURRENT_YEAR = new Date().getFullYear();

/** A money-like amount (premium, limit, deductible): finite, and not negative — insurance dollar amounts are never negative, so a negative one is a parsing/model error, not a fact. No upper bound is enforced here beyond "finite," since umbrella/commercial limits can legitimately run into eight figures; wildly implausible amounts still show up honestly with a low provider-reported confidence rather than being silently dropped. */
function money(v: unknown): number | null {
  const n = num(v);
  return n !== null && n >= 0 ? n : null;
}

/** A vehicle model year: within a plausible real-world range. Guards against an obvious extraction slip (e.g. picking up a policy/phone number digit run instead of a year) without hand-coding a narrower band that would reject a legitimately older classic-car policy. */
function vehicleYear(v: unknown): number | null {
  const n = num(v);
  return n !== null && Number.isInteger(n) && n >= 1900 && n <= CURRENT_YEAR + 2 ? n : null;
}

/** Annual mileage: non-negative and below a generous real-world ceiling (500,000 mi/yr is already far beyond any personal-auto policy). */
function mileage(v: unknown): number | null {
  const n = num(v);
  return n !== null && n >= 0 && n <= 500_000 ? n : null;
}

/**
 * A date-like string: must contain a plausible 4-digit year
 * (1900–2099) and stay within a sane length. Deliberately NOT
 * restricted to strict ISO `YYYY-MM-DD` — `normalizeDate()`
 * (`lib/services/policy-extraction/text-field-extractor.ts`) already
 * normalizes what it can, but honestly leaves a date it couldn't
 * safely reformat (e.g. "January 5, 2025") as readable raw text
 * rather than guessing at reformatting it; rejecting that text here
 * would turn an honest, still-useful value into a worse "not
 * determined." This only rejects what's clearly NOT a date at all
 * (empty text, a stray word, a garbled OCR fragment with no year in
 * it).
 */
function dateLike(v: unknown): string | null {
  const s = str(v);
  if (s === null || s.length > 40) return null;
  return /\b(19|20)\d{2}\b/.test(s) ? s : null;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

// ---------------------------------------------------------------
// Section sanitizers
// ---------------------------------------------------------------

const POLICY_STATUSES = ["active", "pending", "expired", "cancelled"] as const;
const PREMIUM_FREQUENCIES = ["monthly", "quarterly", "semi_annual", "annual", "other"] as const;
const VEHICLE_USAGES = ["commute", "pleasure", "business", "rideshare", "farm"] as const;

function sanitizePolicySummary(v: unknown, fallback: AutoPolicySummary): AutoPolicySummary {
  if (!isRecord(v)) return fallback;
  return {
    category: "auto",
    carrier: str(v.carrier),
    policyNumber: str(v.policyNumber),
    status: oneOf(v.status, POLICY_STATUSES),
    effectiveDate: dateLike(v.effectiveDate),
    expirationDate: dateLike(v.expirationDate),
    state: str(v.state),
    premiumAmount: money(v.premiumAmount),
    premiumFrequency: oneOf(v.premiumFrequency, PREMIUM_FREQUENCIES),
    termPremium: money(v.termPremium),
  };
}

function sanitizeDriver(v: unknown): AutoDriver | null {
  if (!isRecord(v)) return null;
  const name = str(v.name);
  const dateOfBirth = dateLike(v.dateOfBirth);
  const licenseState = str(v.licenseState);
  if (name === null && dateOfBirth === null && licenseState === null) return null;
  return { name, dateOfBirth, licenseState };
}

function sanitizeInsured(v: unknown, fallback: AutoInsured): AutoInsured {
  if (!isRecord(v)) return fallback;
  const drivers = Array.isArray(v.drivers)
    ? v.drivers.map(sanitizeDriver).filter((d): d is AutoDriver => d !== null)
    : [];
  return { namedInsured: str(v.namedInsured), address: str(v.address), drivers };
}

function sanitizeVehicle(v: unknown): AutoVehicle | null {
  if (!isRecord(v)) return null;
  const year = vehicleYear(v.year);
  const make = str(v.make);
  const model = str(v.model);
  const vin = str(v.vin);
  const usage: VehicleUsage = oneOf(v.usage, VEHICLE_USAGES);
  const annualMileage = mileage(v.annualMileage);
  const lienholder = str(v.lienholder);
  if (year === null && make === null && model === null && vin === null) return null;
  return { year, make, model, vin, usage, annualMileage, lienholder };
}

function sanitizeVehicles(v: unknown): AutoVehicle[] {
  if (!Array.isArray(v)) return [];
  return v.map(sanitizeVehicle).filter((veh): veh is AutoVehicle => veh !== null);
}

function sanitizeLimitPair(v: unknown): LimitPair | null {
  if (!isRecord(v)) return null;
  const perPerson = money(v.perPerson);
  const perAccident = money(v.perAccident);
  if (perPerson === null && perAccident === null) return null;
  return { perPerson, perAccident };
}

function sanitizeSingleLimit(v: unknown): SingleLimit | null {
  if (!isRecord(v)) return null;
  const limit = money(v.limit);
  if (limit === null) return null;
  return { limit };
}

function sanitizeDeductibleCoverage(v: unknown, fallback: DeductibleCoverage): DeductibleCoverage {
  if (!isRecord(v)) return fallback;
  return { included: bool(v.included), deductible: money(v.deductible) };
}

function sanitizePip(v: unknown, fallback: PersonalInjuryProtectionCoverage): PersonalInjuryProtectionCoverage {
  if (!isRecord(v)) return fallback;
  return { included: bool(v.included), limit: money(v.limit), deductible: money(v.deductible) };
}

function sanitizeMedPay(v: unknown, fallback: MedicalPaymentsCoverage): MedicalPaymentsCoverage {
  if (!isRecord(v)) return fallback;
  return { included: bool(v.included), limit: money(v.limit) };
}

function sanitizeUm(v: unknown, fallback: UninsuredMotoristCoverage): UninsuredMotoristCoverage {
  if (!isRecord(v)) return fallback;
  return { included: bool(v.included), perPerson: money(v.perPerson), perAccident: money(v.perAccident) };
}

function sanitizeRental(v: unknown, fallback: RentalReimbursementCoverage): RentalReimbursementCoverage {
  if (!isRecord(v)) return fallback;
  const maxDaysRaw = num(v.maxDays);
  const maxDays = maxDaysRaw !== null && maxDaysRaw >= 0 && maxDaysRaw <= 365 ? maxDaysRaw : null;
  return { included: bool(v.included), limitPerDay: money(v.limitPerDay), maxDays };
}

function sanitizeRoadside(v: unknown, fallback: RoadsideAssistanceCoverage): RoadsideAssistanceCoverage {
  if (!isRecord(v)) return fallback;
  return { included: bool(v.included), details: str(v.details) };
}

function sanitizeCoverages(v: unknown, fallback: AutoCoverages): AutoCoverages {
  if (!isRecord(v)) return fallback;
  return {
    bodilyInjury: sanitizeLimitPair(v.bodilyInjury),
    propertyDamage: sanitizeSingleLimit(v.propertyDamage),
    personalInjuryProtection: sanitizePip(v.personalInjuryProtection, fallback.personalInjuryProtection),
    medicalPayments: sanitizeMedPay(v.medicalPayments, fallback.medicalPayments),
    uninsuredMotorist: sanitizeUm(v.uninsuredMotorist, fallback.uninsuredMotorist),
    underinsuredMotorist: sanitizeUm(v.underinsuredMotorist, fallback.underinsuredMotorist),
    collision: sanitizeDeductibleCoverage(v.collision, fallback.collision),
    comprehensive: sanitizeDeductibleCoverage(v.comprehensive, fallback.comprehensive),
    rentalReimbursement: sanitizeRental(v.rentalReimbursement, fallback.rentalReimbursement),
    roadsideAssistance: sanitizeRoadside(v.roadsideAssistance, fallback.roadsideAssistance),
  };
}

function sanitizeOther(v: unknown): { discounts: string[]; importantExclusions: string[] } {
  if (!isRecord(v)) return { discounts: [], importantExclusions: [] };
  return { discounts: strArray(v.discounts), importantExclusions: strArray(v.importantExclusions) };
}
