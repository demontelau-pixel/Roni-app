import "server-only";
import type {
  CmsErrorBody,
  CmsMarketYearsResponse,
  CmsPlanDetailsResponse,
  CmsPlanSearchResponse,
  CmsZipCounty,
} from "@/lib/services/cms/types";

/**
 * Server-only client for the CMS Marketplace API
 * (https://developer.cms.gov/marketplace-api/). The `server-only`
 * import above is not decorative: if this module is ever pulled into
 * a client bundle, Next.js fails the build rather than shipping it to
 * the browser. This is the ONLY file in RONI that reads
 * `CMS_MARKETPLACE_API_KEY` (M2.5 spec §1, §6).
 */

const CMS_BASE_URL = "https://marketplace.api.healthcare.gov/api/v1";
const REQUEST_TIMEOUT_MS = 10_000;

export class CmsConfigError extends Error {
  constructor() {
    super("CMS_MARKETPLACE_API_KEY is not set");
    this.name = "CmsConfigError";
  }
}

export class CmsTimeoutError extends Error {
  constructor() {
    super("CMS Marketplace API request timed out");
    this.name = "CmsTimeoutError";
  }
}

export class CmsHttpError extends Error {
  constructor(
    public status: number,
    public body: CmsErrorBody | null,
  ) {
    super(`CMS Marketplace API returned HTTP ${status}`);
    this.name = "CmsHttpError";
  }
}

export class CmsMalformedResponseError extends Error {
  constructor() {
    super("CMS Marketplace API returned a response RONI couldn't parse");
    this.name = "CmsMalformedResponseError";
  }
}

/** Reads the key at call time (not at module load) so a missing key fails
 *  the specific request instead of crashing the whole server process. */
function requireApiKey(): string {
  const key = process.env.CMS_MARKETPLACE_API_KEY;
  if (!key) throw new CmsConfigError();
  return key;
}

interface CmsRequestOptions {
  method?: "GET" | "POST";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}

async function cmsFetch<T>(path: string, opts: CmsRequestOptions = {}): Promise<T> {
  const apikey = requireApiKey();
  const url = new URL(CMS_BASE_URL + path);
  url.searchParams.set("apikey", apikey);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: opts.method ?? "GET",
      headers: opts.body ? { "content-type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
      // This data changes daily on CMS's side; RONI adds its own short
      // cache at the route-handler level where it makes sense instead.
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw new CmsTimeoutError();
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new CmsMalformedResponseError();
    }
  }

  if (!response.ok) {
    throw new CmsHttpError(response.status, (parsed as CmsErrorBody) ?? null);
  }

  return parsed as T;
}

export function cmsMarketYears(): Promise<CmsMarketYearsResponse> {
  return cmsFetch<CmsMarketYearsResponse>("/market-years");
}

export function cmsCountiesByZip(zip: string): Promise<{ counties?: CmsZipCounty[] }> {
  return cmsFetch<{ counties?: CmsZipCounty[] }>(`/counties/by/zip/${encodeURIComponent(zip)}`);
}

export interface CmsPlace {
  countyfips: string;
  state: string;
  zipcode: string;
}

export interface CmsPerson {
  age?: number;
  dob?: string;
  gender?: "Male" | "Female";
  uses_tobacco?: boolean;
  aptc_eligible?: boolean;
}

export interface CmsHousehold {
  income?: number;
  people: CmsPerson[];
}

/**
 * Verified against CMS's current published `PlanSearchRequest` schema
 * (developer.cms.gov/public-apis/documentation/marketplace-api,
 * re-checked for M2.5.1): its documented properties are `filter`,
 * `household`, `offset`, `order`, `place`, `sort`, `year`, `market`,
 * `aptc_override`, `csr_override`, `catastrophic_override`,
 * `suppressed_plan_ids` — there is no `limit` field. CMS's own docs
 * say plainly: "This API is paged. Ten results are returned for each
 * query... Use the offset parameter to get results beyond the first
 * page." Page size is fixed by CMS at 10; only `offset` is ours to
 * control. An earlier version of this client sent an undocumented
 * `limit` field, which CMS most likely just ignored — removed here.
 */
export interface CmsPlanSearchRequest {
  household: CmsHousehold;
  market: "Individual";
  place: CmsPlace;
  year: number;
  offset?: number;
}

export function cmsSearchPlans(body: CmsPlanSearchRequest): Promise<CmsPlanSearchResponse> {
  return cmsFetch<CmsPlanSearchResponse>("/plans/search", { method: "POST", body });
}

export interface CmsPlanDetailsRequest {
  household: CmsHousehold;
  place: CmsPlace;
  market: "Individual";
  year?: number;
}

/**
 * Verified against CMS's current published OpenAPI spec
 * (developer.cms.gov/public-apis/documentation/marketplace-api,
 * checked live during the M2.5 correction) — `/plans/{plan_id}` has
 * TWO documented operations, not one:
 *   GET  — "Get a plan's basic details, no premium or APTC calculated."
 *   POST — "Get a plan's details, with premium and tax credit
 *           calculated." (body: household, place, market, year — same
 *           shape as /plans/search), x-summary: "Get plan details with
 *           premiums for a household"
 * RONI uses POST here on purpose: a plan detail page with no premium
 * for the person's actual household would be a downgrade from what
 * they already saw on the results list. This is not an invented
 * endpoint — it's CMS's own documented, household-aware plan-details
 * operation, at the same path as the simpler GET.
 */
export function cmsPlanDetails(planId: string, body: CmsPlanDetailsRequest): Promise<CmsPlanDetailsResponse> {
  return cmsFetch<CmsPlanDetailsResponse>(`/plans/${encodeURIComponent(planId)}`, { method: "POST", body });
}
