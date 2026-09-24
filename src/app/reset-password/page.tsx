import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordRequestForm } from "@/components/auth/ResetPasswordRequestForm";

export default async function ResetPasswordPage() {
  const user = await getUser();
  if (user) redirect("/home");

  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a link to set a new one.">
      <ResetPasswordRequestForm />
    </AuthCard>
  );
}
