/**
 * The normalized shape of an extracted Auto policy's facts —
 * `ExtractedPolicyData<AutoPolicyFacts>.data` when `schemaVersion` is
 * `"auto.v1"`. No AI extraction exists yet (M3.0 is infrastructure
 * only); this type is what that future extraction will need to
 * produce, and what the future Wallet UI and Ask Roni will read.
 *
 * FALSE VS. UNKNOWN (read this before touching any field below):
 * every `included: boolean | null` is three-state on purpose.
 *   - `true`  → the policy document says this coverage is included.
 *   - `false` → the policy document says this coverage is NOT included.
 *   - `null`  → RONI doesn't know yet (not extracted, or not found in
 *               the document). This is NOT the same claim as `false`
 *               and must never be displayed or reasoned about as if
 *               it were — see M3.0 spec §3.
 * The same rule applies to every other nullable field here: `null`
 * always means "unknown," never "no" or "zero."
 */

export const AUTO_POLICY_SCHEMA_VERSION = "auto.v1" as const;

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
}

export interface AutoCoverages {
  bodilyInjury: LimitPair | null;
  propertyDamage: SingleLimit | null;
  personalInjuryProtection: SingleLimit | null;
  medicalPayments: SingleLimit | null;
  uninsuredMotorist: LimitPair | null;
  underinsuredMotorist: LimitPair | null;
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
      personalInjuryProtection: null,
      medicalPayments: null,
      uninsuredMotorist: null,
      underinsuredMotorist: null,
      collision: { included: null, deductible: null },
      comprehensive: { included: null, deductible: null },
      rentalReimbursement: { included: null, limitPerDay: null, maxDays: null },
      roadsideAssistance: { included: null },
    },
    other: { discounts: [], importantExclusions: [] },
  };
}
