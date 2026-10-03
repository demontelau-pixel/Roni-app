import "server-only";
import type { ExtractedField } from "@/lib/wallet/schemas/extracted-field";
import { formatMoneyOrUnavailable } from "@/lib/utils";
import type { PolicyQAAnswer, PolicyQACitation, PolicyQAContext, PolicyQAProvider } from "@/lib/services/policy-qa/types";

const NOT_DETERMINED = "I couldn't determine that from this policy.";

/** Builds this field's citation, if it has one. A field with `sourcePage` cites the real page it was found on; a field with a value but no page (i.e. entered manually — the dev/demo extractor never sets a value at all, see `DevFallbackExtractionProvider`) cites "You told RONI this," which is equally real: it says exactly where the fact came from, just not from the document. Never invents a page number that doesn't exist. */
function citationFor(fieldLabel: string, field: ExtractedField<unknown>, carrierLabel: string | null): PolicyQACitation | null {
  if (field.value === null || field.value === undefined) return null;
  if (field.sourcePage !== null) {
    const doc = carrierLabel ? `${carrierLabel} Auto Policy` : "your Auto policy";
    return { label: `${doc} · Page ${field.sourcePage}`, pageNumber: field.sourcePage };
  }
  return { label: "You told RONI this", pageNumber: null };
}

function grounded(answerText: string, citation: PolicyQACitation | null): PolicyQAAnswer {
  return { answerText, citations: citation ? [citation] : [], grounded: true };
}

function notDetermined(): PolicyQAAnswer {
  return { answerText: NOT_DETERMINED, citations: [], grounded: false };
}

/** Case-insensitive "does the question mention any of these" check. */
function mentions(question: string, ...keywords: string[]): boolean {
  const q = question.toLowerCase();
  return keywords.some((k) => q.includes(k));
}

/**
 * The dev/demo Ask Roni Policy Mode adapter (M3.3). Deterministic —
 * no LLM call — because none is configured in this environment (M3.1–
 * M3.4 brief, "DEVELOPMENT FALLBACK"). It answers by pattern-matching
 * the question against a fixed set of Auto-policy topics and reading
 * the matching field straight out of the already-annotated facts, so
 * every answer is either a real value with a real citation, or the
 * fixed "I couldn't determine that from this policy" response —
 * never a guess and never an invented citation.
 *
 * A real LLM-backed provider implements the same `PolicyQAProvider`
 * interface, is swapped in at `lib/services/policy-qa/index.ts`, and
 * would still need to obey the same rule (ground every claim in
 * `context.facts`, cite only real `sourcePage`s) — this fallback is
 * the reference for what "grounded" means here, not a shortcut
 * around it.
 */
export class DevFallbackPolicyQAProvider implements PolicyQAProvider {
  readonly id = "dev-fallback:keyword-match";

  async answer(context: PolicyQAContext): Promise<PolicyQAAnswer> {
    const { facts, question, carrierLabel } = context;
    const q = question.trim();
    if (!q) return notDetermined();

    if (mentions(q, "deductible")) {
      if (mentions(q, "comprehensive")) {
        const d = facts.coverages.comprehensive.deductible;
        if (d.value === null) return notDetermined();
        return grounded(`Your comprehensive deductible is ${formatMoneyOrUnavailable(d.value)}.`, citationFor("comprehensive deductible", d, carrierLabel));
      }
      const d = facts.coverages.collision.deductible;
      if (d.value === null) return notDetermined();
      return grounded(`Your collision deductible is ${formatMoneyOrUnavailable(d.value)}.`, citationFor("collision deductible", d, carrierLabel));
    }

    if (mentions(q, "collision")) {
      const inc = facts.coverages.collision.included;
      if (inc.value === null) return notDetermined();
      if (inc.value === false) return grounded("Collision coverage is not included on this policy.", citationFor("collision included", inc, carrierLabel));
      const d = facts.coverages.collision.deductible;
      const dedText = d.value !== null ? ` with a ${formatMoneyOrUnavailable(d.value)} deductible` : "";
      return grounded(`Yes, collision coverage is included${dedText}.`, citationFor("collision included", inc, carrierLabel));
    }

    if (mentions(q, "comprehensive")) {
      const inc = facts.coverages.comprehensive.included;
      if (inc.value === null) return notDetermined();
      if (inc.value === false) return grounded("Comprehensive coverage is not included on this policy.", citationFor("comprehensive included", inc, carrierLabel));
      const d = facts.coverages.comprehensive.deductible;
      const dedText = d.value !== null ? ` with a ${formatMoneyOrUnavailable(d.value)} deductible` : "";
      return grounded(`Yes, comprehensive coverage is included${dedText}.`, citationFor("comprehensive included", inc, carrierLabel));
    }

    if (mentions(q, "bodily injury", "liability")) {
      const bi = facts.coverages.bodilyInjury;
      if (!bi || bi.perPerson.value === null || bi.perAccident.value === null) return notDetermined();
      return grounded(
        `Your bodily injury liability limit is ${formatMoneyOrUnavailable(bi.perPerson.value)} per person / ${formatMoneyOrUnavailable(bi.perAccident.value)} per accident.`,
        citationFor("bodily injury", bi.perPerson, carrierLabel),
      );
    }

    if (mentions(q, "property damage")) {
      const pd = facts.coverages.propertyDamage;
      if (!pd || pd.limit.value === null) return notDetermined();
      return grounded(`Your property damage liability limit is ${formatMoneyOrUnavailable(pd.limit.value)}.`, citationFor("property damage", pd.limit, carrierLabel));
    }

    if (mentions(q, "uninsured", "underinsured")) {
      // Prefer whichever of Uninsured/Underinsured Motorist the
      // question actually names; if neither is named (a plain
      // "uninsured motorist" mention matches both keywords above),
      // default to Uninsured Motorist, falling back to Underinsured
      // Motorist only when UM itself has no value on file.
      const preferUim = mentions(q, "underinsured") && !mentions(q, "uninsured motorist");
      const primary = preferUim ? facts.coverages.underinsuredMotorist : facts.coverages.uninsuredMotorist;
      const secondary = preferUim ? facts.coverages.uninsuredMotorist : facts.coverages.underinsuredMotorist;
      const um = primary.perPerson.value !== null || primary.perAccident.value !== null ? primary : secondary;
      if (um.perPerson.value === null || um.perAccident.value === null) return notDetermined();
      return grounded(
        `Your uninsured/underinsured motorist limit is ${formatMoneyOrUnavailable(um.perPerson.value)} per person / ${formatMoneyOrUnavailable(um.perAccident.value)} per accident.`,
        citationFor("uninsured motorist", um.perPerson, carrierLabel),
      );
    }

    if (mentions(q, "medical payment", "medpay", "personal injury protection", "pip")) {
      const pip = facts.coverages.personalInjuryProtection;
      const medPay = facts.coverages.medicalPayments;
      const limit = pip.limit.value !== null ? pip.limit : medPay.limit;
      if (limit.value === null) return notDetermined();
      return grounded(`Your medical/PIP coverage limit is ${formatMoneyOrUnavailable(limit.value)}.`, citationFor("PIP/medical payments", limit, carrierLabel));
    }

    if (mentions(q, "rental")) {
      const r = facts.coverages.rentalReimbursement;
      if (r.included.value === null) return notDetermined();
      if (r.included.value === false) return grounded("Rental reimbursement is not included on this policy.", citationFor("rental reimbursement", r.included, carrierLabel));
      const perDay = r.limitPerDay.value !== null ? ` up to ${formatMoneyOrUnavailable(r.limitPerDay.value)}/day` : "";
      return grounded(`Yes, rental reimbursement is included${perDay}.`, citationFor("rental reimbursement", r.included, carrierLabel));
    }

    if (mentions(q, "roadside")) {
      const r = facts.coverages.roadsideAssistance.included;
      if (r.value === null) return notDetermined();
      return grounded(r.value ? "Yes, roadside assistance is included." : "Roadside assistance is not included on this policy.", citationFor("roadside assistance", r, carrierLabel));
    }

    if (mentions(q, "premium", "cost", "pay", "price")) {
      const amt = facts.policy.premiumAmount;
      const freq = facts.policy.premiumFrequency;
      if (amt.value === null) return notDetermined();
      const freqText = freq.value ? ` (${freq.value.replace("_", "-")})` : "";
      return grounded(`Your premium is ${formatMoneyOrUnavailable(amt.value)}${freqText}.`, citationFor("premium", amt, carrierLabel));
    }

    if (mentions(q, "renew", "expir", "end date")) {
      const exp = facts.policy.expirationDate;
      if (exp.value === null) return notDetermined();
      return grounded(`This policy's term ends on ${exp.value}.`, citationFor("expiration date", exp, carrierLabel));
    }

    if (mentions(q, "effective", "start date", "begin")) {
      const eff = facts.policy.effectiveDate;
      if (eff.value === null) return notDetermined();
      return grounded(`This policy's term began on ${eff.value}.`, citationFor("effective date", eff, carrierLabel));
    }

    if (mentions(q, "carrier", "who is my insur", "company")) {
      const c = facts.policy.carrier;
      if (c.value === null) return notDetermined();
      return grounded(`Your carrier is ${c.value}.`, citationFor("carrier", c, carrierLabel));
    }

    if (mentions(q, "policy number")) {
      if (facts.policy.policyNumber.value === null) return notDetermined();
      return grounded("RONI has your policy number on file, but shows it masked for your privacy — see the Policy Dashboard.", null);
    }

    if (mentions(q, "vehicle", "car", "vin", "year", "make", "model")) {
      const v = facts.vehicles[0];
      if (!v || v.year.value === null || v.make.value === null || v.model.value === null) return notDetermined();
      return grounded(`This policy covers a ${v.year.value} ${v.make.value} ${v.model.value}.`, citationFor("vehicle", v.make, carrierLabel));
    }

    if (mentions(q, "driver", "insured", "named")) {
      const name = facts.insured.namedInsured;
      if (name.value === null) return notDetermined();
      return grounded(`The named insured on this policy is ${name.value}.`, citationFor("named insured", name, carrierLabel));
    }

    if (mentions(q, "discount")) {
      if (facts.other.discounts.length === 0) return notDetermined();
      return grounded(`Discounts on this policy: ${facts.other.discounts.join(", ")}.`, { label: "You told RONI this", pageNumber: null });
    }

    if (mentions(q, "exclu", "not covered", "excluded")) {
      if (facts.other.importantExclusions.length === 0) return notDetermined();
      return grounded(`Important exclusions on this policy: ${facts.other.importantExclusions.join(", ")}.`, { label: "You told RONI this", pageNumber: null });
    }

    return notDetermined();
  }
}
