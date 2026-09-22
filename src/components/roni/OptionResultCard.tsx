"use client";

import { useState } from "react";
import type { InsuranceOption, PriorityKey } from "@/lib/types";
import type { MatchScores } from "@/lib/logic/rank-options";
import { PRIORITY_LABELS } from "@/lib/logic/rank-options";
import { formatMoney } from "@/lib/utils";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { OptionAskRoni } from "@/components/roni/OptionAskRoni";

interface OptionResultCardProps {
  option: InsuranceOption;
  allOptions: InsuranceOption[];
  /** Priorities this option scores well on — renders as "Matches your priorities" tags. */
  strongPriorities?: PriorityKey[];
  scores?: MatchScores;
  topMatch?: boolean;
  compareSelected: boolean;
  onToggleCompare: () => void;
  compareDisabled?: boolean;
}

export function OptionResultCard({
  option,
  allOptions,
  strongPriorities = [],
  topMatch = false,
  compareSelected,
  onToggleCompare,
  compareDisabled = false,
}: OptionResultCardProps) {
  const [showExclusions, setShowExclusions] = useState(false);
  const [showAsk, setShowAsk] = useState(false);

  return (
    <article
      className={`rounded-[20px] border bg-surface p-4 ${
        option.sponsored ? "border-dashed border-warn" : topMatch ? "border-2 border-primary" : "border-line"
      }`}
    >
      {option.sponsored && (
        <div className="mb-2.5">
          <Tag variant="warn">Sponsored</Tag>
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          {option.planName && !option.sponsored && (
            <div className="text-sm font-bold text-muted">{option.planName}</div>
          )}
          <h3 className="text-base font-bold">{option.carrier}</h3>
          <div className="mt-0.5 text-sm text-muted">{option.coverageSummary}</div>
        </div>
        <div className="text-right leading-none">
          <div className="text-2xl font-extrabold tracking-tight">{formatMoney(option.monthlyPremium)}</div>
          <div className="text-xs font-semibold text-muted">/month</div>
        </div>
      </div>

      {!option.sponsored && strongPriorities.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {topMatch && <Tag>Closest match to your priorities</Tag>}
          {strongPriorities.map((key) => (
            <Tag key={key} variant="grey">
              {PRIORITY_LABELS[key]}
            </Tag>
          ))}
        </div>
      )}

      <div className="mt-2.5 text-sm">
        Deductible: <b>{formatMoney(option.deductible)}</b>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {option.benefits.slice(0, 3).map((b) => (
          <li
            key={b}
            className="relative pl-4 before:absolute before:left-0 before:top-[0.55em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-primary"
          >
            {b}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setShowExclusions((v) => !v)}
        className="mt-2 text-sm font-bold text-primary underline underline-offset-4"
      >
        {showExclusions ? "Hide" : "Show"} exclusions
      </button>
      {showExclusions && (
        <ul className="mt-1.5 space-y-1 text-sm">
          {option.exclusions.map((e) => (
            <li
              key={e}
              className="relative pl-4 before:absolute before:left-0 before:top-[0.55em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-bad"
            >
              {e}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3.5 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" href={`/market/auto/results/${option.id}`}>
          View details
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowAsk((v) => !v)}>
          <Icon name="star" size={16} />
          Ask Roni
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onToggleCompare}
          disabled={compareDisabled && !compareSelected}
          aria-pressed={compareSelected}
        >
          {compareSelected ? <Icon name="check" size={16} /> : null}
          {compareSelected ? "Added" : "Compare"}
        </Button>
      </div>

      {showAsk && (
        <div className="mt-3.5">
          <OptionAskRoni option={option} allOptions={allOptions} />
        </div>
      )}
    </article>
  );
}
