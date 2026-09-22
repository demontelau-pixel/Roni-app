"use client";

import { useState } from "react";
import type { Policy } from "@/lib/types";
import type { MonitoringFinding } from "@/lib/data/monitoring";
import { daysUntil, formatMoney } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

interface MonitoringTeaserProps {
  policy: Policy;
  finding: MonitoringFinding;
}

/**
 * Ported from the "Roni found something" block inside `homeScreen()`.
 * "Remind me later" is local, per-session state — it isn't meant to
 * persist yet (there's nowhere to persist it to until Supabase is
 * wired up), so a plain `useState` is enough for M1.
 */
export function MonitoringTeaser({ policy, finding }: MonitoringTeaserProps) {
  const [snoozed, setSnoozed] = useState(false);

  if (!policy.monitoring || !policy.renewalPremium || snoozed) return null;

  return (
    <section className="rounded-[22px] bg-deep p-5 text-deeptext">
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-sun bg-sun/[0.18]">
        <Icon name="bell" size={14} />
        Roni found something
      </span>
      <p className="mt-3 text-lg font-semibold">
        Your {policy.type.toLowerCase()} insurance renews in {daysUntil(policy.renewalDate)} days.
      </p>
      <p className="opacity-90">
        Roni found {finding.comparableOptionCount} comparable options that may cost less.
      </p>
      <p className="mt-3.5 mb-0.5 text-sm opacity-85">Potential savings</p>
      <div className="text-[34px] font-extrabold tracking-tight text-sun leading-tight">
        Up to {formatMoney(finding.maxMonthlySavings)}/month
      </div>
      <div className="mt-4">
        <Button variant="sun" size="sm" href="/market">
          Compare options
        </Button>
        <button
          type="button"
          onClick={() => setSnoozed(true)}
          className="ml-2.5 rounded-full border border-deeptext/40 bg-transparent px-3.5 py-2 text-sm font-bold text-deeptext"
        >
          Remind me later
        </button>
      </div>
    </section>
  );
}
