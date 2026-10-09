import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getPolicy, getPolicyChatTurns } from "@/lib/wallet/repository";
import { RoniAvatar } from "@/components/roni/RoniAvatar";
import { PolicyAskPanel } from "@/components/roni/PolicyAskPanel";
import { Icon } from "@/components/ui/Icon";

interface AskPolicyPageProps {
  params: Promise<{ policyId: string }>;
}

export default async function AskPolicyPage({ params }: AskPolicyPageProps) {
  const { policyId } = await params;
  await requireUser(`/wallet/${policyId}/ask`);
  const supabase = await createClient();

  const [policy, initialTurns] = await Promise.all([getPolicy(supabase, policyId), getPolicyChatTurns(supabase, policyId)]);
  if (!policy) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href={`/wallet/${policyId}`} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-bg" aria-label="Back to policy">
          <Icon name="chevron" className="rotate-180" size={18} />
        </Link>
        <RoniAvatar size={40} />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Ask Roni about this policy</h1>
          <div className="text-sm text-muted">{policy.carrier ?? "Your Auto policy"}</div>
        </div>
      </div>

      <PolicyAskPanel policyId={policyId} initialTurns={initialTurns} />
    </div>
  );
}
