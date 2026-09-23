"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useHealthQuote } from "@/lib/state/health-quote-context";
import type { HealthPlan, HealthQuoteError, HealthSearchCriteria } from "@/lib/types";
import { formatMoneyOrUnavailable } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/ui/Panel";
import { Tag } from "@/components/ui/Tag";
import { CmsAttribution } from "@/components/roni/CmsAttribution";
import { HealthQuoteErrorState } from "@/components/roni/HealthQuoteErrorState";

type FetchState = { status: "loading" } | { status: "error"; error: HealthQuoteError } | { status: "ready"; plan: HealthPlan };

function row(label: string, value: string) {
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 first:border-t-0">
      <span className="text-muted">{label}</span>
      <b className="text-right">{value}</b>
    </div>
  );
}

export default function HealthPlanDetailsPage() {
  const { planId } = useParams<{ planId: string }>();
  const { location, year, applicant, household, locationComplete, applicantComplete } = useHealthQuote();
  const [state, setState] = useState<FetchState>({ status: "loading" });

  const criteria: HealthSearchCriteria | null =
    locationComplete && applicantComplete && year ? { location, year, applicant, household } : null;

  useEffect(() => {
    if (!criteria) {
      setState({ status: "error", error: { code: "invalid_request", message: "Some answers are missing — please start the Health quote again." } });
      return;
    }
    let cancelled = false;
    fetch(`/api/health/plans/${encodeURIComponent(planId)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(criteria),
    })
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: "error", error: res.error });
          return;
        }
        setState({ status: "ready", plan: res.data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", error: { code: "cms_unavailable", message: "Roni couldn't load this plan right now. Please try again." } });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/market/health/results" className="inline-flex items-center gap-1 font-bold text-primary">
        <Icon name="chevron" className="rotate-180" size={18} />
        Results
      </Link>

      {state.status === "loading" && <p className="py-8 text-center text-muted">Loading this plan&rsquo;s details…</p>}
      {state.status === "error" && <HealthQuoteErrorState error={state.error} />}

      {state.status === "ready" && (
        <>
          <div>
            <div className="mb-2">
              <CmsAttribution compact />
            </div>
            <div className="text-sm font-bold text-muted">{state.plan.issuer}</div>
            <h1 className="text-2xl font-bold tracking-tight">{state.plan.planName}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {state.plan.metalLevel && <Tag>{state.plan.metalLevel}</Tag>}
              {state.plan.planType && <Tag variant="grey">{state.plan.planType}</Tag>}
              {state.plan.hsaEligible && <Tag variant="grey">HSA eligible</Tag>}
            </div>
          </div>

          <Panel padded>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-sm text-muted">Monthly premium</div>
                <div className="text-3xl font-extrabold tracking-tight">
                  {formatMoneyOrUnavailable(state.plan.monthlyPremium)}
                </div>
              </div>
              {state.plan.estimatedTaxCredit !== null && state.plan.estimatedTaxCredit > 0 && (
                <div className="text-right text-sm text-good">
                  ~{formatMoneyOrUnavailable(state.plan.estimatedTaxCredit)}/mo estimated credit
                  <div className="text-muted">
                    ({formatMoneyOrUnavailable(state.plan.monthlyPremiumBeforeCredit)} before credit)
                  </div>
                </div>
              )}
            </div>
          </Panel>

          <section>
            <h2 className="mb-2 text-lg font-bold">Costs</h2>
            <Panel>
              {row("Deductible", formatMoneyOrUnavailable(state.plan.deductible))}
              {row("Max out-of-pocket", formatMoneyOrUnavailable(state.plan.maxOutOfPocket))}
            </Panel>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold">Key benefits</h2>
            <Panel>
              {row("Primary care", state.plan.primaryCare?.costSharing ?? "Not available")}
              {row("Specialist", state.plan.specialist?.costSharing ?? "Not available")}
              {row("Generic drugs", state.plan.genericDrugs?.costSharing ?? "Not available")}
            </Panel>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold">Network</h2>
            <Panel>
              {row(
                "National network",
                state.plan.hasNationalNetwork === null ? "Not available" : state.plan.hasNationalNetwork ? "Yes" : "No",
              )}
              {state.plan.qualityRating !== null && row("Quality rating", `${state.plan.qualityRating} / 5`)}
            </Panel>
            {(state.plan.benefitsUrl || state.plan.networkUrl) && (
              <div className="mt-2.5 flex flex-wrap gap-3 text-sm">
                {state.plan.benefitsUrl && (
                  <a href={state.plan.benefitsUrl} target="_blank" rel="noreferrer" className="font-bold text-primary underline underline-offset-4">
                    Summary of benefits
                  </a>
                )}
                {state.plan.networkUrl && (
                  <a href={state.plan.networkUrl} target="_blank" rel="noreferrer" className="font-bold text-primary underline underline-offset-4">
                    Provider network
                  </a>
                )}
              </div>
            )}
          </section>

          <CmsAttribution />
        </>
      )}
    </div>
  );
}
