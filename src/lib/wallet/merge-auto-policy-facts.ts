import {
  AUTO_POLICY_SCHEMA_VERSION,
  type AutoCoverages,
  type AutoPolicyFacts,
  type AutoPolicySummary,
  type DeductibleCoverage,
  type LimitPair,
  type MedicalPaymentsCoverage,
  type PersonalInjuryProtectionCoverage,
  type RentalReimbursementCoverage,
  type RoadsideAssistanceCoverage,
  type SingleLimit,
  type UninsuredMotoristCoverage,
} from "@/lib/wallet/schemas/auto-policy";

/**
 * M3.3 §7, "DATABASE PERSISTENCE": *"If there is a conflict between a
 * manual verified value and a new AI extraction, the manual verified
 * value must win."*
 *
 * This app never overwrites a saved `policy_extracted_data` row — a
 * manual save and every extraction pass are each their own row
 * (`extractedBy: "manual"` vs. e.g. `"text-extract:..."` /
 * `"anthropic:..."`), so nothing is ever destroyed (brief §7: "Do not
 * destroy previously verified/manual user data when re-extracting").
 * What "the manual value wins" means in a world where both rows still
 * exist side by side is a MERGE at read time, not at write time — this
 * function is that merge, field by field:
 *
 *   - a person's manually-entered value, wherever they entered one
 *     (non-null), always wins over whatever the latest automatic
 *     extraction says for that SAME field, even if the automatic pass
 *     ran more recently (e.g. a "retry extraction" after the person
 *     already corrected something).
 *   - a field the person left blank keeps falling back to the latest
 *     automatic extraction's value for that field — manually verifying
 *     one fact (say, the VIN) doesn't blank out everything else the
 *     document extraction already found.
 *   - `drivers`/`vehicles`/`discounts`/`importantExclusions` are
 *     merged as whole lists rather than element-by-element (there's no
 *     reliable key to match "driver 2" across a manual list and an
 *     extracted list) — a non-empty manual list wins wholesale,
 *     otherwise the automatic list is kept.
 *
 * Used by `getEffectiveAutoPolicyFacts` (`lib/wallet/repository.ts`),
 * the one place this merge happens — every caller (Policy Dashboard,
 * Ask Roni, Compare My Policy, the manual-edit form's own prefill)
 * reads through that function rather than re-implementing this logic.
 */
export function mergeAutoPolicyFacts(automatic: AutoPolicyFacts, manual: AutoPolicyFacts): AutoPolicyFacts {
  return {
    schemaVersion: AUTO_POLICY_SCHEMA_VERSION,
    policy: mergePolicySummary(automatic.policy, manual.policy),
    insured: {
      namedInsured: pref(manual.insured.namedInsured, automatic.insured.namedInsured),
      address: pref(manual.insured.address, automatic.insured.address),
      drivers: manual.insured.drivers.length > 0 ? manual.insured.drivers : automatic.insured.drivers,
    },
    vehicles: manual.vehicles.length > 0 ? manual.vehicles : automatic.vehicles,
    coverages: mergeCoverages(automatic.coverages, manual.coverages),
    other: {
      discounts: manual.other.discounts.length > 0 ? manual.other.discounts : automatic.other.discounts,
      importantExclusions: manual.other.importantExclusions.length > 0 ? manual.other.importantExclusions : automatic.other.importantExclusions,
    },
  };
}

/** Manual's non-null value wins; otherwise fall back to automatic's. Never a coerced/guessed third value. */
function pref<T>(manualValue: T | null, automaticValue: T | null): T | null {
  return manualValue !== null ? manualValue : automaticValue;
}

function mergePolicySummary(automatic: AutoPolicySummary, manual: AutoPolicySummary): AutoPolicySummary {
  return {
    category: "auto",
    carrier: pref(manual.carrier, automatic.carrier),
    policyNumber: pref(manual.policyNumber, automatic.policyNumber),
    status: pref(manual.status, automatic.status),
    effectiveDate: pref(manual.effectiveDate, automatic.effectiveDate),
    expirationDate: pref(manual.expirationDate, automatic.expirationDate),
    state: pref(manual.state, automatic.state),
    premiumAmount: pref(manual.premiumAmount, automatic.premiumAmount),
    premiumFrequency: pref(manual.premiumFrequency, automatic.premiumFrequency),
    termPremium: pref(manual.termPremium, automatic.termPremium),
  };
}

function mergeLimitPair(automatic: LimitPair | null, manual: LimitPair | null): LimitPair | null {
  if (!manual) return automatic;
  if (!automatic) return manual;
  return { perPerson: pref(manual.perPerson, automatic.perPerson), perAccident: pref(manual.perAccident, automatic.perAccident) };
}

function mergeSingleLimit(automatic: SingleLimit | null, manual: SingleLimit | null): SingleLimit | null {
  if (!manual) return automatic;
  if (!automatic) return manual;
  return { limit: pref(manual.limit, automatic.limit) };
}

function mergeDeductibleCoverage(automatic: DeductibleCoverage, manual: DeductibleCoverage): DeductibleCoverage {
  return { included: pref(manual.included, automatic.included), deductible: pref(manual.deductible, automatic.deductible) };
}

function mergePip(automatic: PersonalInjuryProtectionCoverage, manual: PersonalInjuryProtectionCoverage): PersonalInjuryProtectionCoverage {
  return {
    included: pref(manual.included, automatic.included),
    limit: pref(manual.limit, automatic.limit),
    deductible: pref(manual.deductible, automatic.deductible),
  };
}

function mergeMedPay(automatic: MedicalPaymentsCoverage, manual: MedicalPaymentsCoverage): MedicalPaymentsCoverage {
  return { included: pref(manual.included, automatic.included), limit: pref(manual.limit, automatic.limit) };
}

function mergeUninsuredMotorist(automatic: UninsuredMotoristCoverage, manual: UninsuredMotoristCoverage): UninsuredMotoristCoverage {
  return {
    included: pref(manual.included, automatic.included),
    perPerson: pref(manual.perPerson, automatic.perPerson),
    perAccident: pref(manual.perAccident, automatic.perAccident),
  };
}

function mergeRental(automatic: RentalReimbursementCoverage, manual: RentalReimbursementCoverage): RentalReimbursementCoverage {
  return {
    included: pref(manual.included, automatic.included),
    limitPerDay: pref(manual.limitPerDay, automatic.limitPerDay),
    maxDays: pref(manual.maxDays, automatic.maxDays),
  };
}

function mergeRoadside(automatic: RoadsideAssistanceCoverage, manual: RoadsideAssistanceCoverage): RoadsideAssistanceCoverage {
  return { included: pref(manual.included, automatic.included), details: pref(manual.details, automatic.details) };
}

function mergeCoverages(automatic: AutoCoverages, manual: AutoCoverages): AutoCoverages {
  return {
    bodilyInjury: mergeLimitPair(automatic.bodilyInjury, manual.bodilyInjury),
    propertyDamage: mergeSingleLimit(automatic.propertyDamage, manual.propertyDamage),
    personalInjuryProtection: mergePip(automatic.personalInjuryProtection, manual.personalInjuryProtection),
    medicalPayments: mergeMedPay(automatic.medicalPayments, manual.medicalPayments),
    uninsuredMotorist: mergeUninsuredMotorist(automatic.uninsuredMotorist, manual.uninsuredMotorist),
    underinsuredMotorist: mergeUninsuredMotorist(automatic.underinsuredMotorist, manual.underinsuredMotorist),
    collision: mergeDeductibleCoverage(automatic.collision, manual.collision),
    comprehensive: mergeDeductibleCoverage(automatic.comprehensive, manual.comprehensive),
    rentalReimbursement: mergeRental(automatic.rentalReimbursement, manual.rentalReimbursement),
    roadsideAssistance: mergeRoadside(automatic.roadsideAssistance, manual.roadsideAssistance),
  };
}
