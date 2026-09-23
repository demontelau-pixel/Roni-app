/**
 * Domain types for RONI.
 *
 * These describe the SHAPE of insurance data the UI expects. They say
 * nothing about where the data comes from — in M1 every value that
 * satisfies these types is fictional sample data (see `lib/data/`).
 * A later milestone can start returning the same shapes from Supabase
 * or a real carrier API without the components needing to change.
 */

export type PolicyCategory =
  | "auto"
  | "home"
  | "renters"
  | "life"
  | "health"
  | "pet";

export interface PolicyFact {
  label: string;
  value: string;
  /** Where this fact would be cited from in the real policy document. */
  source: string;
}

export interface CoverageItem {
  name: string;
  limit: string;
  deductible?: string;
  sourcePage: string;
  explanation: string;
}

export interface ExclusionItem {
  text: string;
  sourcePage: string;
}

/**
 * A single insurance policy, whether it lives in the user's Wallet
 * (uploaded or purchased) or is shown as a sample.
 */
export interface Policy {
  id: string;
  category: PolicyCategory;
  /** Display label for the category, e.g. "Auto". */
  type: string;
  carrier: string;
  monthlyPremium: number;
  /** ISO date string, e.g. "2026-12-14". */
  renewalDate: string;
  /** Present when RONI Monitor has detected an upcoming price change. */
  renewalPremium?: number;
  monitoring: boolean;
  /** 0–100 illustrative coverage score, used only for ranking/comparison. */
  coverageScore: number;
  deductible: number;
  /** "me" for the account holder, or a household member's first name. */
  owner: string;
  /** Short description, e.g. the insured vehicle or address. */
  label: string;
  coverageSummary: string;
  benefits: string[];
  facts: PolicyFact[];
  coverageItems: CoverageItem[];
  exclusions: ExclusionItem[];
  plainSummary: string;
  /** Always true today. Exists so a UI check can never silently start
   *  treating fictional data as real once a real source is added. */
  isFictional: true;
}

/* ------------------------------------------------------------------ */
/* M2 — Marketplace / quoting types                                    */
/* ------------------------------------------------------------------ */

/** Every category shown on the Marketplace home, including ones with
 *  no working quote flow yet ("Coming soon"). `PolicyCategory` (above)
 *  stays limited to categories a policy can actually exist in. */
export type MarketplaceCategory = PolicyCategory | "motorcycle" | "travel";

export type PurchaseMode = "roni" | "carrier" | "licensed";

export type PriorityKey = "price" | "coverage" | "deductible" | "benefits";

/**
 * A fictional, illustrative quote — NOT a real insurance product and
 * NOT a real price. Distinct from `Policy`: an `InsuranceOption` is
 * something the user could buy; a `Policy` is something they already
 * have (in their Wallet).
 */
export interface InsuranceOption {
  id: string;
  category: PolicyCategory;
  /** e.g. "Plan A" — optional, some carriers only have one plan shown. */
  planName?: string;
  carrier: string;
  monthlyPremium: number;
  coverageSummary: string;
  deductible: number;
  /** 0–100 illustrative coverage score, used only for ranking/comparison. */
  coverageScore: number;
  benefits: string[];
  exclusions: string[];
  purchaseModes: PurchaseMode[];
  /** Sponsored placements are shown separately and labeled — see M2 spec §10. */
  sponsored?: boolean;
  isFictional: true;
}

export interface AutoVehicleAnswers {
  zip: string;
  year: string;
  make: string;
  model: string;
  ownership: "own" | "finance" | "lease" | "";
}

export interface AutoDriverAnswers {
  dob: string;
  maritalStatus: "single" | "married" | "domestic_partner" | "";
  drivingHistory: "clean" | "one_incident" | "multiple_incidents" | "";
  currentlyInsured: "yes" | "no" | "";
  currentCarrier: string;
  currentMonthlyPremium: string;
}

export const EMPTY_AUTO_VEHICLE: AutoVehicleAnswers = {
  zip: "",
  year: "",
  make: "",
  model: "",
  ownership: "",
};

export const EMPTY_AUTO_DRIVER: AutoDriverAnswers = {
  dob: "",
  maritalStatus: "",
  drivingHistory: "",
  currentlyInsured: "",
  currentCarrier: "",
  currentMonthlyPremium: "",
};

/* ------------------------------------------------------------------ */
/* M2.5 Phase A — Health / CMS Marketplace types                       */
/* ------------------------------------------------------------------ */

export interface HealthLocation {
  zip: string;
  /** 5-digit county FIPS — required by CMS, resolved from the ZIP. */
  countyfips: string;
  /** 2-letter USPS state abbreviation. */
  state: string;
}

export interface HealthApplicant {
  /** Either age or dob is sent to CMS — whichever the person filled in. */
  age: string;
  dob: string;
  gender: "Male" | "Female" | "";
  usesTobacco: "yes" | "no" | "";
}

export interface HealthMember {
  /** Client-side key only — never sent to CMS. */
  id: string;
  /** Either age or dob is sent to CMS — whichever the person filled in. Same rule as the primary applicant. */
  age: string;
  dob: string;
  gender: "Male" | "Female" | "";
  usesTobacco: "yes" | "no" | "";
}

export interface HealthHousehold {
  /** Optional. Omitting it means CMS returns full price, no tax credit estimate. */
  income: string;
  /**
   * Household members beyond the primary applicant. Each one is sent
   * to CMS as its own `Person` — CMS prices a household by summing
   * real per-person data, not a headcount, so RONI collects the same
   * minimum CMS needs (age/dob + tobacco use) for each one rather
   * than guessing. See M2.5 correction notes in the README.
   */
  additionalMembers: HealthMember[];
}

export function emptyHealthMember(id: string): HealthMember {
  return { id, age: "", dob: "", gender: "", usesTobacco: "" };
}

export const EMPTY_HEALTH_LOCATION: HealthLocation = { zip: "", countyfips: "", state: "" };
export const EMPTY_HEALTH_APPLICANT: HealthApplicant = { age: "", dob: "", gender: "", usesTobacco: "" };
export const EMPTY_HEALTH_HOUSEHOLD: HealthHousehold = { income: "", additionalMembers: [] };

export type HealthPlanType = "HMO" | "PPO" | "EPO" | "POS" | "Indemnity";
export type MetalLevel = "Catastrophic" | "Bronze" | "Silver" | "Gold" | "Platinum";

/** One line item (primary care, specialist, generic drugs, ...), from CMS's `benefits[]`. */
export interface HealthBenefitSummary {
  label: string;
  /** Human-readable cost-sharing string as CMS provides it (e.g. "$30 copay"), or null if CMS didn't return one. */
  costSharing: string | null;
  covered: boolean | null;
}

/**
 * A REAL health plan normalized from the CMS Marketplace API — the
 * opposite of `InsuranceOption`/`Policy`'s `isFictional: true`. Every
 * field is either a real value from CMS or explicitly `null` when CMS
 * didn't return it — nothing here is invented (M2.5 spec §4).
 */
export interface HealthPlan {
  /** 14-character HIOS plan ID, as assigned by CMS. */
  id: string;
  issuer: string;
  planName: string;
  planType: HealthPlanType | null;
  metalLevel: MetalLevel | null;
  /** Monthly premium after an estimated tax credit is applied, if one could be calculated. */
  monthlyPremium: number | null;
  /** Monthly premium before any tax credit — always present when CMS returns a premium at all. */
  monthlyPremiumBeforeCredit: number | null;
  /** Derived: `monthlyPremiumBeforeCredit - monthlyPremium`, only when both are known. Calculated, not returned directly by CMS. */
  estimatedTaxCredit: number | null;
  /** Individual, in-network medical deductible, when CMS returns one matching that shape. */
  deductible: number | null;
  /** Individual, in-network maximum out-of-pocket. */
  maxOutOfPocket: number | null;
  primaryCare: HealthBenefitSummary | null;
  specialist: HealthBenefitSummary | null;
  genericDrugs: HealthBenefitSummary | null;
  hsaEligible: boolean | null;
  /** Whether the plan has a national provider network — the only network signal normalized in this milestone. */
  hasNationalNetwork: boolean | null;
  /** 0–5 star quality rating, only when CMS has one for this plan/year. */
  qualityRating: number | null;
  benefitsUrl: string | null;
  networkUrl: string | null;
  year: number;
  source: "cms";
  /** Always true. The real-data counterpart to `isFictional: true` elsewhere in RONI. */
  isReal: true;
}

export interface HealthSearchCriteria {
  location: HealthLocation;
  year: number;
  applicant: HealthApplicant;
  household: HealthHousehold;
}

export type HealthQuoteErrorCode =
  | "missing_api_key"
  | "invalid_zip"
  | "county_required"
  | "no_plans"
  | "cms_unavailable"
  | "timeout"
  | "malformed_response"
  | "invalid_request"
  | "unknown";

/** A friendly, pre-written error — never the raw CMS error body (M2.5 spec §8). */
export interface HealthQuoteError {
  code: HealthQuoteErrorCode;
  message: string;
}

/**
 * Metadata about a Health search result set, computed by whichever
 * `HealthQuoteProvider` ran the search (M2.5.1). Deliberately
 * provider-agnostic — nothing here is a CMS-specific field name, so a
 * future second Health provider (or a search that merges CMS with
 * another provider) can produce the same shape.
 */
export interface HealthSearchMeta {
  /** The provider's own count of how many plans matched, when it reports one. Never guessed. */
  totalAvailable: number | null;
  /** How many distinct plans RONI actually loaded (after de-duplication). */
  loadedCount: number;
  /** Distinct issuers among the loaded plans — derived from the real dataset, not requested from the provider directly. */
  uniqueCarrierCount: number;
  /** False if a later page failed and RONI stopped early — the loaded set may not be everything that matched. */
  complete: boolean;
}
