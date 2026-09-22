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
