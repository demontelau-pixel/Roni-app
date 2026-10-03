import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { UploadPolicyForm } from "@/components/roni/UploadPolicyForm";
import { Icon } from "@/components/ui/Icon";

export default async function UploadPolicyPage() {
  await requireUser("/wallet/upload");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/wallet" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-bg" aria-label="Back to Wallet">
          <Icon name="chevron" className="rotate-180" size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Upload a policy</h1>
          <div className="text-sm text-muted">Auto insurance, for now — more categories are coming.</div>
        </div>
      </div>

      <UploadPolicyForm />
    </div>
  );
}
