import "server-only";
import type { HealthPlan, HealthQuoteError, HealthSearchCriteria, HealthSearchMeta } from "@/lib/types";
import {
  CmsConfigError,
  CmsHttpError,
  CmsMalformedResponseError,
  CmsTimeoutError,
  cmsCountiesByZip,
  cmsMarketYears,
  cmsPlanDetails,
  cmsSearchPlans,
  type CmsHousehold,
  type CmsPerson,
  type CmsPlace,
} from "@/lib/services/cms/client";
import { normalizeCmsPlan } from "@/lib/services/cms/normalize";
import type { CmsZipCounty } from "@/lib/services/cms/types";

export type QuoteResult<T> = { ok: true; data: T } | { ok: false; error: HealthQuoteError };

/**
 * The Health equivalent of Auto's `InsuranceQuoteProvider`
 * (`lib/services/quote-provider.ts`). Kept as its own interface
 * rather than forcing Health into Auto's shape — a real CMS request
 * needs a household/place/year, which doesn't fit `getOptions(category)`.
 * Both are examples of the same pattern: one interface, one real or
 * fictional implementation behind it, swappable without touching the
 * UI (M2.5 spec §7).
 *
 * Only `CMSMarketplaceProvider` exists today. A future private-carrier
 * provider for Health would implement this same interface.
 */
export interface HealthQuoteProvider {
  marketYears(): Promise<QuoteResult<{ current: number; supported: number[] }>>;
  countiesByZip(zip: string): Promise<QuoteResult<CmsZipCounty[]>>;
  search(criteria: HealthSearchCriteria): Promise<QuoteResult<{ plans: HealthPlan[]; meta: HealthSearchMeta }>>;
  planDetails(planId: string, criteria: HealthSearchCriteria): Promise<QuoteResult<HealthPlan>>;
}

function err(code: HealthQuoteError["code"], message: string): { ok: false; error: HealthQuoteError } {
  return { ok: false, error: { code, message } };
}

/** Translates a thrown CMS client error into a friendly `HealthQuoteError` — never the raw CMS message (M2.5 spec §8). */
function translateError(e: unknown): { ok: false; error: HealthQuoteError } {
  if (e instanceof CmsConfigError) {
    return err("missing_api_key", "Roni's connection to the Health Marketplace isn't set up yet. Please try again later.");
  }
  if (e instanceof CmsTimeoutError) {
    return err("timeout", "The Health Marketplace is taking too long to respond. Please try again in a moment.");
  }
  if (e instanceof CmsMalformedResponseError) {
    return err("malformed_response", "Roni got an unexpected response from the Health Marketplace. Please try again.");
  }
  if (e instanceof CmsHttpError) {
    if (e.status === 400) return err("invalid_request", "That request wasn't valid — please check your ZIP code and answers.");
    if (e.status === 404) return err("no_plans", "Roni couldn't find that in the Health Marketplace.");
    return err("cms_unavailable", "The Health Marketplace isn't available right now. Please try again in a moment.");
  }
  return err("unknown", "Something went wrong looking up Health plans. Please try again.");
}

function personFromAnswers(
  age: string,
  dob: string,
  gender: "Male" | "Female" | "",
  usesTobacco: "yes" | "no" | "",
  aptcEligible: boolean,
): CmsPerson {
  const person: CmsPerson = {};
  if (age) person.age = Number(age);
  else if (dob) person.dob = dob;
  if (gender) person.gender = gender;
  if (usesTobacco) person.uses_tobacco = usesTobacco === "yes";
  if (aptcEligible) person.aptc_eligible = true;
  return person;
}

/**
 * Builds CMS's `household.people[]` from real, user-entered data only.
 *
 * CORRECTION (post-M2.5): this used to send only the primary
 * applicant regardless of how many household members were added,
 * silently under-pricing any household of 2+. It now sends one real
 * `Person` per household member RONI actually collected data for —
 * the primary applicant first (CMS's docs: "first is considered the
 * subscriber"), then each additional member. Nothing is invented: a
 * member RONI has no age/dob for is never added to this array in the
 * first place (see `HealthQuoteProvider.householdComplete` and the
 * Household step's validation, which require age/dob + tobacco use
 * before a member can be submitted).
 */
function toCmsHousehold(criteria: HealthSearchCriteria): CmsHousehold {
  const aptcEligible = Boolean(criteria.household.income);
  const people: CmsPerson[] = [
    personFromAnswers(criteria.applicant.age, criteria.applicant.dob, criteria.applicant.gender, criteria.applicant.usesTobacco, aptcEligible),
    ...criteria.household.additionalMembers.map((m) => personFromAnswers(m.age, m.dob, m.gender, m.usesTobacco, aptcEligible)),
  ];
  const household: CmsHousehold = { people };
  if (criteria.household.income) household.income = Number(criteria.household.income);
  return household;
}

function toCmsPlace(criteria: HealthSearchCriteria): CmsPlace {
  return {
    countyfips: criteria.location.countyfips,
    state: criteria.location.state,
    zipcode: criteria.location.zip,
  };
}

/** The one real implementation: talks to CMS through the server-only client. */
export class CMSMarketplaceProvider implements HealthQuoteProvider {
  async marketYears(): Promise<QuoteResult<{ current: number; supported: number[] }>> {
    try {
      const res = await cmsMarketYears();
      if (typeof res.current !== "number") return err("malformed_response", "Roni couldn't determine the current coverage year.");
      return { ok: true, data: { current: res.current, supported: res.supported ?? [res.current] } };
    } catch (e) {
      return translateError(e);
    }
  }

  async countiesByZip(zip: string): Promise<QuoteResult<CmsZipCounty[]>> {
    if (!/^\d{3,5}$/.test(zip)) return err("invalid_zip", "That doesn't look like a valid ZIP code.");
    try {
      const res = await cmsCountiesByZip(zip);
      const counties = res.counties ?? [];
      if (counties.length === 0) return err("invalid_zip", "Roni couldn't find that ZIP code. Please double-check it.");
      return { ok: true, data: counties };
    } catch (e) {
      return translateError(e);
    }
  }

  /**
   * CMS's `/plans/search` is paginated — 10 plans per page per CMS's
   * own docs, controlled only by `offset` (see the citation on
   * `CmsPlanSearchRequest` in `cms/client.ts`). This fetches
   * successive pages until one of:
   *   - a short page (fewer than `CMS_PAGE_SIZE` plans) signals the
   *     last page,
   *   - the loaded count reaches CMS's own reported `total`,
   *   - the `MAX_PAGES` safety cap is hit, or
   *   - a page after the first fails, in which case RONI stops and
   *     reports what it has as `meta.complete: false` rather than
   *     either discarding good results or claiming a complete set it
   *     doesn't have (M2.5.1 spec §9).
   * Plans are de-duplicated by CMS plan ID as they're collected.
   */
  async search(criteria: HealthSearchCriteria): Promise<QuoteResult<{ plans: HealthPlan[]; meta: HealthSearchMeta }>> {
    if (!criteria.location.countyfips || !criteria.location.state) {
      return err("county_required", "Roni needs your county to search for plans — please go back and confirm your ZIP code.");
    }

    const CMS_PAGE_SIZE = 10; // fixed by CMS, not configurable — see CmsPlanSearchRequest
    const MAX_PAGES = 10; // safety cap: at most 100 plans fetched per search

    const collected = new Map<string, HealthPlan>();
    let totalFromCms: number | null = null;
    let complete = true;

    for (let page = 0; page < MAX_PAGES; page++) {
      let res: Awaited<ReturnType<typeof cmsSearchPlans>> | undefined;
      try {
        res = await cmsSearchPlans({
          household: toCmsHousehold(criteria),
          market: "Individual",
          place: toCmsPlace(criteria),
          year: criteria.year,
          offset: page * CMS_PAGE_SIZE,
        });
      } catch (e) {
        if (collected.size > 0) {
          // A later page failed — keep what already loaded successfully
          // rather than throwing away good results or pretending the
          // set is complete.
          complete = false;
          break;
        }
        return translateError(e);
      }
      if (!res) break; // defensive — the catch above always exits, so this never actually runs

      if (typeof res.total === "number") totalFromCms = res.total;
      const rawPlans = res.plans ?? [];
      for (const p of rawPlans) {
        if (p.id && !collected.has(p.id)) collected.set(p.id, normalizeCmsPlan(p, criteria.year));
      }

      const gotFullPage = rawPlans.length >= CMS_PAGE_SIZE;
      const reachedReportedTotal = totalFromCms !== null && collected.size >= totalFromCms;
      if (!gotFullPage || reachedReportedTotal) break;
    }

    const plans = Array.from(collected.values());
    if (plans.length === 0) {
      return err("no_plans", "Roni didn't find any Marketplace plans for that area and year.");
    }

    const meta: HealthSearchMeta = {
      totalAvailable: totalFromCms,
      loadedCount: plans.length,
      uniqueCarrierCount: new Set(plans.map((p) => p.issuer)).size,
      complete,
    };
    return { ok: true, data: { plans, meta } };
  }

  async planDetails(planId: string, criteria: HealthSearchCriteria): Promise<QuoteResult<HealthPlan>> {
    if (!criteria.location.countyfips || !criteria.location.state) {
      return err("county_required", "Roni needs your county to load this plan — please go back and confirm your ZIP code.");
    }
    try {
      const res = await cmsPlanDetails(planId, {
        household: toCmsHousehold(criteria),
        place: toCmsPlace(criteria),
        market: "Individual",
        year: criteria.year,
      });
      if (!res.plan) return err("no_plans", "Roni couldn't find that plan.");
      return { ok: true, data: normalizeCmsPlan(res.plan, criteria.year) };
    } catch (e) {
      return translateError(e);
    }
  }
}

/** The provider RONI currently uses for Health. Swap this line for a future private-carrier provider. */
export const healthQuoteProvider: HealthQuoteProvider = new CMSMarketplaceProvider();
