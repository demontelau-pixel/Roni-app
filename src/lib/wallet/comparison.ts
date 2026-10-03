import type { AutoPolicyFacts } from "@/lib/wallet/schemas/auto-policy";
import { EMPTY_AUTO_DRIVER, EMPTY_AUTO_VEHICLE, type AutoDriverAnswers, type AutoVehicleAnswers } from "@/lib/types";

/**
 * The normalized shape M3.4 asks for: "a normalized ComparisonProfile
 * from the existing policy so future Auto quote providers can receive
 * comparable inputs." This is intentionally a plain derived value —
 * nothing persists it (no new table/migration; see the M3.1–M3.4
 * companion doc for why none was needed) — built fresh from the
 * policy's current facts whenever `/wallet/[policyId]/compare` is
 * opened.
 */
export interface ComparisonProfile {
  state: string | null;
  vehicle: { year: number | null; make: string | null; model: string | null } | null;
  bodilyInjury: { perPerson: number | null; perAccident: number | null } | null;
  propertyDamageLimit: number | null;
  collisionDeductible: number | null;
  comprehensiveDeductible: number | null;
  uninsuredMotorist: { perPerson: number | null; perAccident: number | null } | null;
  rentalReimbursementIncluded: boolean | null;
  roadsideAssistanceIncluded: boolean | null;
  currentCarrier: string | null;
  currentMonthlyPremium: number | null;
}

export function buildComparisonProfile(facts: AutoPolicyFacts): ComparisonProfile {
  const vehicle = facts.vehicles[0];
  return {
    state: facts.policy.state,
    vehicle: vehicle ? { year: vehicle.year, make: vehicle.make, model: vehicle.model } : null,
    bodilyInjury: facts.coverages.bodilyInjury,
    propertyDamageLimit: facts.coverages.propertyDamage?.limit ?? null,
    collisionDeductible: facts.coverages.collision.deductible,
    comprehensiveDeductible: facts.coverages.comprehensive.deductible,
    uninsuredMotorist:
      facts.coverages.uninsuredMotorist.perPerson !== null || facts.coverages.uninsuredMotorist.perAccident !== null
        ? {
            perPerson: facts.coverages.uninsuredMotorist.perPerson,
            perAccident: facts.coverages.uninsuredMotorist.perAccident,
          }
        : null,
    rentalReimbursementIncluded: facts.coverages.rentalReimbursement.included,
    roadsideAssistanceIncluded: facts.coverages.roadsideAssistance.included,
    currentCarrier: facts.policy.carrier,
    currentMonthlyPremium: facts.policy.premiumFrequency === "monthly" ? facts.policy.premiumAmount : null,
  };
}

/**
 * Bridges a `ComparisonProfile` into the existing (fictional) Auto
 * Marketplace flow's own answer shapes (`lib/types.ts`), so "RONI
 * shouldn't ask twice for information it already knows" (M3.4
 * principle) without touching that flow's pages or logic.
 *
 * Deliberately narrow: only fields the Auto flow actually asks for
 * (`AutoVehicleAnswers`/`AutoDriverAnswers`) are mapped, and only when
 * we have a real, non-guessed value for them — `zip`, marital status,
 * and driving history have no source in `AutoPolicyFacts` at all and
 * are always left blank for the person to fill in, never defaulted.
 * `ownership` is inferred as `"finance"` only when a lienholder is on
 * file; otherwise it's left blank rather than assumed to be `"own"`.
 */
export function comparisonProfileToAutoQuoteSeed(
  profile: ComparisonProfile,
  facts: AutoPolicyFacts,
): { vehicle: AutoVehicleAnswers; driver: AutoDriverAnswers } {
  const vehicleRecord = facts.vehicles[0];

  const vehicle: AutoVehicleAnswers = {
    ...EMPTY_AUTO_VEHICLE,
    year: profile.vehicle?.year ? String(profile.vehicle.year) : "",
    make: profile.vehicle?.make ?? "",
    model: profile.vehicle?.model ?? "",
    ownership: vehicleRecord?.lienholder ? "finance" : "",
  };

  const driver: AutoDriverAnswers = {
    ...EMPTY_AUTO_DRIVER,
    currentlyInsured: profile.currentCarrier ? "yes" : "",
    currentCarrier: profile.currentCarrier ?? "",
    currentMonthlyPremium: profile.currentMonthlyPremium !== null ? String(profile.currentMonthlyPremium) : "",
  };

  return { vehicle, driver };
}
