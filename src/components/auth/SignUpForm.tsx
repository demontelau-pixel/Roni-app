"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage, safeNext } from "@/lib/auth/errors";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";

interface SignUpFormProps {
  next?: string;
}

/**
 * Calls `supabase.auth.signUp()` with `first_name`/`last_name` in
 * `options.data` — that's exactly what `handle_new_user()`
 * (`supabase/migrations/0001_core_tables.sql`) reads to populate the
 * new `profiles` row, so no separate "create profile" call is needed
 * here.
 *
 * Supabase projects can be configured either way on email
 * confirmation, and this doesn't assume which: if `signUp()` returns
 * an active session, the account is ready immediately and this
 * redirects straight in. If it doesn't (confirmation required), this
 * shows a "check your email" state instead of guessing.
 */
export function SignUpForm({ next }: SignUpFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName || null, last_name: lastName || null },
        emailRedirectTo: `${window.location.origin}${safeNext(next)}`,
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(authErrorMessage(signUpError));
      return;
    }

    if (data.session) {
      router.push(safeNext(next));
      router.refresh();
      return;
    }

    // No session yet — this Supabase project requires confirming the
    // email address before it's usable.
    setAwaitingConfirmation(true);
  }

  if (awaitingConfirmation) {
    return (
      <div className="rounded-2xl bg-soft px-4 py-4 text-primary">
        <p className="font-bold">Check your email</p>
        <p className="mt-1.5 text-sm text-ink">
          We sent a confirmation link to <b>{email}</b>. Open it to finish creating your account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <TextField
          id="first-name"
          label="First name"
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <TextField
          id="last-name"
          label="Last name"
          autoComplete="family-name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
      </div>
      <TextField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextField
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && <p className="rounded-2xl bg-warnbg px-3.5 py-3 text-sm text-warn">{error}</p>}

      <Button type="submit" block disabled={loading}>
        {loading ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={`/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-bold text-primary">
          Sign in
        </Link>
      </p>
    </form>
  );
}
