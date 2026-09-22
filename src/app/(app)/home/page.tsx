import Link from "next/link";
import { SAMPLE_POLICIES } from "@/lib/data/policies";
import { SAMPLE_USER } from "@/lib/data/user";
import { monitoringFindingFor } from "@/lib/data/monitoring";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/ui/Panel";
import { PolicyCard } from "@/components/roni/PolicyCard";
import { InsuranceGlance } from "@/components/roni/InsuranceGlance";
import { MonitoringTeaser } from "@/components/roni/MonitoringTeaser";
import { AskRoniTeaser } from "@/components/roni/AskRoniTeaser";
import { Greeting } from "@/components/roni/Greeting";

/**
 * Server Component: reads the sample data directly (no need for the
 * client-side `useAppState()` context here — that hook exists for
 * client components further down the tree, e.g. once a real signed-in
 * user replaces `SAMPLE_USER` in a later milestone).
 */
export default function HomePage() {
  const user = SAMPLE_USER;
  const policies = SAMPLE_POLICIES;
  const myPolicies = policies.filter((p) => p.owner === "me");
  const hasLifePolicy = myPolicies.some((p) => p.category === "life");
  const autoPolicy = policies.find((p) => p.category === "auto");
  const autoFinding = autoPolicy ? monitoringFindingFor(autoPolicy.id) : undefined;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex items-start justify-between gap-3">
        <Greeting firstName={user.firstName} />
        <Link
          href="/profile"
          aria-label="Profile"
          className="grid h-11 w-11 flex-none place-items-center rounded-full bg-ink font-extrabold text-bg"
        >
          {user.firstName[0] ?? "A"}
        </Link>
      </div>

      <section>
        <div className="mb-2.5 flex items-baseline justify-between">
          <h2 className="text-xl font-bold tracking-tight">Your protection</h2>
          <Link href="/wallet" className="text-sm font-bold text-primary underline underline-offset-4">
            Open wallet
          </Link>
        </div>
        <Panel>
          {policies.map((policy) => (
            <div key={policy.id} className="border-t border-line first:border-t-0">
              <PolicyCard policy={policy} />
            </div>
          ))}
          {!hasLifePolicy && (
            <Link
              href="/market"
              className="flex items-center gap-3.5 border-t border-line px-4 py-3.5"
            >
              <div className="grid h-[42px] w-[42px] flex-none place-items-center rounded-2xl border border-dashed border-off text-muted">
                <Icon name="shield" />
              </div>
              <div className="flex-1">
                <div className="font-bold">Life insurance</div>
                <div className="text-sm text-muted">No active policy</div>
              </div>
              <span className="flex-none rounded-full bg-soft px-3.5 py-2 text-sm font-bold text-primary">
                Explore coverage
              </span>
            </Link>
          )}
        </Panel>
      </section>

      <InsuranceGlance policies={myPolicies} />

      {autoPolicy && autoFinding && <MonitoringTeaser policy={autoPolicy} finding={autoFinding} />}

      <AskRoniTeaser />

      <p className="text-center text-xs text-muted">RONI V0.1 — Next.js migration, fictional data</p>
    </div>
  );
}
