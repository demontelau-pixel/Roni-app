import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveAutoPolicyFacts, getPolicy } from "@/lib/wallet/repository";
import { emptyAutoPolicyFacts } from "@/lib/wallet/schemas/auto-policy";
import { buildComparisonProfile, comparisonProfileToAutoQuoteSeed } from "@/lib/wallet/comparison";
import { FactRow } from "@/components/roni/FactRow";
import { ContinueToMarketplaceButton } from "@/components/roni/ContinueToMarketplaceButton";
import { Panel } from "@/components/ui/Panel";
import { Icon } from "@/components/ui/Icon";
import { formatMoneyOrUnavailable } from "@/lib/utils";

interface ComparePageProps {
  params: Promise<{ policyId: string }>;
}

/**
 * M3.4's "safe intermediate comparison profile page" (per the brief's
 * own fallback language) rather than routing straight into
 * `/market/auto` with no confirmation: shows exactly what was carried
 * over from the policy before the person continues, so nothing feels
 * like it teleported in from nowhere.
 */
export default async function ComparePolicyPage({ params }: ComparePageProps) {
  const { policyId } = await params;
  await requireUser(`/wallet/${policyId}/compare`);
  const supabase = await createClient();

  const policy = await getPolicy(supabase, policyId);
  if (!policy) notFound();

  const latest = await getEffectiveAutoPolicyFacts(supabase, policyId);
  const facts = latest?.data ?? emptyAutoPolicyFacts();
  const profile = buildComparisonProfile(facts);
  const seed = comparisonProfileToAutoQuoteSeed(profile, facts);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href={`/wallet/${policyId}`} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-bg" aria-label="Back to policy">
          <Icon name="chevron" className="rotate-180" size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Compare similar coverage</h1>
          <div className="text-sm text-muted">RONI will carry over what it already knows.</div>
        </div>
      </div>

      <Panel padded>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">What RONI already knows</h2>
        <FactRow label="Vehicle" displayValue={profile.vehicle ? `${profile.vehicle.year ?? ""} ${profile.vehicle.make ?? ""} ${profile.vehicle.model ?? ""}`.trim() || null : null} />
        <FactRow label="State" displayValue={profile.state} />
        <FactRow
          label="Bodily injury liability"
          displayValue={profile.bodilyInjury && profile.bodilyInjury.perPerson !== null && profile.bodilyInjury.perAccident !== null ? `${formatMoneyOrUnavailable(profile.bodilyInjury.perPerson)} / ${formatMoneyOrUnavailable(profile.bodilyInjury.perAccident)}` : null}
        />
        <FactRow label="Property damage limit" displayValue={profile.propertyDamageLimit !== null ? formatMoneyOrUnavailable(profile.propertyDamageLimit) : null} />
        <FactRow label="Collision deductible" displayValue={profile.collisionDeductible !== null ? formatMoneyOrUnavailable(profile.collisionDeductible) : null} />
        <FactRow label="Comprehensive deductible" displayValue={profile.comprehensiveDeductible !== null ? formatMoneyOrUnavailable(profile.comprehensiveDeductible) : null} />
        <FactRow label="Current carrier" displayValue={profile.currentCarrier} />
        <FactRow label="Current monthly premium" displayValue={profile.currentMonthlyPremium !== null ? formatMoneyOrUnavailable(profile.currentMonthlyPremium) : null} />
      </Panel>

      <p className="text-sm text-muted">
        The Auto Marketplace still uses RONI&rsquo;s fictional, illustrative catalog — it will ask you anything it still
        needs, prefilled with what&rsquo;s above where possible.
      </p>

      <ContinueToMarketplaceButton vehicleSeed={seed.vehicle} driverSeed={seed.driver} />
    </div>
  );
}
