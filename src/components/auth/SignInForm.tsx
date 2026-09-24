"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage, safeNext } from "@/lib/auth/errors";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";

interface SignInFormProps {
  next?: string;
}

export function SignInForm({ next }: SignInFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (signInError) {
      setError(authErrorMessage(signInError));
      return;
    }

    router.push(safeNext(next));
    router.refresh();
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
      <TextField
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && <p className="rounded-2xl bg-warnbg px-3.5 py-3 text-sm text-warn">{error}</p>}

      <div className="text-right">
        <Link href="/reset-password" className="text-sm font-bold text-primary">
          Forgot your password?
        </Link>
      </div>

      <Button type="submit" block disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted">
        New to RONI?{" "}
        <Link href={`/sign-up${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-bold text-primary">
          Create an account
        </Link>
      </p>
    </form>
  );
}
