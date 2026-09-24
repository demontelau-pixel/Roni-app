"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";

export function ResetPasswordRequestForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password/confirm`,
    });

    setLoading(false);

    // Always show the same success state regardless of whether the
    // email matches an account — Supabase doesn't reveal that either
    // way, and this avoids leaking who has a RONI account.
    if (resetError) {
      setError(authErrorMessage(resetError));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-2xl bg-soft px-4 py-4 text-primary">
        <p className="font-bold">Check your email</p>
        <p className="mt-1.5 text-sm text-ink">
          If an account exists for <b>{email}</b>, we&rsquo;ve sent a link to reset the password.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {error && <p className="rounded-2xl bg-warnbg px-3.5 py-3 text-sm text-warn">{error}</p>}

      <Button type="submit" block disabled={loading}>
        {loading ? "Sending…" : "Send reset link"}
      </Button>

      <p className="text-center text-sm text-muted">
        <Link href="/sign-in" className="font-bold text-primary">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
