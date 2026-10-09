import { isEvidenceVerified, type ExtractionEvidence } from "@/lib/wallet/types";
import type {
  AutoCoverages,
  AutoDriver,
  AutoInsured,
  AutoPolicyFacts,
  AutoPolicySummary,
  AutoVehicle,
  DeductibleCoverage,
  LimitPair,
  MedicalPaymentsCoverage,
  PersonalInjuryProtectionCoverage,
  RentalReimbursementCoverage,
  RoadsideAssistanceCoverage,
  SingleLimit,
  UninsuredMotoristCoverage,
} from "@/lib/wallet/schemas/auto-policy";
import { unsourcedField, type ExtractedField } from "@/lib/wallet/schemas/extracted-field";

/**
 * Builds the `ExtractedField<T>`-wrapped view of an `AutoPolicyFacts`
 * object for display (M3.2/M3.3) — see the file-level comment in
 * `lib/wallet/schemas/extracted-field.ts` for why this is a
 * derivation rather than the storage shape.
 *
 * `fieldPath` convention (matches the comment in migration 0002,
 * `supabase/migrations/0002_policy_documents_and_extraction.sql`):
 * a dot-path into the stored `data` object, with `[n]` for array
 * items — e.g. `"coverages.collision.deductible"`,
 * `"vehicles[0].vin"`, `"insured.drivers[1].name"`. Any extraction
 * provider that wants its evidence to show up next to the right
 * field in the Policy Dashboard or in an Ask Roni citation must use
 * this exact convention when it calls `saveExtractionEvidence`
 * (`lib/wallet/repository.ts`).
 */

type AnnotatedPolicySummary = {
  [K in keyof AutoPolicySummary]: ExtractedField<AutoPolicySummary[K]>;
};

interface AnnotatedDriver {
  name: ExtractedField<string | null>;
  dateOfBirth: ExtractedField<string | null>;
  licenseState: ExtractedField<string | null>;
}

interface AnnotatedInsured {
  namedInsured: ExtractedField<string | null>;
  address: ExtractedField<string | null>;
  drivers: AnnotatedDriver[];
}

interface AnnotatedVehicle {
  year: ExtractedField<number | null>;
  make: ExtractedField<string | null>;
  model: ExtractedField<string | null>;
  vin: ExtractedField<string | null>;
  usage: ExtractedField<AutoVehicle["usage"]>;
  annualMileage: ExtractedField<number | null>;
  lienholder: ExtractedField<string | null>;
}

interface AnnotatedLimitPair {
  perPerson: ExtractedField<number | null>;
  perAccident: ExtractedField<number | null>;
}

interface AnnotatedSingleLimit {
  limit: ExtractedField<number | null>;
}

interface AnnotatedDeductibleCoverage {
  included: ExtractedField<boolean | null>;
  deductible: ExtractedField<number | null>;
}

interface AnnotatedRentalReimbursement {
  included: ExtractedField<boolean | null>;
  limitPerDay: ExtractedField<number | null>;
  maxDays: ExtractedField<number | null>;
}

interface AnnotatedRoadsideAssistance {
  included: ExtractedField<boolean | null>;
  details: ExtractedField<string | null>;
}

interface AnnotatedPip {
  included: ExtractedField<boolean | null>;
  limit: ExtractedField<number | null>;
  deductible: ExtractedField<number | null>;
}

interface AnnotatedMedPay {
  included: ExtractedField<boolean | null>;
  limit: ExtractedField<number | null>;
}

interface AnnotatedUm {
  included: ExtractedField<boolean | null>;
  perPerson: ExtractedField<number | null>;
  perAccident: ExtractedField<number | null>;
}

interface AnnotatedCoverages {
  bodilyInjury: AnnotatedLimitPair | null;
  propertyDamage: AnnotatedSingleLimit | null;
  personalInjuryProtection: AnnotatedPip;
  medicalPayments: AnnotatedMedPay;
  uninsuredMotorist: AnnotatedUm;
  underinsuredMotorist: AnnotatedUm;
  collision: AnnotatedDeductibleCoverage;
  comprehensive: AnnotatedDeductibleCoverage;
  rentalReimbursement: AnnotatedRentalReimbursement;
  roadsideAssistance: AnnotatedRoadsideAssistance;
  /** Additional coverage rows retain their stored values; their per-item evidence remains addressable by field path. */
  other: AutoCoverages["other"];
}

export interface AnnotatedAutoPolicyFacts {
  policy: AnnotatedPolicySummary;
  insured: AnnotatedInsured;
  vehicles: AnnotatedVehicle[];
  coverages: AnnotatedCoverages;
  other: {
    discounts: string[];
    importantExclusions: string[];
    importantConditions: string[];
    endorsements: string[];
    claimsContact: AutoPolicyFacts["other"]["claimsContact"];
  };
}

/** Evidence rows indexed by `fieldPath`, taking the most recently created row when more than one exists for the same path (shouldn't normally happen within a single extraction, but never crashes if it does). */
function indexEvidence(evidence: ExtractionEvidence[]): Map<string, ExtractionEvidence> {
  const byPath = new Map<string, ExtractionEvidence>();
  for (const item of evidence) {
    const existing = byPath.get(item.fieldPath);
    if (!existing || item.createdAt >= existing.createdAt) {
      byPath.set(item.fieldPath, item);
    }
  }
  return byPath;
}

function field<T>(byPath: Map<string, ExtractionEvidence>, path: string, value: T): ExtractedField<T> {
  const hit = byPath.get(path);
  if (!hit) return unsourcedField(value);
  return {
    value,
    confidence: hit.confidence,
    sourcePage: hit.pageNumber,
    sourceText: hit.snippet ?? hit.valueText ?? null,
    // Server-computed only (`verify-evidence.ts`) — never derived from
    // `hit.confidence` here or anywhere else. `null` only when there is
    // no page citation at all to verify; otherwise `true` only when
    // BOTH independent checks passed — everything else (a real
    // mismatch, or a check that plainly couldn't be run) is `false`,
    // shown as "Unverified reference," per migration 0007's rule that
    // nothing is silently upgraded to "Verified."
    evidenceVerified: hit.pageNumber === null ? null : isEvidenceVerified(hit),
  };
}

function annotatePolicySummary(p: AutoPolicySummary, byPath: Map<string, ExtractionEvidence>): AnnotatedPolicySummary {
  return {
    category: field(byPath, "policy.category", p.category),
    carrier: field(byPath, "policy.carrier", p.carrier),
    policyNumber: field(byPath, "policy.policyNumber", p.policyNumber),
    status: field(byPath, "policy.status", p.status),
    effectiveDate: field(byPath, "policy.effectiveDate", p.effectiveDate),
    expirationDate: field(byPath, "policy.expirationDate", p.expirationDate),
    state: field(byPath, "policy.state", p.state),
    currency: field(byPath, "policy.currency", p.currency),
    premiumAmount: field(byPath, "policy.premiumAmount", p.premiumAmount),
    premiumFrequency: field(byPath, "policy.premiumFrequency", p.premiumFrequency),
    termPremium: field(byPath, "policy.termPremium", p.termPremium),
    paymentInstallmentAmount: field(byPath, "policy.paymentInstallmentAmount", p.paymentInstallmentAmount),
    paymentFrequency: field(byPath, "policy.paymentFrequency", p.paymentFrequency),
  };
}

function annotateDriver(d: AutoDriver, byPath: Map<string, ExtractionEvidence>, index: number): AnnotatedDriver {
  return {
    name: field(byPath, `insured.drivers[${index}].name`, d.name),
    dateOfBirth: field(byPath, `insured.drivers[${index}].dateOfBirth`, d.dateOfBirth),
    licenseState: field(byPath, `insured.drivers[${index}].licenseState`, d.licenseState),
  };
}

function annotateInsured(i: AutoInsured, byPath: Map<string, ExtractionEvidence>): AnnotatedInsured {
  return {
    namedInsured: field(byPath, "insured.namedInsured", i.namedInsured),
    address: field(byPath, "insured.address", i.address),
    drivers: i.drivers.map((d, idx) => annotateDriver(d, byPath, idx)),
  };
}

function annotateVehicle(v: AutoVehicle, byPath: Map<string, ExtractionEvidence>, index: number): AnnotatedVehicle {
  return {
    year: field(byPath, `vehicles[${index}].year`, v.year),
    make: field(byPath, `vehicles[${index}].make`, v.make),
    model: field(byPath, `vehicles[${index}].model`, v.model),
    vin: field(byPath, `vehicles[${index}].vin`, v.vin),
    usage: field(byPath, `vehicles[${index}].usage`, v.usage),
    annualMileage: field(byPath, `vehicles[${index}].annualMileage`, v.annualMileage),
    lienholder: field(byPath, `vehicles[${index}].lienholder`, v.lienholder),
  };
}

function annotateLimitPair(l: LimitPair | null, byPath: Map<string, ExtractionEvidence>, base: string): AnnotatedLimitPair | null {
  if (!l) return null;
  return {
    perPerson: field(byPath, `${base}.perPerson`, l.perPerson),
    perAccident: field(byPath, `${base}.perAccident`, l.perAccident),
  };
}

function annotateSingleLimit(s: SingleLimit | null, byPath: Map<string, ExtractionEvidence>, base: string): AnnotatedSingleLimit | null {
  if (!s) return null;
  return { limit: field(byPath, `${base}.limit`, s.limit) };
}

function annotateDeductible(d: DeductibleCoverage, byPath: Map<string, ExtractionEvidence>, base: string): AnnotatedDeductibleCoverage {
  return {
    included: field(byPath, `${base}.included`, d.included),
    deductible: field(byPath, `${base}.deductible`, d.deductible),
  };
}

function annotateRental(
  r: RentalReimbursementCoverage,
  byPath: Map<string, ExtractionEvidence>,
): AnnotatedRentalReimbursement {
  return {
    included: field(byPath, "coverages.rentalReimbursement.included", r.included),
    limitPerDay: field(byPath, "coverages.rentalReimbursement.limitPerDay", r.limitPerDay),
    maxDays: field(byPath, "coverages.rentalReimbursement.maxDays", r.maxDays),
  };
}

function annotateRoadside(
  r: RoadsideAssistanceCoverage,
  byPath: Map<string, ExtractionEvidence>,
): AnnotatedRoadsideAssistance {
  return {
    included: field(byPath, "coverages.roadsideAssistance.included", r.included),
    details: field(byPath, "coverages.roadsideAssistance.details", r.details),
  };
}

function annotatePip(p: PersonalInjuryProtectionCoverage, byPath: Map<string, ExtractionEvidence>): AnnotatedPip {
  return {
    included: field(byPath, "coverages.personalInjuryProtection.included", p.included),
    limit: field(byPath, "coverages.personalInjuryProtection.limit", p.limit),
    deductible: field(byPath, "coverages.personalInjuryProtection.deductible", p.deductible),
  };
}

function annotateMedPay(m: MedicalPaymentsCoverage, byPath: Map<string, ExtractionEvidence>): AnnotatedMedPay {
  return {
    included: field(byPath, "coverages.medicalPayments.included", m.included),
    limit: field(byPath, "coverages.medicalPayments.limit", m.limit),
  };
}

function annotateUm(u: UninsuredMotoristCoverage, byPath: Map<string, ExtractionEvidence>, base: string): AnnotatedUm {
  return {
    included: field(byPath, `${base}.included`, u.included),
    perPerson: field(byPath, `${base}.perPerson`, u.perPerson),
    perAccident: field(byPath, `${base}.perAccident`, u.perAccident),
  };
}

function annotateCoverages(c: AutoCoverages, byPath: Map<string, ExtractionEvidence>): AnnotatedCoverages {
  return {
    bodilyInjury: annotateLimitPair(c.bodilyInjury, byPath, "coverages.bodilyInjury"),
    propertyDamage: annotateSingleLimit(c.propertyDamage, byPath, "coverages.propertyDamage"),
    personalInjuryProtection: annotatePip(c.personalInjuryProtection, byPath),
    medicalPayments: annotateMedPay(c.medicalPayments, byPath),
    uninsuredMotorist: annotateUm(c.uninsuredMotorist, byPath, "coverages.uninsuredMotorist"),
    underinsuredMotorist: annotateUm(c.underinsuredMotorist, byPath, "coverages.underinsuredMotorist"),
    collision: annotateDeductible(c.collision, byPath, "coverages.collision"),
    comprehensive: annotateDeductible(c.comprehensive, byPath, "coverages.comprehensive"),
    rentalReimbursement: annotateRental(c.rentalReimbursement, byPath),
    roadsideAssistance: annotateRoadside(c.roadsideAssistance, byPath),
    other: c.other,
  };
}

/** The one entry point the Policy Dashboard and Ask Roni Policy Mode both use. */
export function annotateAutoPolicyFacts(facts: AutoPolicyFacts, evidence: ExtractionEvidence[]): AnnotatedAutoPolicyFacts {
  const byPath = indexEvidence(evidence);
  return {
    policy: annotatePolicySummary(facts.policy, byPath),
    insured: annotateInsured(facts.insured, byPath),
    vehicles: facts.vehicles.map((v, idx) => annotateVehicle(v, byPath, idx)),
    coverages: annotateCoverages(facts.coverages, byPath),
    other: {
      discounts: facts.other.discounts,
      importantExclusions: facts.other.importantExclusions,
      importantConditions: facts.other.importantConditions,
      endorsements: facts.other.endorsements,
      claimsContact: facts.other.claimsContact,
    },
  };
}
