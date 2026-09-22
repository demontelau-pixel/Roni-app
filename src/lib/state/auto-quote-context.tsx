"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  EMPTY_AUTO_DRIVER,
  EMPTY_AUTO_VEHICLE,
  type AutoDriverAnswers,
  type AutoVehicleAnswers,
  type PriorityKey,
} from "@/lib/types";

interface AutoQuoteValue {
  vehicle: AutoVehicleAnswers;
  setVehicle: (v: AutoVehicleAnswers) => void;
  driver: AutoDriverAnswers;
  setDriver: (d: AutoDriverAnswers) => void;
  priorities: PriorityKey[];
  togglePriority: (key: PriorityKey) => void;
  /** True once the vehicle step has the minimum info to move on. */
  vehicleComplete: boolean;
}

const AutoQuoteContext = createContext<AutoQuoteValue | null>(null);

/**
 * Holds the Auto quote flow's in-progress answers for the lifetime of
 * the browser tab (M2 spec §12: "survive navigation... no database
 * persistence yet"). Scoped to `/market/auto/*` via that route's
 * `layout.tsx` — leaving the flow and coming back later in a new
 * session starts over on purpose.
 */
export function AutoQuoteProvider({ children }: { children: ReactNode }) {
  const [vehicle, setVehicle] = useState<AutoVehicleAnswers>(EMPTY_AUTO_VEHICLE);
  const [driver, setDriver] = useState<AutoDriverAnswers>(EMPTY_AUTO_DRIVER);
  const [priorities, setPriorities] = useState<PriorityKey[]>(["price"]);

  const value = useMemo<AutoQuoteValue>(
    () => ({
      vehicle,
      setVehicle,
      driver,
      setDriver,
      priorities,
      togglePriority: (key) =>
        setPriorities((prev) => {
          if (prev.includes(key)) {
            // Always keep at least one priority selected — an empty
            // set would make "matches your priorities" meaningless.
            return prev.length > 1 ? prev.filter((p) => p !== key) : prev;
          }
          return [...prev, key];
        }),
      vehicleComplete: Boolean(vehicle.zip && vehicle.year && vehicle.make && vehicle.model && vehicle.ownership),
    }),
    [vehicle, driver, priorities],
  );

  return <AutoQuoteContext.Provider value={value}>{children}</AutoQuoteContext.Provider>;
}

export function useAutoQuote(): AutoQuoteValue {
  const ctx = useContext(AutoQuoteContext);
  if (!ctx) {
    throw new Error("useAutoQuote must be used within <AutoQuoteProvider>");
  }
  return ctx;
}
