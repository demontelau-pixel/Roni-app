import Link from "next/link";
import { notFound } from "next/navigation";
import { AUTO_OPTIONS, autoOptionById } from "@/lib/data/auto-options";
import { formatMoney } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { Panel } from "@/components/ui/Panel";
import { OptionAskRoni } from "@/components/roni/OptionAskRoni";
import { PurchaseActionSheet } from "@/components/roni/PurchaseActionSheet";

interface PlanDetailsPageProps {
  params: Promise<{ optionId: string }>;
}

export default async function PlanDetailsPage({ params }: PlanDetailsPageProps) {
  const { optionId } = await params;
  const option = autoOptionById(optionId);
  if (!option) notFound();

  return (
    <div className="flex flex-col gap-5">
      <Link href="/market/auto/results" className="inline-flex items-center gap-1 font-bold text-primary">
        <Icon name="chevron" className="rotate-180" size={18} />
        Results
      </Link>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Tag>Illustrative quote — fictional data</Tag>
          {option.sponsored && <Tag variant="warn">Sponsored</Tag>}
        </div>
        {option.planName && <div className="text-sm font-bold text-muted">{option.planName}</div>}
        <h1 className="text-2xl font-bold tracking-tight">{option.carrier}</h1>
        <p className="mt-1 text-muted">{option.coverageSummary}</p>
      </div>

      <Panel padded>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm text-muted">Price</div>
            <div className="text-3xl font-extrabold tracking-tight">
              {formatMoney(option.monthlyPremium)}
              <span className="ml-1 text-sm font-semibold text-muted">/month</span>
            </div>
          </div>
          <div className="text-right text-sm text-muted">{formatMoney(option.monthlyPremium * 12)}/year</div>
        </div>
      </Panel>

      <section>
        <h2 className="mb-2 text-lg font-bold">Coverage</h2>
        <Panel padded className="text-[15px]">
          {option.coverageSummary}
        </Panel>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Deductibles</h2>
        <Panel padded className="text-[15px]">
          {formatMoney(option.deductible)} — what you&rsquo;d pay before this plan starts paying on a claim.
        </Panel>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Benefits</h2>
        <Panel>
          {option.benefits.map((b) => (
            <div key={b} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
              <div className="grid h-6 w-6 flex-none place-items-center rounded-full bg-soft text-primary">
                <Icon name="check" size={14} />
              </div>
              {b}
            </div>
          ))}
        </Panel>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Important exclusions</h2>
        <Panel>
          {option.exclusions.map((e) => (
            <div key={e} className="border-t border-line px-4 py-3 first:border-t-0">
              {e}
            </div>
          ))}
        </Panel>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Purchase options</h2>
        <PurchaseActionSheet option={option} />
      </section>

      <OptionAskRoni option={option} allOptions={AUTO_OPTIONS.filter((o) => !o.sponsored)} />
    </div>
  );
}
