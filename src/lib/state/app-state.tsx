"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { SAMPLE_USER, sampleUserFullName, type SampleUser } from "@/lib/data/user";

/**
 * Application-wide state, kept deliberately small for M1.
 *
 * This is the seam a later milestone plugs a real signed-in user into
 * (Supabase auth) without every component that calls `useAppState()`
 * needing to change. Anything that is local to a single screen (like
 * "did the user dismiss this card") should stay as component state
 * instead of being added here — see `MonitoringTeaser` for an example.
 */
interface AppStateValue {
  user: SampleUser;
  userFullName: string;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AppStateValue>(
    () => ({ user: SAMPLE_USER, userFullName: sampleUserFullName(SAMPLE_USER) }),
    [],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within <AppStateProvider>");
  }
  return ctx;
}
