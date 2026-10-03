/**
 * The normalized shape of an extracted Auto policy's facts —
 * `ExtractedPolicyData<AutoPolicyFacts>.data` when `schemaVersion` is
 * `AUTO_POLICY_SCHEMA_VERSION`. This is what any extraction provider
 * (dev fallback, regex/keyword, or a future AI/OCR provider) must
 * produce, and what the Wallet UI and Ask Roni read.
 *
 * FALSE VS. UNKNOWN (read this before touching any field below):
 * every `included: boolean | null` is three-state on purpose.
 *   - `true`  → the policy document says this coverage is included.
 *   - `false` → the policy document says this coverage is NOT included.
 *   - `null`  → RONI doesn't know yet (not extracted, or not found in
 *               the document). This is NOT the same claim as `false`
 *               and must never be displayed or reasoned about as if
 *               it were.
 * The same rule applies to every other nullable field here: `null`
 * always means "unknown," never "no" or "zero."
 *
 * SCHEMA VERSIONING (M3.2): bumped `"auto.v1"` → `"auto.v2"` to add
 * `included`/`deductible` to PIP, `included` to Medical Payments, and
 * `included` to Uninsured/Underinsured Motorist (previously these
 * were bare limits with no three-state coverage flag). A stored
 * `policy_extracted_data` row's `data` always carries its own
 * `schemaVersion`, so old and new rows can coexist in the same table
 * without migrating existing data — a row is only ever read back
 * through `sanitizeAutoPolicyFacts()` (`lib/wallet/validate-auto-policy-facts.ts`),
 * which normalizes either shape (or anything malformed) into a
 * current, valid `AutoPolicyFacts` rather than trusting the stored
 * JSON directly. This is also what makes re-extraction with a newer
 * schema version safe later: reprocessing an existing document just
 * inserts a new `policy_extracted_data` row with the current
 * `schemaVersion` — the document itself is never touched.
 */

export const AUTO_POLICY_SCHEMA_VERSION = "auto.v2" as const;

export interface AutoPolicySummary {
  category: "auto";
  carrier: string | null;
  policyNumber: string | null;
  status: "active" | "pending" | "expired" | "cancelled" | null;
  effectiveDate: string | null; // ISO date
  expirationDate: string | null; // ISO date
  /** 2-letter USPS state the policy is written in. */
  state: string | null;
  premiumAmount: number | null;
  premiumFrequency: "monthly" | "quarterly" | "semi_annual" | "annual" | "other" | null;
  /** Total premium for the full policy term, when the document states one. */
  termPremium: number | null;
}

export interface AutoDriver {
  name: string | null;
  dateOfBirth: string | null;
  licenseState: string | null;
}

export interface AutoInsured {
  namedInsured: string | null;
  address: string | null;
  drivers: AutoDriver[];
}

export type VehicleUsage = "commute" | "pleasure" | "business" | "rideshare" | "farm" | null;

export interface AutoVehicle {
  year: number | null;
  make: string | null;
  model: string | null;
  /**
   * Store the REAL VIN here — this field is not itself masked. Any UI
   * or log that touches a vehicle must call `maskVin()`
   * (`lib/wallet/mask.ts`) before displaying or writing it anywhere
   * (M3.0 spec §10).
   */
  vin: string | null;
  usage: VehicleUsage;
  annualMileage: number | null;
  lienholder: string | null;
}

export interface LimitPair {
  perPerson: number | null;
  perAccident: number | null;
}

export interface SingleLimit {
  limit: number | null;
}

export interface DeductibleCoverage {
  /** Three-state — see the file-level note on false vs. unknown. */
  included: boolean | null;
  deductible: number | null;
}

export interface RentalReimbursementCoverage {
  included: boolean | null;
  limitPerDay: number | null;
  maxDays: number | null;
}

export interface RoadsideAssistanceCoverage {
  included: boolean | null;
  /** Free-text, e.g. "Up to $75 per disablement" — roadside limits vary too much by carrier for a clean structured shape; kept as plain text rather than invented fields. */
  details: string | null;
}

/** `auto.v2` — PIP now carries its own three-state `included` (a policy can state PIP explicitly excluded, distinct from "not determined") plus an optional deductible, matching how Collision/Comprehensive already model included+deductible. */
export interface PersonalInjuryProtectionCoverage {
  included: boolean | null;
  limit: number | null;
  deductible: number | null;
}

/** `auto.v2` — adds `included`, previously implied only by `limit` being non-null (which conflated "not extracted" with "not included"). */
export interface MedicalPaymentsCoverage {
  included: boolean | null;
  limit: number | null;
}

/** `auto.v2` — shared shape for both Uninsured and Underinsured Motorist; adds `included` for the same reason as Medical Payments. */
export interface UninsuredMotoristCoverage {
  included: boolean | null;
  perPerson: number | null;
  perAccident: number | null;
}

export interface AutoCoverages {
  bodilyInjury: LimitPair | null;
  propertyDamage: SingleLimit | null;
  personalInjuryProtection: PersonalInjuryProtectionCoverage;
  medicalPayments: MedicalPaymentsCoverage;
  uninsuredMotorist: UninsuredMotoristCoverage;
  underinsuredMotorist: UninsuredMotoristCoverage;
  collision: DeductibleCoverage;
  comprehensive: DeductibleCoverage;
  rentalReimbursement: RentalReimbursementCoverage;
  roadsideAssistance: RoadsideAssistanceCoverage;
}

export interface AutoPolicyFacts {
  schemaVersion: typeof AUTO_POLICY_SCHEMA_VERSION;
  policy: AutoPolicySummary;
  insured: AutoInsured;
  vehicles: AutoVehicle[];
  coverages: AutoCoverages;
  other: {
    discounts: string[];
    /** Verbatim-ish, short descriptions — not full policy text. */
    importantExclusions: string[];
  };
}

/** An empty-but-valid `AutoPolicyFacts` — every fact `null`/empty, nothing guessed. Useful as a starting point before any extraction has run. */
export function emptyAutoPolicyFacts(): AutoPolicyFacts {
  return {
    schemaVersion: AUTO_POLICY_SCHEMA_VERSION,
    policy: {
      category: "auto",
      carrier: null,
      policyNumber: null,
      status: null,
      effectiveDate: null,
      expirationDate: null,
      state: null,
      premiumAmount: null,
      premiumFrequency: null,
      termPremium: null,
    },
    insured: { namedInsured: null, address: null, drivers: [] },
    vehicles: [],
    coverages: {
      bodilyInjury: null,
      propertyDamage: null,
      personalInjuryProtection: { included: null, limit: null, deductible: null },
      medicalPayments: { included: null, limit: null },
      uninsuredMotorist: { included: null, perPerson: null, perAccident: null },
      underinsuredMotorist: { included: null, perPerson: null, perAccident: null },
      collision: { included: null, deductible: null },
      comprehensive: { included: null, deductible: null },
      rentalReimbursement: { included: null, limitPerDay: null, maxDays: null },
      roadsideAssistance: { included: null, details: null },
    },
    other: { discounts: [], importantExclusions: [] },
  };
}
