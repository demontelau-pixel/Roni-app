import type { HealthPlan } from "@/lib/types";
import { formatMoneyOrUnavailable } from "@/lib/utils";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";

interface HealthPlanCardProps {
  plan: HealthPlan;
}

const METAL_TAG_VARIANT: Record<string, "default" | "grey"> = {
  Bronze: "grey",
  Silver: "grey",
  Gold: "default",
  Platinum: "default",
  Catastrophic: "grey",
};

export function HealthPlanCard({ plan }: HealthPlanCardProps) {
  return (
    <article className="rounded-[20px] border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-muted">{plan.issuer}</div>
          <h3 className="text-base font-bold">{plan.planName}</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {plan.metalLevel && <Tag variant={METAL_TAG_VARIANT[plan.metalLevel] ?? "grey"}>{plan.metalLevel}</Tag>}
            {plan.planType && <Tag variant="grey">{plan.planType}</Tag>}
          </div>
        </div>
        <div className="text-right leading-none">
          <div className="text-2xl font-extrabold tracking-tight">{formatMoneyOrUnavailable(plan.monthlyPremium)}</div>
          <div className="text-xs font-semibold text-muted">/month</div>
          {plan.estimatedTaxCredit !== null && plan.estimatedTaxCredit > 0 && (
            <div className="mt-0.5 text-xs font-semibold text-good">after estimated credit</div>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted">Deductible: </span>
          <b>{formatMoneyOrUnavailable(plan.deductible)}</b>
        </div>
        <div>
          <span className="text-muted">Max out-of-pocket: </span>
          <b>{formatMoneyOrUnavailable(plan.maxOutOfPocket)}</b>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs">
        {plan.primaryCare && (
          <Tag variant="grey">Primary care: {plan.primaryCare.costSharing ?? "see plan"}</Tag>
        )}
        {plan.specialist && <Tag variant="grey">Specialist: {plan.specialist.costSharing ?? "see plan"}</Tag>}
        {plan.hsaEligible && <Tag variant="grey">HSA eligible</Tag>}
      </div>

      <div className="mt-3.5">
        <Button size="sm" variant="ghost" href={`/market/health/results/${plan.id}`}>
          View details
        </Button>
      </div>
    </article>
  );
}
