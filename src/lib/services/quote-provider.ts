import type { InsuranceOption, PolicyCategory } from "@/lib/types";
import { AUTO_OPTIONS } from "@/lib/data/auto-options";

/**
 * The seam between "where quotes come from" and everything that
 * displays them. Today there is exactly one implementation
 * (`FictionalQuoteProvider`, fictional/illustrative data only). A
 * later milestone can add `BindableQuoteProvider`,
 * `CarrierApiQuoteProvider`, etc. that fetch real quotes — as long as
 * they return `InsuranceOption[]`, nothing in `components/` or
 * `app/(app)/market/` has to change.
 *
 * Not wired to any real service yet — see the M2 brief, §11.
 */
export interface InsuranceQuoteProvider {
  /** Resolves to the available options for a category (empty array if none). */
  getOptions(category: PolicyCategory): Promise<InsuranceOption[]>;
}

/** Returns the same fixed, clearly-labeled fictional catalog for every request. */
export class FictionalQuoteProvider implements InsuranceQuoteProvider {
  async getOptions(category: PolicyCategory): Promise<InsuranceOption[]> {
    if (category === "auto") return AUTO_OPTIONS;
    return [];
  }
}

/** The provider the app currently uses. Swap this line, not the callers. */
export const quoteProvider: InsuranceQuoteProvider = new FictionalQuoteProvider();
