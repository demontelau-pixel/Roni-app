import Link from "next/link";
import { MARKETPLACE_CATEGORY_META, MARKETPLACE_CATEGORY_ORDER } from "@/lib/data/categories";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";

/**
 * Ported from `marketScreen()`. M2 spec §1: every category is shown,
 * but only Auto links anywhere — the rest render as inert cards with
 * a "Coming soon" badge instead of a link, so there are no dead links.
 */
export default function MarketPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[28px] font-extrabold tracking-tight">What do you want to protect?</h1>

      <div className="grid grid-cols-2 gap-3">
        {MARKETPLACE_CATEGORY_ORDER.map((key) => {
          const meta = MARKETPLACE_CATEGORY_META[key];
          const body = (
            <>
              {meta.comingSoon && (
                <div className="absolute right-3 top-3">
                  <Tag variant="grey">Coming soon</Tag>
                </div>
              )}
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-soft text-primary">
                <Icon name={meta.icon} />
              </div>
              <div className="text-[17px] font-bold">{meta.label}</div>
            </>
          );

          if (meta.comingSoon) {
            return (
              <div
                key={key}
                aria-disabled="true"
                className="relative flex min-h-[118px] flex-col justify-center gap-2.5 rounded-[20px] border border-line bg-surface p-4 opacity-60"
              >
                {body}
              </div>
            );
          }

          return (
            <Link
              key={key}
              href={`/market/${key}`}
              className="relative flex min-h-[118px] flex-col justify-center gap-2.5 rounded-[20px] border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(16,34,58,0.05),0_8px_22px_rgba(16,34,58,0.05)] transition-transform hover:-translate-y-0.5 hover:border-primary"
            >
              {body}
            </Link>
          );
        })}
      </div>

      <div className="rounded-2xl bg-soft px-3.5 py-3 text-sm text-primary">
        Already have insurance? Add it to your{" "}
        <Link href="/wallet" className="underline underline-offset-4">
          Wallet
        </Link>{" "}
        and Roni will tell you what you have.
      </div>
    </div>
  );
}
