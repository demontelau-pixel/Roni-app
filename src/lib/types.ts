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
