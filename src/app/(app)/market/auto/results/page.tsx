"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AUTO_OPTIONS } from "@/lib/data/auto-options";
import { useAutoQuote } from "@/lib/state/auto-quote-context";
import { PRIORITY_LABELS, SORT_LABELS, rankOptions, sortOptions, type SortKey } from "@/lib/logic/rank-options";
import { Icon } from "@/components/ui/Icon";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { OptionResultCard } from "@/components/roni/OptionResultCard";
import { HowRoniMakesMoney } from "@/components/roni/HowRoniMakesMoney";

const SORT_ORDER: SortKey[] = ["match", "price", "coverage", "deductible", "benefits"];
const MAX_COMPARE = 3;

export default function AutoResultsPage() {
  const router = useRouter();
  const { priorities } = useAutoQuote();
  const [sort, setSort] = useState<SortKey>("match");
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const organic = useMemo(() => AUTO_OPTIONS.filter((o) => !o.sponsored), []);
  const sponsored = useMemo(() => AUTO_OPTIONS.find((o) => o.sponsored), []);
  const ranked = useMemo(() => rankOptions(organic, priorities), [organic, priorities]);
  const ordered = sort === "match" ? ranked.map((r) => r.option) : sortOptions(organic, sort);

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  }

  return (
    <div className="flex flex-col gap-5 pb-20">
      <Link href="/market/auto/priorities" className="inline-flex items-center gap-1 font-bold text-primary">
        <Icon name="chevron" className="rotate-180" size={18} />
        Edit priorities
      </Link>

      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight">Auto options</h1>
        <p className="mt-1.5 text-muted">
          Based on the priorities you selected ({priorities.map((p) => PRIORITY_LABELS[p].toLowerCase()).join(", ")}),
          these options most closely match your criteria. There&rsquo;s no single best plan for everyone —
          RONI is here to help you compare, not choose for you.
        </p>
      </div>

      <div>
        <div className="mb-1.5 text-sm font-bold">Sort by</div>
        <div className="-mx-[18px] flex gap-2 overflow-x-auto px-[18px]">
          {SORT_ORDER.map((key) => (
            <Chip key={key} active={sort === key} aria-pressed={sort === key} onClick={() => setSort(key)}>
              {SORT_LABELS[key]}
            </Chip>
          ))}
        </div>
      </div>

      <section className="flex flex-col gap-3.5">
        <h2 className="text-lg font-bold">Your matches</h2>
        {ordered.map((option, i) => {
          const rankedEntry = ranked.find((r) => r.option.id === option.id);
          return (
            <OptionResultCard
              key={option.id}
              option={option}
              allOptions={organic}
              strongPriorities={sort === "match" ? rankedEntry?.strongPriorities : undefined}
              topMatch={sort === "match" && i === 0}
              compareSelected={compareIds.includes(option.id)}
              onToggleCompare={() => toggleCompare(option.id)}
              compareDisabled={compareIds.length >= MAX_COMPARE}
            />
          );
        })}
      </section>

      {sponsored && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-lg font-bold">Sponsored</h2>
          <p className="text-sm text-muted">
            Sponsored placements are always labeled, shown separately, and never change your matches above.
          </p>
          <OptionResultCard
            option={sponsored}
            allOptions={organic}
            compareSelected={compareIds.includes(sponsored.id)}
            onToggleCompare={() => toggleCompare(sponsored.id)}
            compareDisabled={compareIds.length >= MAX_COMPARE}
          />
        </section>
      )}

      <HowRoniMakesMoney />

      {compareIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center border-t border-line bg-bg px-[18px] py-3 min-[900px]:left-[236px]">
          <div className="flex w-full max-w-[760px] items-center justify-between">
            <span className="font-bold">{compareIds.length} selected</span>
            <Button
              size="sm"
              disabled={compareIds.length < 2}
              onClick={() => router.push(`/market/auto/results/compare?ids=${compareIds.join(",")}`)}
            >
              <Icon name="compare" size={16} />
              Compare
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
