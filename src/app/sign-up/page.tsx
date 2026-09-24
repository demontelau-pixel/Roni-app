import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/errors";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignUpForm } from "@/components/auth/SignUpForm";

interface SignUpPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { next } = await searchParams;

  // Already signed in? Don't show a sign-up form — go straight where
  // they were headed.
  const user = await getUser();
  if (user) redirect(safeNext(next));

  return (
    <AuthCard title="Create your account" subtitle="Find, compare, understand, buy and manage every policy in one place.">
      <SignUpForm next={next} />
    </AuthCard>
  );
}
