import type { ReactNode } from "react";
import type { InsuranceOption } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { Tag } from "@/components/ui/Tag";
import { PurchaseActionSheet } from "@/components/roni/PurchaseActionSheet";

interface CompareTableProps {
  options: InsuranceOption[];
}

interface Row {
  label: string;
  render: (o: InsuranceOption) => ReactNode;
}

const ROWS: Row[] = [
  { label: "Monthly premium", render: (o) => <b>{formatMoney(o.monthlyPremium)}</b> },
  { label: "Annual premium", render: (o) => formatMoney(o.monthlyPremium * 12) },
  { label: "Coverage", render: (o) => o.coverageSummary },
  { label: "Deductible", render: (o) => formatMoney(o.deductible) },
  {
    label: "Benefits",
    render: (o) => (
      <ul className="space-y-1">
        {o.benefits.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    ),
  },
  {
    label: "Important exclusions",
    render: (o) => (
      <ul className="space-y-1">
        {o.exclusions.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    ),
  },
];

/**
 * Ported from the prototype's comparison sheet. Every difference is
 * shown, none is labeled "best" — RONI helps the user see trade-offs,
 * per M2 spec §6/§14.
 */
export function CompareTable({ options }: CompareTableProps) {
  if (options.length < 2) {
    return <p className="text-muted">Select at least two options from the results to compare them.</p>;
  }

  return (
    <div className="-mx-[18px] overflow-x-auto px-[18px]">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-[110px]" />
            {options.map((o) => (
              <th key={o.id} className="border-t-0 py-2.5 pr-2 text-left align-top">
                <div className="text-base font-bold">{o.carrier}</div>
                {o.sponsored && (
                  <div className="mt-1">
                    <Tag variant="warn">Sponsored</Tag>
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label} className="border-t border-line align-top">
              <th scope="row" className="py-2.5 pr-2 text-left font-semibold text-muted">
                {row.label}
              </th>
              {options.map((o) => (
                <td key={o.id} className="py-2.5 pr-2">
                  {row.render(o)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-line align-top">
            <th scope="row" className="py-2.5 pr-2 text-left font-semibold text-muted">
              Purchase
            </th>
            {options.map((o) => (
              <td key={o.id} className="py-2.5 pr-2">
                <PurchaseActionSheet option={o} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
