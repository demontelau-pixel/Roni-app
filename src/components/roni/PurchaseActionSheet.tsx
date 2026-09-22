"use client";

import { useState } from "react";
import type { InsuranceOption, PurchaseMode } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

const MODE_COPY: Record<PurchaseMode, { label: string; explanation: string }> = {
  roni: {
    label: "Buy with RONI",
    explanation:
      "Purchasing through RONI will become available when carrier integrations are connected. Nothing was purchased and no payment was taken.",
  },
  carrier: {
    label: "Continue with carrier",
    explanation:
      "In the finished product this hands you off to the carrier's own site to finish the purchase, with your answers pre-filled. This prototype doesn't have a real carrier connection to hand off to yet.",
  },
  licensed: {
    label: "Request licensed assistance",
    explanation:
      "This plan is flagged as one that may need a licensed professional to complete. In the finished product, RONI would ask your explicit permission before sharing your contact information with anyone — nothing is shared here, since this is a prototype.",
  },
};

interface PurchaseActionSheetProps {
  option: InsuranceOption;
}

/** Ported/expanded from the prototype's "buy" sheet. Never performs a real transaction. */
export function PurchaseActionSheet({ option }: PurchaseActionSheetProps) {
  const [openMode, setOpenMode] = useState<PurchaseMode | null>(null);

  return (
    <div className="flex flex-wrap gap-2.5">
      {option.purchaseModes.map((mode) => (
        <Button key={mode} size="sm" variant={mode === "roni" ? "primary" : "ghost"} onClick={() => setOpenMode(mode)}>
          {MODE_COPY[mode].label}
        </Button>
      ))}

      <Modal
        open={openMode !== null}
        onClose={() => setOpenMode(null)}
        title={openMode ? MODE_COPY[openMode].label : ""}
      >
        {openMode && (
          <div className="space-y-3">
            <p className="text-[15px] text-ink">{MODE_COPY[openMode].explanation}</p>
            <p className="rounded-xl bg-bg px-3 py-2 text-xs text-muted">
              Prototype action — no real insurance transaction occurred.
            </p>
            <Button block onClick={() => setOpenMode(null)}>
              Got it
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
