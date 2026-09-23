"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useHealthQuote } from "@/lib/state/health-quote-context";
import type { HealthPlan, HealthQuoteError, HealthSearchCriteria, HealthSearchMeta } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { Chip } from "@/components/ui/Chip";
import { TextField } from "@/components/ui/TextField";
import { HealthPlanCard } from "@/components/roni/HealthPlanCard";
import { CmsAttribution } from "@/components/roni/CmsAttribution";
import { HealthQuoteErrorState } from "@/components/roni/HealthQuoteErrorState";

type SortKey = "premium" | "deductible";
const SORT_LABELS: Record<SortKey, string> = { premium: "Price", deductible: "Deductible" };

type FetchState =
  | { status: "loading" }
  | { status: "error"; error: HealthQuoteError }
  | { status: "empty" }
  | { status: "ready"; plans: HealthPlan[]; meta: HealthSearchMeta };

/** "42 plans available from 6 insurance companies" — never invents a number, only ever describes what was actually loaded/reported. */
function resultsSummary(meta: HealthSearchMeta): string {
  const carrierPart = `${meta.uniqueCarrierCount} insurance ${meta.uniqueCarrierCount === 1 ? "company" : "companies"}`;
  if (meta.totalAvailable !== null && meta.totalAvailable > meta.loadedCount) {
    return `Showing ${meta.loadedCount} of ${meta.totalAvailable} plans available, from ${carrierPart}.`;
  }
  const planWord = meta.loadedCount === 1 ? "plan" : "plans";
  return `${meta.loadedCount} ${planWord} available from ${carrierPart}.`;
}

export default function HealthResultsPage() {
  const { location, year, applicant, household, locationComplete, applicantComplete } = useHealthQuote();
  const [state, setState] = useState<FetchState>({ status: "loading" });
  const [sort, setSort] = useState<SortKey>("premium");
  const [metalFilter, setMetalFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [carrierFilter, setCarrierFilter] = useState<string | null>(null);
  const [hsaOnly, setHsaOnly] = useState(false);
  const [maxPremiumInput, setMaxPremiumInput] = useState("");
  const [maxDeductibleInput, setMaxDeductibleInput] = useState("");

  const criteria: HealthSearchCriteria | null =
    locationComplete && applicantComplete && year ? { location, year, applicant, household } : null;

  function runSearch() {
    if (!criteria) {
      setState({ status: "error", error: { code: "invalid_request", message: "Some answers are missing — please go back and complete the quote." } });
      return () => {};
    }
    let cancelled = false;
    setState({ status: "loading" });
    fetch("/api/health/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(criteria),
    })
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setState(res.error.code === "no_plans" ? { status: "empty" } : { status: "error", error: res.error });
          return;
        }
        setState({ status: "ready", plans: res.data.plans, meta: res.data.meta });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", error: { code: "cms_unavailable", message: "Roni couldn't reach the Health Marketplace right now. Please try again." } });
      });
    return () => {
      cancelled = true;
    };
  }

  useEffect(() => {
    const cleanup = runSearch();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria?.location.countyfips, criteria?.year, criteria?.applicant.age, criteria?.applicant.dob, criteria?.applicant.usesTobacco, criteria?.household.income]);

  const plans = useMemo(() => (state.status === "ready" ? state.plans : []), [state]);
  const metalLevels = useMemo(() => Array.from(new Set(plans.map((p) => p.metalLevel).filter(Boolean))) as string[], [plans]);
  const planTypes = useMemo(() => Array.from(new Set(plans.map((p) => p.planType).filter(Boolean))) as string[], [plans]);
  const carriers = useMemo(() => Array.from(new Set(plans.map((p) => p.issuer).filter(Boolean))).sort(), [plans]);
  const hasHsaPlans = useMemo(() => plans.some((p) => p.hsaEligible === true), [plans]);

  const maxPremium = maxPremiumInput ? Number(maxPremiumInput) : null;
  const maxDeductible = maxDeductibleInput ? Number(maxDeductibleInput) : null;

  const shown = useMemo(() => {
    let list = plans;
    if (metalFilter) list = list.filter((p) => p.metalLevel === metalFilter);
    if (typeFilter) list = list.filter((p) => p.planType === typeFilter);
    if (carrierFilter) list = list.filter((p) => p.issuer === carrierFilter);
    if (hsaOnly) list = list.filter((p) => p.hsaEligible === true);
    if (maxPremium !== null && Number.isFinite(maxPremium)) {
      list = list.filter((p) => p.monthlyPremium !== null && p.monthlyPremium <= maxPremium);
    }
    if (maxDeductible !== null && Number.isFinite(maxDeductible)) {
      list = list.filter((p) => p.deductible !== null && p.deductible <= maxDeductible);
    }
    return [...list].sort((a, b) => {
      if (sort === "premium") return (a.monthlyPremium ?? Infinity) - (b.monthlyPremium ?? Infinity);
      return (a.deductible ?? Infinity) - (b.deductible ?? Infinity);
    });
  }, [plans, sort, metalFilter, typeFilter, carrierFilter, hsaOnly, maxPremium, maxDeductible]);

  const hasAnyFilters = plans.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/market/health/household" className="inline-flex items-center gap-1 font-bold text-primary">
        <Icon name="chevron" className="rotate-180" size={18} />
        Edit answers
      </Link>

      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight">Health plans</h1>
        {state.status === "ready" && (
          <p className="mt-1.5 font-semibold">{resultsSummary(state.meta)}</p>
        )}
        <p className="mt-1.5 text-muted">
          Based on your ZIP code, age and household. There&rsquo;s no single best plan — RONI is
          here to help you compare, not choose for you.
        </p>
        <p className="mt-1 text-xs text-muted">
          These are results from the federal Health Insurance Marketplace, not a survey of every
          health plan in the U.S.
        </p>
        {state.status === "ready" && !state.meta.complete && (
          <p className="mt-2 rounded-xl bg-warnbg px-3 py-2 text-sm text-warn">
            Roni couldn&rsquo;t load every matching plan this time — these results may be partial.
            Try again in a moment for the full set.
          </p>
        )}
      </div>

      <CmsAttribution />

      {state.status === "loading" && <p className="py-8 text-center text-muted">Looking up real plans in your area…</p>}

      {state.status === "error" && <HealthQuoteErrorState error={state.error} onRetry={runSearch} />}

      {state.status === "empty" && (
        <div className="rounded-2xl border border-line bg-surface px-5 py-10 text-center text-muted">
          No Marketplace plans matched your search for this area and year.
        </div>
      )}

      {state.status === "ready" && (
        <>
          {hasAnyFilters && (
            <div className="flex flex-col gap-2.5">
              <div>
                <div className="mb-1.5 text-sm font-bold">Sort by</div>
                <div className="flex gap-2">
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                    <Chip key={k} active={sort === k} onClick={() => setSort(k)}>
                      {SORT_LABELS[k]}
                    </Chip>
                  ))}
                </div>
              </div>

              {metalLevels.length > 1 && (
                <div>
                  <div className="mb-1.5 text-sm font-bold">Metal level</div>
                  <div className="-mx-[18px] flex gap-2 overflow-x-auto px-[18px]">
                    <Chip active={!metalFilter} onClick={() => setMetalFilter(null)}>
                      All
                    </Chip>
                    {metalLevels.map((m) => (
                      <Chip key={m} active={metalFilter === m} onClick={() => setMetalFilter(m)}>
                        {m}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {planTypes.length > 1 && (
                <div>
                  <div className="mb-1.5 text-sm font-bold">Plan type</div>
                  <div className="flex flex-wrap gap-2">
                    <Chip active={!typeFilter} onClick={() => setTypeFilter(null)}>
                      All
                    </Chip>
                    {planTypes.map((t) => (
                      <Chip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
                        {t}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {carriers.length > 1 && (
                <div>
                  <div className="mb-1.5 text-sm font-bold">Insurance company</div>
                  <div className="-mx-[18px] flex gap-2 overflow-x-auto px-[18px]">
                    <Chip active={!carrierFilter} onClick={() => setCarrierFilter(null)}>
                      All
                    </Chip>
                    {carriers.map((c) => (
                      <Chip key={c} active={carrierFilter === c} onClick={() => setCarrierFilter(c)}>
                        {c}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {hasHsaPlans && (
                <div>
                  <div className="mb-1.5 text-sm font-bold">HSA</div>
                  <Chip active={hsaOnly} aria-pressed={hsaOnly} onClick={() => setHsaOnly((v) => !v)}>
                    HSA eligible only
                  </Chip>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <TextField
                  id="max-premium"
                  label="Max monthly premium"
                  inputMode="numeric"
                  placeholder="No limit"
                  value={maxPremiumInput}
                  onChange={(e) => setMaxPremiumInput(e.target.value.replace(/\D/g, ""))}
                />
                <TextField
                  id="max-deductible"
                  label="Max deductible"
                  inputMode="numeric"
                  placeholder="No limit"
                  value={maxDeductibleInput}
                  onChange={(e) => setMaxDeductibleInput(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
          )}

          {shown.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface px-5 py-10 text-center text-muted">
              No loaded plans match these filters — try widening them.
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {shown.map((plan) => (
                <HealthPlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
