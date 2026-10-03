import "server-only";
import { formatMoneyOrUnavailable } from "@/lib/utils";
import type { AutoPolicyFacts } from "@/lib/wallet/schemas/auto-policy";

/**
 * The "RONI SUMMARY" step (M3.2/M3.3): a factual, plain-language
 * summary, deterministically assembled from ONLY the fields already
 * present in `facts` — never a second opinion, never a fact the
 * structured data doesn't already contain. This is what the
 * non-AI `TextExtractionPolicyProvider` uses (a real LLM provider,
 * e.g. `AnthropicExtractionProvider`, may instead have the model write
 * its own summary — still under the same "only from the facts you
 * extracted" instruction — but this function is what guarantees every
 * provider, AI or not, can produce one).
 *
 * Every clause below is conditional on the fact it describes actually
 * being non-null; a policy with almost nothing extracted gets a short,
 * honest sentence or two instead of a padded paragraph with invented
 * texture. Returns `null` only when there is truly nothing to say
 * (every relevant field is `null`/empty) — an empty summary is more
 * honest than a templated non-sentence.
 */
export function summarizeAutoPolicyFacts(facts: AutoPolicyFacts): string | null {
  const sentences: string[] = [];

  const { policy, insured, vehicles, coverages, other } = facts;

  const vehicle = vehicles[0];
  const vehicleText = vehicle && (vehicle.year || vehicle.make || vehicle.model)
    ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")
    : null;

  const opening: string[] = [];
  if (policy.carrier) opening.push(`a ${policy.carrier} auto insurance policy`);
  else opening.push("an auto insurance policy");
  if (policy.policyNumber) opening.push(`(#${policy.policyNumber})`);
  if (vehicleText) opening.push(`covering a ${vehicleText}`);
  if (policy.state) opening.push(`in ${policy.state}`);
  sentences.push(`This is ${opening.join(" ")}.`.replace(/\s+\)/, ")"));

  if (policy.effectiveDate && policy.expirationDate) {
    sentences.push(`The policy term runs from ${policy.effectiveDate} to ${policy.expirationDate}.`);
  } else if (policy.effectiveDate) {
    sentences.push(`The policy became effective ${policy.effectiveDate}.`);
  } else if (policy.expirationDate) {
    sentences.push(`The policy expires ${policy.expirationDate}.`);
  }

  if (policy.premiumAmount !== null) {
    const freq = policy.premiumFrequency ? ` (${policy.premiumFrequency.replace("_", "-")})` : "";
    sentences.push(`The premium is ${formatMoneyOrUnavailable(policy.premiumAmount)}${freq}.`);
  }

  if (insured.namedInsured) {
    sentences.push(`The named insured is ${insured.namedInsured}.`);
  }

  const liabilityParts: string[] = [];
  if (coverages.bodilyInjury?.perPerson !== null && coverages.bodilyInjury?.perAccident !== null && coverages.bodilyInjury) {
    liabilityParts.push(
      `bodily injury liability of ${formatMoneyOrUnavailable(coverages.bodilyInjury.perPerson as number)} per person / ${formatMoneyOrUnavailable(coverages.bodilyInjury.perAccident as number)} per accident`,
    );
  }
  if (coverages.propertyDamage?.limit !== null && coverages.propertyDamage) {
    liabilityParts.push(`property damage liability of ${formatMoneyOrUnavailable(coverages.propertyDamage.limit as number)}`);
  }
  if (liabilityParts.length > 0) {
    sentences.push(`Liability coverage includes ${liabilityParts.join(" and ")}.`);
  }

  const physicalDamageParts: string[] = [];
  if (coverages.collision.included === true) {
    physicalDamageParts.push(
      coverages.collision.deductible !== null
        ? `collision (${formatMoneyOrUnavailable(coverages.collision.deductible)} deductible)`
        : "collision",
    );
  } else if (coverages.collision.included === false) {
    physicalDamageParts.push("no collision coverage");
  }
  if (coverages.comprehensive.included === true) {
    physicalDamageParts.push(
      coverages.comprehensive.deductible !== null
        ? `comprehensive (${formatMoneyOrUnavailable(coverages.comprehensive.deductible)} deductible)`
        : "comprehensive",
    );
  } else if (coverages.comprehensive.included === false) {
    physicalDamageParts.push("no comprehensive coverage");
  }
  if (physicalDamageParts.length > 0) {
    sentences.push(`Physical damage coverage: ${physicalDamageParts.join(", ")}.`);
  }

  const benefitParts: string[] = [];
  if (coverages.rentalReimbursement.included === true) benefitParts.push("rental reimbursement");
  if (coverages.roadsideAssistance.included === true) benefitParts.push("roadside assistance");
  if (benefitParts.length > 0) {
    sentences.push(`Also includes ${benefitParts.join(" and ")}.`);
  }

  if (other.discounts.length > 0) {
    sentences.push(`Discounts on file: ${other.discounts.join(", ")}.`);
  }
  if (other.importantExclusions.length > 0) {
    sentences.push(`Notable exclusions: ${other.importantExclusions.join(", ")}.`);
  }

  // "Nothing to say" is exactly the opening sentence with no carrier,
  // vehicle, or policy number and nothing else added — that's not a
  // summary, it's a restatement of "we found nothing."
  const hasAnySubstance =
    policy.carrier !== null ||
    policy.policyNumber !== null ||
    vehicleText !== null ||
    policy.effectiveDate !== null ||
    policy.expirationDate !== null ||
    policy.premiumAmount !== null ||
    insured.namedInsured !== null ||
    liabilityParts.length > 0 ||
    physicalDamageParts.length > 0 ||
    benefitParts.length > 0 ||
    other.discounts.length > 0 ||
    other.importantExclusions.length > 0;

  return hasAnySubstance ? sentences.join(" ") : null;
}
