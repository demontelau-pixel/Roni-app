import type { CmsBenefit, CmsDeductibleOrMoop, CmsPlan } from "@/lib/services/cms/types";
import type { HealthBenefitSummary, HealthPlan, HealthPlanType, MetalLevel } from "@/lib/types";

const PLAN_TYPES: HealthPlanType[] = ["HMO", "PPO", "EPO", "POS", "Indemnity"];
const METAL_LEVELS: MetalLevel[] = ["Catastrophic", "Bronze", "Silver", "Gold", "Platinum"];

function asPlanType(v: string | undefined): HealthPlanType | null {
  return PLAN_TYPES.includes(v as HealthPlanType) ? (v as HealthPlanType) : null;
}
function asMetalLevel(v: string | undefined): MetalLevel | null {
  return METAL_LEVELS.includes(v as MetalLevel) ? (v as MetalLevel) : null;
}

/**
 * Individual, in-network deductibles/MOOPs come back as an array
 * because CMS also returns family, out-of-network, and CSR-variant
 * entries. We prefer the plain in-network individual medical figure —
 * the one a consumer means by "my deductible" — and fall back to any
 * individual figure if that exact shape isn't present, rather than
 * showing nothing.
 */
function pickIndividualAmount(entries: CmsDeductibleOrMoop[] | undefined, preferredTypes: string[]): number | null {
  if (!entries || entries.length === 0) return null;
  const inNetwork = entries.filter((e) => e.individual && e.network_tier === "In-Network");
  const preferred = inNetwork.find((e) => e.type && preferredTypes.includes(e.type));
  if (preferred && preferred.amount !== undefined) return preferred.amount;
  const firstInNetwork = inNetwork[0];
  if (firstInNetwork && firstInNetwork.amount !== undefined) return firstInNetwork.amount;
  const anyIndividual = entries.find((e) => e.individual);
  return anyIndividual?.amount ?? null;
}

function benefitCostSharingText(benefit: CmsBenefit | undefined): string | null {
  const cs = benefit?.cost_sharings?.[0];
  if (!cs) return null;
  if (cs.display_string) return cs.display_string;
  if (cs.copay_amount !== undefined) return `$${cs.copay_amount} copay`;
  if (cs.coinsurance_rate !== undefined) return `${Math.round(cs.coinsurance_rate * 100)}% coinsurance`;
  return null;
}

function findBenefit(benefits: CmsBenefit[] | undefined, matches: string[]): HealthBenefitSummary | null {
  if (!benefits) return null;
  const lower = matches.map((m) => m.toLowerCase());
  const found = benefits.find((b) => lower.some((m) => b.name?.toLowerCase().includes(m)));
  if (!found) return null;
  return {
    label: found.name,
    costSharing: benefitCostSharingText(found),
    covered: found.covered ?? null,
  };
}

/** Maps one raw CMS plan to RONI's `HealthPlan`. Missing CMS fields become `null` — never guessed. */
export function normalizeCmsPlan(plan: CmsPlan, year: number): HealthPlan {
  const monthlyPremiumBeforeCredit = typeof plan.premium === "number" ? plan.premium : null;
  const monthlyPremium =
    typeof plan.premium_w_credit === "number" ? plan.premium_w_credit : monthlyPremiumBeforeCredit;
  const estimatedTaxCredit =
    monthlyPremiumBeforeCredit !== null && monthlyPremium !== null && monthlyPremiumBeforeCredit !== monthlyPremium
      ? Math.max(0, Math.round((monthlyPremiumBeforeCredit - monthlyPremium) * 100) / 100)
      : null;

  return {
    id: plan.id,
    issuer: plan.issuer?.name ?? "Unknown issuer",
    planName: plan.name ?? "Unnamed plan",
    planType: asPlanType(plan.type),
    metalLevel: asMetalLevel(plan.metal_level),
    monthlyPremium,
    monthlyPremiumBeforeCredit,
    estimatedTaxCredit,
    deductible: pickIndividualAmount(plan.deductibles, ["Medical EHB Deductible", "Combined Medical and Drug EHB Deductible"]),
    maxOutOfPocket: pickIndividualAmount(plan.moops, ["Maximum Out of Pocket for Medical and Drug EHB Benefits (Total)"]),
    primaryCare: findBenefit(plan.benefits, ["primary care"]),
    specialist: findBenefit(plan.benefits, ["specialist"]),
    genericDrugs: findBenefit(plan.benefits, ["generic"]),
    hsaEligible: plan.hsa_eligible ?? null,
    hasNationalNetwork: plan.has_national_network ?? null,
    qualityRating:
      plan.quality_rating?.available && typeof plan.quality_rating.global_rating === "number"
        ? plan.quality_rating.global_rating
        : null,
    benefitsUrl: plan.benefits_url ?? null,
    networkUrl: plan.network_url ?? null,
    year,
    source: "cms",
    isReal: true,
  };
}
