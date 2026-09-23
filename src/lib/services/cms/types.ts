/**
 * Raw shapes returned by the CMS Marketplace API
 * (https://marketplace.api.healthcare.gov/api/v1), trimmed to the
 * fields RONI actually reads. These are NOT RONI's domain types —
 * `lib/services/cms/normalize.ts` is the only place that should ever
 * import both this file and `@/lib/types` together, per the M2.5
 * brief §1 ("isolate raw CMS response types from RONI types").
 *
 * Field names and shapes are taken directly from CMS's published
 * OpenAPI spec (developer.cms.gov/public-apis/documentation/marketplace-api),
 * not invented.
 */

export interface CmsZipCounty {
  fips: string;
  name: string;
  state: string;
  zipcode: string;
}

export interface CmsCostSharing {
  coinsurance_options?: string;
  coinsurance_rate?: number;
  copay_amount?: number;
  copay_options?: string;
  network_tier?: string;
  csr?: string;
  display_string?: string;
}

export interface CmsBenefit {
  name: string;
  covered?: boolean;
  cost_sharings?: CmsCostSharing[];
  explanation?: string;
  exclusions?: string;
}

export interface CmsDeductibleOrMoop {
  amount?: number;
  csr?: string;
  family_cost?: string; // "Individual" | "Family" | "Family Per Person"
  network_tier?: string; // "In-Network" | "In-Network Tier 2" | "Out-of-Network" | "Combined In-Out of Network"
  type?: string;
  individual?: boolean;
  family?: boolean;
  display_string?: string;
}

export interface CmsIssuer {
  id?: string;
  name?: string;
  state?: string;
}

export interface CmsQualityRating {
  available?: boolean;
  global_rating?: number;
}

export interface CmsPlan {
  id: string;
  name?: string;
  type?: string; // PlanTypeEnum: Indemnity | PPO | HMO | EPO | POS
  metal_level?: string; // MetalLevelEnum
  premium?: number;
  premium_w_credit?: number;
  deductibles?: CmsDeductibleOrMoop[];
  moops?: CmsDeductibleOrMoop[];
  benefits?: CmsBenefit[];
  hsa_eligible?: boolean;
  has_national_network?: boolean;
  issuer?: CmsIssuer;
  quality_rating?: CmsQualityRating;
  benefits_url?: string;
  network_url?: string;
}

export interface CmsRange {
  min?: number;
  max?: number;
}

export interface CmsPlanSearchResponse {
  plans?: CmsPlan[];
  total?: number;
  ranges?: {
    premiums?: CmsRange;
    deductibles?: CmsRange;
  };
}

export interface CmsPlanDetailsResponse {
  plan?: CmsPlan;
}

export interface CmsMarketYearsResponse {
  current?: number;
  supported?: number[];
}

/** CMS's own error envelope — never forwarded to the client as-is (M2.5 spec §8). */
export interface CmsErrorBody {
  code?: string;
  status?: string;
  message?: string;
  error?: string;
}
