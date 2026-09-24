import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/errors";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignInForm } from "@/components/auth/SignInForm";

interface SignInPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { next } = await searchParams;

  const user = await getUser();
  if (user) redirect(safeNext(next));

  return (
    <AuthCard title="Welcome back">
      <SignInForm next={next} />
    </AuthCard>
  );
}
