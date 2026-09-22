import Link from "next/link";
import type { Policy } from "@/lib/types";
import { CATEGORY_META } from "@/lib/data/categories";
import { daysUntil, formatMoney } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";

interface PolicyCardProps {
  policy: Policy;
}

/**
 * Ported from the prototype's `polRow()`. Links into the Wallet section —
 * the individual policy detail screen (`/wallet/[id]`) is planned for a
 * later milestone (M3), so for now every row opens the Wallet overview.
 */
export function PolicyCard({ policy }: PolicyCardProps) {
  const days = daysUntil(policy.renewalDate);
  const meta = CATEGORY_META[policy.category];

  return (
    <Link
      href="/wallet"
      className="flex items-center gap-3.5 px-4 py-3.5 w-full text-left hover:bg-bg/60 transition-colors"
    >
      <div className="w-[42px] h-[42px] rounded-2xl bg-soft text-primary grid place-items-center flex-none">
        <Icon name={meta.icon} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold">{policy.type} insurance</div>
        <div className="text-muted text-sm">{policy.carrier}</div>
        <div className="mt-1 flex gap-1.5 flex-wrap">
          <Tag variant="good">Active</Tag>
          {policy.owner !== "me" && <Tag variant="grey">{policy.owner}&rsquo;s policy</Tag>}
        </div>
      </div>
      <div className="text-right flex-none">
        <div className="font-bold">{formatMoney(policy.monthlyPremium)}/month</div>
        <div className="text-muted text-sm">Renews in {days} days</div>
      </div>
    </Link>
  );
}
