import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLatestExtractedPolicyData, getPolicies } from "@/lib/wallet/repository";
import { deriveProcessingState } from "@/lib/wallet/processing-state";
import { WalletPolicyCard } from "@/components/roni/WalletPolicyCard";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/**
 * The real Wallet list (M3.1) — replaces the M3 `ComingSoon`
 * placeholder. Shows every policy the signed-in user has uploaded, or
 * an empty state pointing at `/wallet/upload` if they haven't
 * uploaded one yet. Home, Marketplace, Ask Roni, and Profile are
 * untouched by this change.
 */
export default async function WalletPage() {
  await requireUser("/wallet");
  const supabase = await createClient();

  const policies = await getPolicies(supabase);
  const withState = await Promise.all(
    policies.map(async (policy) => {
      const latest = await getLatestExtractedPolicyData(supabase, policy.id);
      return { policy, processingState: deriveProcessingState(latest?.extractionStatus ?? null) };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
          <div className="text-sm text-muted">Your policies, in one place.</div>
        </div>
        <Button href="/wallet/upload" size="sm">
          <Icon name="upload" size={18} />
          Upload
        </Button>
      </div>

      {withState.length === 0 ? (
        <Panel padded className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-soft text-primary">
            <Icon name="wallet" size={28} />
          </div>
          <div>
            <h2 className="text-lg font-bold">No policies yet</h2>
            <p className="mx-auto mt-2 max-w-[38ch] text-muted">
              Upload an Auto insurance policy PDF and RONI will keep it here — private, organized, and ready for Ask Roni
              and comparisons.
            </p>
          </div>
          <Button href="/wallet/upload">
            <Icon name="upload" size={18} />
            Upload your first policy
          </Button>
        </Panel>
      ) : (
        <Panel className="divide-y divide-line">
          {withState.map(({ policy, processingState }) => (
            <WalletPolicyCard key={policy.id} policy={policy} processingState={processingState} />
          ))}
        </Panel>
      )}
    </div>
  );
}
