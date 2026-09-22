import type { InsuranceOption } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

/**
 * Ask Roni stays scripted in M2 (per the brief, §9): these answers are
 * plain functions over the fictional options already in `lib/data`,
 * not calls to any AI API. Compare with a real assistant later by
 * swapping how a question maps to an answer, not by changing where
 * this is called from.
 */
export interface ScriptedQuestion {
  id: string;
  label: string;
}

export const SCRIPTED_QUESTIONS: ScriptedQuestion[] = [
  { id: "why-cheaper", label: "Why is this option cheaper?" },
  { id: "coverage-lost", label: "What coverage would I lose?" },
  { id: "why-deductible", label: "Why is the deductible higher?" },
  { id: "how-different", label: "How is this different from the other option?" },
];

function cheapestOther(option: InsuranceOption, all: InsuranceOption[]): InsuranceOption | undefined {
  return [...all]
    .filter((o) => o.id !== option.id)
    .sort((a, b) => a.monthlyPremium - b.monthlyPremium)[0];
}

function mostCoveredOther(option: InsuranceOption, all: InsuranceOption[]): InsuranceOption | undefined {
  return [...all]
    .filter((o) => o.id !== option.id)
    .sort((a, b) => b.coverageScore - a.coverageScore)[0];
}

/**
 * Answers one scripted question about `option`, in the context of
 * `all` (the rest of the category's catalog) and, when relevant,
 * `against` (a second option the user explicitly picked to compare
 * against, e.g. from the comparison screen).
 */
export function answerScriptedQuestion(
  questionId: string,
  option: InsuranceOption,
  all: InsuranceOption[],
  against?: InsuranceOption,
): string {
  const other = against ?? cheapestOther(option, all);

  switch (questionId) {
    case "why-cheaper": {
      const pricier = mostCoveredOther(option, all);
      if (!pricier || pricier.monthlyPremium <= option.monthlyPremium) {
        return `${option.carrier} is priced near the lower end of this category's fictional catalog, mainly because of its coverage score (${option.coverageScore}/100) and a ${formatMoney(option.deductible)} deductible — both lower the price but also lower how much this option pays out.`;
      }
      return `${option.carrier} (${formatMoney(option.monthlyPremium)}/month) costs less than ${pricier.carrier} (${formatMoney(pricier.monthlyPremium)}/month) mainly because of a higher deductible (${formatMoney(option.deductible)} vs ${formatMoney(pricier.deductible)}) and fewer included benefits (${option.benefits.length} vs ${pricier.benefits.length}). Lower price options generally shift more cost to you if you file a claim.`;
    }
    case "coverage-lost": {
      if (!other) return `${option.carrier} doesn't have another option in this catalog to compare it against yet.`;
      const missing = other.benefits.filter((b) => !option.benefits.includes(b));
      const extraExclusions = option.exclusions.filter((e) => !other.exclusions.includes(e));
      const parts: string[] = [];
      if (missing.length) parts.push(`benefits you'd lose: ${missing.join(", ")}`);
      if (extraExclusions.length) parts.push(`exclusions ${option.carrier} has that ${other.carrier} doesn't: ${extraExclusions.join("; ")}`);
      if (!parts.length) return `${option.carrier} and ${other.carrier} cover largely the same things in this catalog — the main difference is price and deductible.`;
      return `Compared with ${other.carrier}, ${option.carrier} — ${parts.join(". ")}.`;
    }
    case "why-deductible": {
      if (!other) return `${option.carrier} has a ${formatMoney(option.deductible)} deductible — that's what you'd pay first on a claim before this plan pays the rest.`;
      if (option.deductible <= other.deductible) {
        return `${option.carrier}'s deductible (${formatMoney(option.deductible)}) is actually lower than ${other.carrier}'s (${formatMoney(other.deductible)}), which is part of why its premium is higher — you pay less out of pocket if you file a claim.`;
      }
      return `${option.carrier}'s deductible (${formatMoney(option.deductible)}) is higher than ${other.carrier}'s (${formatMoney(other.deductible)}). A higher deductible usually means a lower monthly premium, in exchange for paying more yourself the first time you file a claim.`;
    }
    case "how-different": {
      if (!other) return `${option.carrier} doesn't have another option in this catalog to compare it against yet.`;
      const priceDiff = option.monthlyPremium - other.monthlyPremium;
      const priceLine =
        priceDiff === 0
          ? "they cost the same per month"
          : `${option.carrier} costs ${formatMoney(Math.abs(priceDiff))}/month ${priceDiff > 0 ? "more" : "less"} than ${other.carrier}`;
      const coverageLine =
        option.coverageScore === other.coverageScore
          ? "similar overall coverage"
          : `${option.coverageScore > other.coverageScore ? "more" : "less"} overall coverage than ${other.carrier}`;
      return `${priceLine}, and has ${coverageLine}. Deductible: ${formatMoney(option.deductible)} vs ${formatMoney(other.deductible)}. Benefits: ${option.benefits.length} vs ${other.benefits.length}.`;
    }
    default:
      return "That's not one of the questions Roni can answer yet in this prototype.";
  }
}
