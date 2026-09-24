import { requireUser } from "@/lib/auth/session";
import { ComingSoon } from "@/components/roni/ComingSoon";

export default async function WalletPage() {
  await requireUser("/wallet");

  return (
    <ComingSoon
      icon="wallet"
      title="Wallet"
      milestone="M3"
      description="The full policy list, uploading a policy, and the detailed policy view (coverage, deductibles, benefits, exclusions, documents) will live here."
    />
  );
}
