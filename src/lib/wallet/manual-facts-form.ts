import type { AutoPolicyFacts, VehicleUsage } from "@/lib/wallet/schemas/auto-policy";
import { AUTO_POLICY_SCHEMA_VERSION, emptyAutoPolicyFacts } from "@/lib/wallet/schemas/auto-policy";

/**
 * Parses the manual-entry form (`/wallet/[policyId]/facts`) into an
 * `AutoPolicyFacts` object. This is the ONE place a person's own
 * typed answer becomes a stored "fact" — every value here is exactly
 * what they entered, nothing inferred or defaulted to a guess. An
 * empty text input becomes `null` (not determined), and every
 * tri-state coverage toggle is a `""/"yes"/"no"` select specifically
 * so "left blank" and "the policy says no" stay two different,
 * honest answers (brief principle 2) instead of collapsing to one.
 *
 * Scope note: this form supports one vehicle and one named driver per
 * policy — the `AutoPolicyFacts` schema supports arrays of either,
 * but a variable-length multi-row form is a UI investment this
 * milestone's manual-entry fallback doesn't need; a future iteration
 * can extend the form without changing this schema or the repository.
 */

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function num(formData: FormData, key: string): number | null {
  const v = str(formData, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function int(formData: FormData, key: string): number | null {
  const v = num(formData, key);
  return v === null ? null : Math.round(v);
}

function tri(formData: FormData, key: string): boolean | null {
  const v = str(formData, key);
  if (v === "yes") return true;
  if (v === "no") return false;
  return null;
}

const POLICY_STATUSES = ["active", "pending", "expired", "cancelled"] as const;
const PREMIUM_FREQUENCIES = ["monthly", "quarterly", "semi_annual", "annual", "other"] as const;
const VEHICLE_USAGES = ["commute", "pleasure", "business", "rideshare", "farm"] as const;

function pickPolicyStatus(v: string | null): AutoPolicyFacts["policy"]["status"] {
  return v && (POLICY_STATUSES as readonly string[]).includes(v) ? (v as AutoPolicyFacts["policy"]["status"]) : null;
}

function pickPremiumFrequency(v: string | null): AutoPolicyFacts["policy"]["premiumFrequency"] {
  return v && (PREMIUM_FREQUENCIES as readonly string[]).includes(v) ? (v as AutoPolicyFacts["policy"]["premiumFrequency"]) : null;
}

function pickVehicleUsage(v: string | null): VehicleUsage {
  return v && (VEHICLE_USAGES as readonly string[]).includes(v) ? (v as VehicleUsage) : null;
}

function list(formData: FormData, key: string): string[] {
  const v = str(formData, key);
  if (v === null) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function parseManualAutoPolicyFacts(formData: FormData): AutoPolicyFacts {
  const base = emptyAutoPolicyFacts();

  const facts: AutoPolicyFacts = {
    ...base,
    schemaVersion: AUTO_POLICY_SCHEMA_VERSION,
    policy: {
      category: "auto",
      carrier: str(formData, "carrier"),
      policyNumber: str(formData, "policyNumber"),
      status: pickPolicyStatus(str(formData, "status")),
      effectiveDate: str(formData, "effectiveDate"),
      expirationDate: str(formData, "expirationDate"),
      state: str(formData, "state"),
      premiumAmount: num(formData, "premiumAmount"),
      premiumFrequency: pickPremiumFrequency(str(formData, "premiumFrequency")),
      termPremium: num(formData, "termPremium"),
    },
    insured: {
      namedInsured: str(formData, "namedInsured"),
      address: str(formData, "insuredAddress"),
      drivers: str(formData, "driverName")
        ? [
            {
              name: str(formData, "driverName"),
              dateOfBirth: str(formData, "driverDob"),
              licenseState: str(formData, "driverLicenseState"),
            },
          ]
        : [],
    },
    vehicles: str(formData, "vehicleMake") || str(formData, "vehicleModel") || str(formData, "vehicleYear")
      ? [
          {
            year: int(formData, "vehicleYear"),
            make: str(formData, "vehicleMake"),
            model: str(formData, "vehicleModel"),
            vin: str(formData, "vehicleVin"),
            usage: pickVehicleUsage(str(formData, "vehicleUsage")),
            annualMileage: int(formData, "vehicleAnnualMileage"),
            lienholder: str(formData, "vehicleLienholder"),
          },
        ]
      : [],
    coverages: {
      bodilyInjury:
        num(formData, "biPerPerson") !== null || num(formData, "biPerAccident") !== null
          ? { perPerson: num(formData, "biPerPerson"), perAccident: num(formData, "biPerAccident") }
          : null,
      propertyDamage: num(formData, "propertyDamageLimit") !== null ? { limit: num(formData, "propertyDamageLimit") } : null,
      personalInjuryProtection: {
        included: tri(formData, "pipIncluded"),
        limit: num(formData, "pipLimit"),
        deductible: num(formData, "pipDeductible"),
      },
      medicalPayments: {
        included: tri(formData, "medPayIncluded"),
        limit: num(formData, "medPayLimit"),
      },
      uninsuredMotorist: {
        included: tri(formData, "umIncluded"),
        perPerson: num(formData, "umPerPerson"),
        perAccident: num(formData, "umPerAccident"),
      },
      underinsuredMotorist: {
        included: tri(formData, "uimIncluded"),
        perPerson: num(formData, "uimPerPerson"),
        perAccident: num(formData, "uimPerAccident"),
      },
      collision: { included: tri(formData, "collisionIncluded"), deductible: num(formData, "collisionDeductible") },
      comprehensive: { included: tri(formData, "comprehensiveIncluded"), deductible: num(formData, "comprehensiveDeductible") },
      rentalReimbursement: {
        included: tri(formData, "rentalIncluded"),
        limitPerDay: num(formData, "rentalLimitPerDay"),
        maxDays: int(formData, "rentalMaxDays"),
      },
      roadsideAssistance: {
        included: tri(formData, "roadsideIncluded"),
        details: str(formData, "roadsideDetails"),
      },
    },
    other: {
      discounts: list(formData, "discounts"),
      importantExclusions: list(formData, "importantExclusions"),
    },
  };

  return facts;
}
