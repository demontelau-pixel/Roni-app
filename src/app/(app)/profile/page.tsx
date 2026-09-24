import { requireUser } from "@/lib/auth/session";
import { resolveIdentity } from "@/lib/auth/identity";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Panel } from "@/components/ui/Panel";
import { ComingSoon } from "@/components/roni/ComingSoon";

const NEUTRAL_NAME = "there";

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const identity = await resolveIdentity(user);

  const displayName = [identity.firstName, identity.lastName].filter(Boolean).join(" ") || NEUTRAL_NAME;

  return (
    <div className="flex flex-col gap-5">
      <Panel padded className="flex items-center justify-between gap-3">
        <div>
          <div className="font-bold">Signed in as {displayName}</div>
          <div className="text-sm text-muted">{identity.email}</div>
        </div>
        <SignOutButton />
      </Panel>

      <ComingSoon
        icon="user"
        title="Profile"
        milestone="M4"
        description="Personal information, household, insurance needs, privacy controls and Roni Rewards will live here."
      />
    </div>
  );
}
