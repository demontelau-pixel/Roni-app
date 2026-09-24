import { AuthCard } from "@/components/auth/AuthCard";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";

/**
 * Deliberately no server-side signed-in check here (unlike the other
 * auth pages): the recovery token this page relies on arrives in the
 * URL fragment, which never reaches the server — only the browser
 * client sees it. `UpdatePasswordForm` handles verifying it.
 */
export default function ResetPasswordConfirmPage() {
  return (
    <AuthCard title="Choose a new password">
      <UpdatePasswordForm />
    </AuthCard>
  );
}
