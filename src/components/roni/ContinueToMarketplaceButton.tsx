"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { AutoDriverAnswers, AutoVehicleAnswers } from "@/lib/types";

interface ContinueToMarketplaceButtonProps {
  vehicleSeed: Partial<AutoVehicleAnswers>;
  driverSeed: Partial<AutoDriverAnswers>;
}

const SEED_STORAGE_KEY = "roni:auto-quote-seed";

/**
 * M3.4's bridge into the existing Auto Marketplace flow: writes the
 * one-shot seed `AutoQuoteProvider` (`lib/state/auto-quote-context.tsx`)
 * reads on mount, then navigates. A plain `<Link href="/market/auto">`
 * can't do the "write first" part, hence this small client component
 * instead of a server-rendered link.
 */
export function ContinueToMarketplaceButton({ vehicleSeed, driverSeed }: ContinueToMarketplaceButtonProps) {
  const router = useRouter();

  function handleClick() {
    try {
      window.sessionStorage.setItem(SEED_STORAGE_KEY, JSON.stringify({ vehicle: vehicleSeed, driver: driverSeed }));
    } catch {
      // sessionStorage unavailable (private browsing, etc.) — the
      // Marketplace flow still works, just without prefill.
    }
    router.push("/market/auto");
  }

  return (
    <Button type="button" onClick={handleClick}>
      Continue to Auto Marketplace
    </Button>
  );
}
