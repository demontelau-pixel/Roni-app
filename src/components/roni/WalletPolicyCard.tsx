import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { CATEGORY_META, type CategoryMeta } from "@/lib/data/categories";
import { formatMoneyOrUnavailable } from "@/lib/utils";
import type { WalletPolicy } from "@/lib/wallet/types";
import { processingStateDisplay, type WalletProcessingState } from "@/lib/wallet/processing-state";

interface WalletPolicyCardProps {
  policy: WalletPolicy;
  processingState: WalletProcessingState;
}

/**
 * The real-data equivalent of `PolicyCard` (`components/roni/PolicyCard.tsx`,
 * which renders the fictional `Policy` type from `lib/data/policies.ts`
 * and is left untouched). This one renders a real `WalletPolicy` and
 * links to the real per-policy dashboard, which didn't exist before
 * M3.1.
 */
export function WalletPolicyCard({ policy, processingState }: WalletPolicyCardProps) {
  // `policy.category` is `WalletCategory` (broader than the fictional
  // `PolicyCategory` `CATEGORY_META` is keyed by) — looked up via a
  // plain string index rather than a cast, so a category outside
  // `CATEGORY_META` (e.g. a future "motorcycle" Wallet policy) types
  // as `undefined` honestly instead of lying to the compiler.
  const meta = (CATEGORY_META as Record<string, CategoryMeta>)[policy.category];
  const display = processingStateDisplay(processingState);

  return (
    <Link
      href={`/wallet/${policy.id}`}
      className="flex items-center gap-3.5 px-4 py-3.5 w-full text-left hover:bg-bg/60 transition-colors"
    >
      <div className="w-[42px] h-[42px] rounded-2xl bg-soft text-primary grid place-items-center flex-none">
        <Icon name={meta?.icon ?? "car"} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold">Auto insurance</div>
        <div className="text-muted text-sm">{policy.carrier ?? "Carrier not determined"}</div>
        <div className="mt-1 flex gap-1.5 flex-wrap">
          <Tag variant={display.tone === "good" ? "good" : display.tone === "warn" ? "warn" : "grey"}>{display.label}</Tag>
        </div>
      </div>
      <div className="text-right flex-none">
        <div className="font-bold">
          {policy.premiumAmount !== null ? `${formatMoneyOrUnavailable(policy.premiumAmount)}` : "Not determined"}
        </div>
        {policy.premiumAmount !== null && (
          <div className="text-muted text-sm">{(policy.premiumFrequency ?? "").replace("_", "-") || "per term"}</div>
        )}
      </div>
    </Link>
  );
}
