import type { Policy } from "@/lib/types";
import { daysUntil, formatMoney } from "@/lib/utils";
import { Panel } from "@/components/ui/Panel";

/** Ported from the prototype's `CHART` palette. */
const CHART_COLORS = ["#0E7C86", "#FFC857", "#7C6CF0", "#E8846A", "#4C9F70"];

interface InsuranceGlanceProps {
  policies: Policy[];
}

/** Ported from the "Your insurance at a glance" section of `homeScreen()`. */
export function InsuranceGlance({ policies }: InsuranceGlanceProps) {
  const monthly = policies.reduce((sum, p) => sum + p.monthlyPremium, 0);
  const next = [...policies].sort(
    (a, b) => daysUntil(a.renewalDate) - daysUntil(b.renewalDate),
  )[0];

  const stats: Array<{ label: string; value: string }> = [
    { label: "Active policies", value: String(policies.length) },
    { label: "Monthly cost", value: formatMoney(monthly) },
    { label: "Annual estimated cost", value: formatMoney(monthly * 12) },
    ...(next
      ? [{ label: "Next renewal", value: `${next.type} — ${daysUntil(next.renewalDate)} days` }]
      : []),
  ];

  return (
    <Panel padded className="p-4">
      <h2 className="mb-3.5 text-xl font-bold tracking-tight">Your insurance at a glance</h2>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
        {stats.map((s) => (
          <div key={s.label}>
            <div className="text-muted text-sm">{s.label}</div>
            <div className="font-bold text-2xl">{s.value}</div>
          </div>
        ))}
      </div>
      {policies.length > 0 && (
        <>
          <div
            role="img"
            aria-label="Monthly cost by policy"
            className="mt-3.5 flex h-3.5 gap-0.5 overflow-hidden rounded-lg"
          >
            {policies.map((p, i) => (
              <span
                key={p.id}
                style={{
                  width: `${(p.monthlyPremium / monthly) * 100}%`,
                  background: CHART_COLORS[i % CHART_COLORS.length],
                }}
              />
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[13.5px]">
            {policies.map((p, i) => (
              <span key={p.id} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-[3px]"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                {p.type} {formatMoney(p.monthlyPremium)}
              </span>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}
