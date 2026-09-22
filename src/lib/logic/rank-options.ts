import type { InsuranceOption, PriorityKey } from "@/lib/types";

export const PRIORITY_LABELS: Record<PriorityKey, string> = {
  price: "Lower price",
  coverage: "More coverage",
  deductible: "Lower deductible",
  benefits: "Better benefits",
};

export type SortKey = "match" | "price" | "coverage" | "deductible" | "benefits";

export const SORT_LABELS: Record<SortKey, string> = {
  match: "Your priorities",
  price: "Price",
  coverage: "Coverage",
  deductible: "Deductible",
  benefits: "Benefits",
};

/** Per-priority 0–1 scores for one option, relative to the others being compared. */
export type MatchScores = Record<PriorityKey, number>;

export interface RankedOption {
  option: InsuranceOption;
  scores: MatchScores;
  /** Average of the scores for the priorities the user actually picked. */
  matchScore: number;
  /** The user's priorities this option scores in the top third on — shown
   *  as "Matches your priorities" tags so the order is never a black box. */
  strongPriorities: PriorityKey[];
}

function normalize(values: number[], value: number, lowerIsBetter: boolean): number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 1;
  const t = (value - min) / (max - min);
  return lowerIsBetter ? 1 - t : t;
}

/**
 * Scores every option against the user's chosen priorities and sorts by
 * average match. This never labels anything "best" — see `RankedOption`,
 * which exposes *why* an option ranks where it does (`strongPriorities`),
 * so the UI can say "matches your priorities" instead of asserting a
 * universal winner (M2 spec §5, §14).
 */
export function rankOptions(
  options: InsuranceOption[],
  priorities: PriorityKey[],
): RankedOption[] {
  const active = priorities.length > 0 ? priorities : (["price"] as PriorityKey[]);
  const prices = options.map((o) => o.monthlyPremium);
  const coverageScores = options.map((o) => o.coverageScore);
  const deductibles = options.map((o) => o.deductible);
  const benefitCounts = options.map((o) => o.benefits.length);

  const ranked = options.map((option) => {
    const scores: MatchScores = {
      price: normalize(prices, option.monthlyPremium, true),
      coverage: normalize(coverageScores, option.coverageScore, false),
      deductible: normalize(deductibles, option.deductible, true),
      benefits: normalize(benefitCounts, option.benefits.length, false),
    };
    const matchScore = active.reduce((sum, key) => sum + scores[key], 0) / active.length;
    const strongPriorities = active.filter((key) => scores[key] >= 0.66);
    return { option, scores, matchScore, strongPriorities };
  });

  return ranked.sort((a, b) => b.matchScore - a.matchScore || a.option.monthlyPremium - b.option.monthlyPremium);
}

/** Sorts a plain list of options by one visible, explainable key (M2 spec §5). */
export function sortOptions(options: InsuranceOption[], sort: SortKey): InsuranceOption[] {
  const copy = [...options];
  switch (sort) {
    case "price":
      return copy.sort((a, b) => a.monthlyPremium - b.monthlyPremium);
    case "coverage":
      return copy.sort((a, b) => b.coverageScore - a.coverageScore);
    case "deductible":
      return copy.sort((a, b) => a.deductible - b.deductible);
    case "benefits":
      return copy.sort((a, b) => b.benefits.length - a.benefits.length);
    case "match":
    default:
      return copy;
  }
}
