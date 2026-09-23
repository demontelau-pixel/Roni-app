"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  EMPTY_HEALTH_APPLICANT,
  EMPTY_HEALTH_HOUSEHOLD,
  EMPTY_HEALTH_LOCATION,
  emptyHealthMember,
  type HealthApplicant,
  type HealthHousehold,
  type HealthLocation,
  type HealthMember,
} from "@/lib/types";

interface HealthQuoteValue {
  location: HealthLocation;
  setLocation: (l: HealthLocation) => void;
  year: number | null;
  setYear: (y: number) => void;
  applicant: HealthApplicant;
  setApplicant: (a: HealthApplicant) => void;
  household: HealthHousehold;
  setIncome: (income: string) => void;
  addMember: () => void;
  updateMember: (id: string, member: HealthMember) => void;
  removeMember: (id: string) => void;
  locationComplete: boolean;
  applicantComplete: boolean;
  /** True once every added member has the minimum CMS needs (age/dob + tobacco). Members are optional; incomplete ones are not. */
  householdComplete: boolean;
}

const HealthQuoteContext = createContext<HealthQuoteValue | null>(null);

/**
 * Holds the Health quote flow's in-progress answers for the lifetime
 * of the tab — same pattern as `AutoQuoteProvider`. No database
 * persistence (M2.5 spec doesn't ask for it, and M2's §12 precedent
 * applies equally here).
 */
export function HealthQuoteProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<HealthLocation>(EMPTY_HEALTH_LOCATION);
  const [year, setYear] = useState<number | null>(null);
  const [applicant, setApplicant] = useState<HealthApplicant>(EMPTY_HEALTH_APPLICANT);
  const [household, setHousehold] = useState<HealthHousehold>(EMPTY_HEALTH_HOUSEHOLD);

  const value = useMemo<HealthQuoteValue>(() => {
    const memberComplete = (m: HealthMember) => Boolean((m.age || m.dob) && m.usesTobacco);
    return {
      location,
      setLocation,
      year,
      setYear,
      applicant,
      setApplicant,
      household,
      setIncome: (income: string) => setHousehold((h) => ({ ...h, income })),
      addMember: () =>
        setHousehold((h) => ({
          ...h,
          additionalMembers: [...h.additionalMembers, emptyHealthMember(crypto.randomUUID())],
        })),
      updateMember: (id: string, member: HealthMember) =>
        setHousehold((h) => ({
          ...h,
          additionalMembers: h.additionalMembers.map((m) => (m.id === id ? member : m)),
        })),
      removeMember: (id: string) =>
        setHousehold((h) => ({ ...h, additionalMembers: h.additionalMembers.filter((m) => m.id !== id) })),
      locationComplete: Boolean(location.zip && location.countyfips && location.state && year),
      applicantComplete: Boolean((applicant.age || applicant.dob) && applicant.usesTobacco),
      householdComplete: household.additionalMembers.every(memberComplete),
    };
  }, [location, year, applicant, household]);

  return <HealthQuoteContext.Provider value={value}>{children}</HealthQuoteContext.Provider>;
}

export function useHealthQuote(): HealthQuoteValue {
  const ctx = useContext(HealthQuoteContext);
  if (!ctx) {
    throw new Error("useHealthQuote must be used within <HealthQuoteProvider>");
  }
  return ctx;
}
