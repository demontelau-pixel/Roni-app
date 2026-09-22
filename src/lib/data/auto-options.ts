import type { InsuranceOption } from "@/lib/types";

/**
 * FICTIONAL SAMPLE DATA — illustrative quotes only, not real insurance
 * products or real prices.
 *
 * Ported from the original prototype's `OPTIONS.auto` (Plan A/B/C) plus
 * one sponsored placement, so the numbers stay consistent with the
 * rest of the RONI project as it migrates. This is the seam a real
 * `InsuranceQuoteProvider` (Bindable, a carrier API, etc.) will
 * eventually replace — see `lib/services/quote-provider.ts`.
 */
export const AUTO_OPTIONS: InsuranceOption[] = [
  {
    id: "auto-plan-a",
    category: "auto",
    planName: "Plan A",
    carrier: "Harbor Mutual",
    monthlyPremium: 148,
    coverageSummary: "Liability 50/100",
    deductible: 1000,
    coverageScore: 45,
    benefits: ["Digital claims"],
    exclusions: [
      "No rental car coverage",
      "No roadside assistance",
      "Lower liability limits than most options",
    ],
    purchaseModes: ["roni", "carrier"],
    isFictional: true,
  },
  {
    id: "auto-plan-b",
    category: "auto",
    planName: "Plan B",
    carrier: "Northline",
    monthlyPremium: 167,
    coverageSummary: "Liability 100/300",
    deductible: 500,
    coverageScore: 78,
    benefits: ["Rental reimbursement"],
    exclusions: ["No roadside assistance", "Rideshare and delivery driving excluded"],
    purchaseModes: ["roni", "carrier"],
    isFictional: true,
  },
  {
    id: "auto-plan-c",
    category: "auto",
    planName: "Plan C",
    carrier: "Kestrel Insurance",
    monthlyPremium: 183,
    coverageSummary: "Liability 250/500",
    deductible: 500,
    coverageScore: 92,
    benefits: ["Rental reimbursement", "Roadside assistance"],
    exclusions: ["Racing and track use excluded"],
    purchaseModes: ["carrier", "licensed"],
    isFictional: true,
  },
  {
    id: "auto-sponsored",
    category: "auto",
    planName: "Sponsored plan",
    carrier: "Alder & Co",
    monthlyPremium: 176,
    coverageSummary: "Liability 100/300",
    deductible: 500,
    coverageScore: 80,
    benefits: ["Rental reimbursement", "Roadside assistance"],
    exclusions: ["Rideshare and delivery driving excluded"],
    purchaseModes: ["carrier"],
    sponsored: true,
    isFictional: true,
  },
];

export function autoOptionById(id: string): InsuranceOption | undefined {
  return AUTO_OPTIONS.find((o) => o.id === id);
}
