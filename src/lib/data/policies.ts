/**
 * FICTIONAL SAMPLE DATA — not a real insurance policy.
 *
 * Ported 1:1 from the original prototype (roni-prototype-v05.html /
 * db-seed/tpl_wallet.json) so the Home screen shows the exact same
 * numbers as before the migration. "{holder}" in a fact's value is
 * replaced with the signed-in user's name at render time.
 */
import type { Policy } from "@/lib/types";

export const SAMPLE_POLICIES: Policy[] = [
  {
    id: "auto",
    category: "auto",
    type: "Auto",
    carrier: "Progressive",
    monthlyPremium: 184,
    renewalDate: "2026-12-14",
    renewalPremium: 203,
    monitoring: true,
    coverageScore: 78,
    deductible: 500,
    owner: "me",
    label: "2021 Honda Civic LX",
    coverageSummary: "100/300/100 liability",
    benefits: ["Roadside assistance", "Rental reimbursement, $40/day"],
    facts: [
      { label: "Policyholder", value: "{holder}", source: "1" },
      { label: "Policy number", value: "PG-5520-1849-07", source: "1" },
      { label: "Effective", value: "Dec 14, 2025", source: "1" },
      { label: "Renews", value: "Dec 14, 2026", source: "1" },
      { label: "Premium", value: "$184 per month", source: "2" },
      { label: "Insured vehicle", value: "2021 Honda Civic LX", source: "3" },
    ],
    coverageItems: [
      { name: "Liability", limit: "$100,000 per person, $300,000 per accident, $100,000 property damage", deductible: "None", sourcePage: "6", explanation: "Pays for injuries and damage you cause to other people in an accident." },
      { name: "Collision", limit: "Actual cash value of your car", deductible: "$500", sourcePage: "12", explanation: "Pays to repair or replace your car after a crash, whoever is at fault, minus your deductible." },
      { name: "Comprehensive", limit: "Actual cash value of your car", deductible: "$500", sourcePage: "14", explanation: "Pays for damage that is not a crash: theft, fire, hail, vandalism, falling objects and hitting an animal, minus your deductible." },
      { name: "Uninsured motorist", limit: "$100,000 per person, $300,000 per accident", deductible: "None", sourcePage: "9", explanation: "Protects you if a driver with no insurance, or not enough, hurts you." },
      { name: "Rental reimbursement", limit: "$40 per day, up to 30 days", deductible: "None", sourcePage: "17", explanation: "Helps pay for a rental car while yours is being repaired after a covered claim." },
      { name: "Roadside assistance", limit: "Towing, battery, flat tire, lockout", deductible: "None", sourcePage: "18", explanation: "Sends help if your car breaks down." },
    ],
    exclusions: [
      { text: "Driving for rideshare or delivery apps without an endorsement", sourcePage: "21" },
      { text: "Intentional damage", sourcePage: "22" },
      { text: "Racing or track use", sourcePage: "22" },
      { text: "Personal belongings inside the car", sourcePage: "23" },
    ],
    plainSummary: "You are protected if you hurt someone or damage their property, if your car is damaged in a crash, and for theft, fire, hail and similar events. You pay the first $500 of a collision or comprehensive claim. Your renewal price is going up by $19 a month.",
    isFictional: true,
  },
  {
    id: "renters",
    category: "renters",
    type: "Renters",
    carrier: "Lemonade",
    monthlyPremium: 22,
    renewalDate: "2027-02-03",
    monitoring: true,
    coverageScore: 60,
    deductible: 500,
    owner: "me",
    label: "418 Larch Ave, Apt 3",
    coverageSummary: "$30,000 property, $100,000 liability",
    benefits: ["Loss of use, $9,000"],
    facts: [
      { label: "Policyholder", value: "{holder}", source: "1" },
      { label: "Policy number", value: "LM-88231-04", source: "1" },
      { label: "Effective", value: "Feb 3, 2026", source: "1" },
      { label: "Renews", value: "Feb 3, 2027", source: "1" },
      { label: "Premium", value: "$22 per month", source: "1" },
      { label: "Insured address", value: "418 Larch Ave, Apt 3", source: "1" },
    ],
    coverageItems: [
      { name: "Personal property", limit: "$30,000", deductible: "$500", sourcePage: "3", explanation: "Replaces your belongings if they are stolen or damaged by a covered event like fire or theft." },
      { name: "Personal liability", limit: "$100,000", deductible: "None", sourcePage: "4", explanation: "Covers you if someone is hurt in your home, or you accidentally damage someone else’s property." },
      { name: "Loss of use", limit: "$9,000", deductible: "None", sourcePage: "4", explanation: "Pays for a hotel and extra living costs if your home cannot be lived in after a covered loss." },
      { name: "Medical payments to others", limit: "$2,000", deductible: "None", sourcePage: "5", explanation: "Pays small medical bills for a guest hurt at your home, regardless of fault." },
      { name: "Deductible", limit: "$500 per claim", sourcePage: "2", explanation: "The amount you pay before the policy pays on a property claim." },
    ],
    exclusions: [
      { text: "Flood and earthquake", sourcePage: "8" },
      { text: "Jewelry and watches above $1,500 combined", sourcePage: "9" },
      { text: "Roommates’ belongings unless they are listed", sourcePage: "9" },
    ],
    plainSummary: "Your belongings, your liability if someone is hurt at your home, and living costs if you have to move out after a covered loss. You pay the first $500 of a property claim.",
    isFictional: true,
  },
  {
    id: "health",
    category: "health",
    type: "Health",
    carrier: "Fictional Health Plan",
    monthlyPremium: 487,
    renewalDate: "2027-01-01",
    monitoring: true,
    coverageScore: 65,
    deductible: 3200,
    owner: "me",
    label: "Silver PPO, Alex + Sam",
    coverageSummary: "Silver, about 70% average coverage",
    benefits: ["Preventive care at no cost", "Telehealth $0"],
    facts: [
      { label: "Policyholder", value: "{holder}", source: "1" },
      { label: "Member ID", value: "FH-4471-2290", source: "1" },
      { label: "Plan year", value: "Jan 1 to Dec 31, 2026", source: "1" },
      { label: "Renews", value: "Jan 1, 2027", source: "1" },
      { label: "Premium", value: "$487 per month", source: "2" },
      { label: "Covered members", value: "Alex and Sam", source: "2" },
    ],
    coverageItems: [
      { name: "Deductible", limit: "$3,200 individual, $6,400 family", sourcePage: "4", explanation: "What you pay for most care before the plan starts sharing costs." },
      { name: "Out-of-pocket maximum", limit: "$8,500 individual", sourcePage: "4", explanation: "The most you would pay in a year for covered in-network care." },
      { name: "Primary care visit", limit: "$30 copay", sourcePage: "7", explanation: "A flat fee for a regular doctor visit." },
      { name: "Emergency room", limit: "$350 copay after deductible", sourcePage: "9", explanation: "What you pay for an emergency room visit." },
      { name: "Generic prescriptions", limit: "$15 copay", sourcePage: "11", explanation: "What you pay at the pharmacy for generic drugs." },
    ],
    exclusions: [
      { text: "Cosmetic surgery", sourcePage: "31" },
      { text: "Weight-loss surgery unless approved as medically necessary", sourcePage: "32" },
      { text: "Long-term custodial care", sourcePage: "33" },
    ],
    plainSummary: "Your plan shares the cost of doctor visits, hospital care and prescriptions. You pay the first $3,200 of most care yourself, then the plan pays a share until you reach the $8,500 yearly limit.",
    isFictional: true,
  },
];

export function samplePolicyById(id: string) {
  return SAMPLE_POLICIES.find((p) => p.id === id);
}
