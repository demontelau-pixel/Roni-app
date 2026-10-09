/**
 * The normalized, evidence-backed shape for an extracted US auto policy.
 * `null` means RONI could not determine the field from the document; it never
 * means false, zero, or a guessed default. Older stored rows are normalized by
 * `sanitizeAutoPolicyFacts` into this current schema before display or use.
 */
export const AUTO_POLICY_SCHEMA_VERSION = "auto.v3" as const;

export type PremiumFrequency = "monthly" | "quarterly" | "semi_annual" | "annual" | "other" | null;

export interface AutoPolicySummary {
  category: "auto";
  carrier: string | null;
  policyNumber: string | null;
  status: "active" | "pending" | "expired" | "cancelled" | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  /** Two-letter USPS state when the policy states it. */
  state: string | null;
  /** ISO currency only when printed or otherwise explicit in the document. */
  currency: string | null;
  /** The recurring premium amount, distinct from total term premium and installments. */
  premiumAmount: number | null;
  premiumFrequency: PremiumFrequency;
  /** Total premium for the full stated policy term. */
  termPremium: number | null;
  /** A stated installment/quoted payment amount, never inferred from the term premium. */
  paymentInstallmentAmount: number | null;
  paymentFrequency: PremiumFrequency;
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
  /** Keep the real VIN server-side; UI must call maskVin before displaying it. */
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
  /** true = explicitly included, false = explicitly excluded, null = not determined. */
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
  details: string | null;
}

export interface PersonalInjuryProtectionCoverage {
  included: boolean | null;
  limit: number | null;
  deductible: number | null;
}

export interface MedicalPaymentsCoverage {
  included: boolean | null;
  limit: number | null;
}

export interface UninsuredMotoristCoverage {
  included: boolean | null;
  perPerson: number | null;
  perAccident: number | null;
}

/** Covers policy-specific protections that do not fit a standard Auto field. */
export interface AdditionalCoverage {
  name: string;
  included: boolean | null;
  limit: string | null;
  deductible: number | null;
  details: string | null;
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
  other: AdditionalCoverage[];
}

export interface ClaimsContact {
  phone: string | null;
  email: string | null;
  website: string | null;
}

export interface AutoPolicyOther {
  discounts: string[];
  /** Verbatim-ish short descriptions; never an assertion that a future claim is denied. */
  importantExclusions: string[];
  importantConditions: string[];
  endorsements: string[];
  claimsContact: ClaimsContact;
}

export interface AutoPolicyFacts {
  schemaVersion: typeof AUTO_POLICY_SCHEMA_VERSION;
  policy: AutoPolicySummary;
  insured: AutoInsured;
  vehicles: AutoVehicle[];
  coverages: AutoCoverages;
  other: AutoPolicyOther;
}

/** Empty-but-valid facts. Every unknown remains null or an empty list. */
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
      currency: null,
      premiumAmount: null,
      premiumFrequency: null,
      termPremium: null,
      paymentInstallmentAmount: null,
      paymentFrequency: null,
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
      other: [],
    },
    other: {
      discounts: [],
      importantExclusions: [],
      importantConditions: [],
      endorsements: [],
      claimsContact: { phone: null, email: null, website: null },
    },
  };
}
