"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Ported from the prototype's money-explainer sheet, as an inline
 * expandable section instead of a modal (M2 spec §10). Text is fixed
 * — never implies fictional carriers actually pay RONI anything.
 */
export function HowRoniMakesMoney() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-dashed border-warn/60 bg-warnbg/40 px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-bold text-warn"
      >
        <span className="flex items-center gap-1.5">
          <Icon name="info" size={16} />
          How RONI makes money
        </span>
        <Icon name="chevronDown" size={16} className={open ? "rotate-180" : undefined} />
      </button>
      {open && (
        <div className="mt-2.5 space-y-2 text-sm text-ink">
          <p>RONI is free for consumers.</p>
          <p>
            If you purchase certain insurance products through RONI, we may receive compensation
            from the insurance provider.
          </p>
          <p>Sponsored relationships never change your organic comparison results.</p>
          <p className="text-xs text-muted">
            Prototype note: no fictional carrier in this catalog actually compensates RONI —
            this section describes how the real product will work.
          </p>
        </div>
      )}
    </div>
  );
}
