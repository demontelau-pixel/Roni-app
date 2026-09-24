"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";

type ReadyState = "checking" | "ready" | "invalid";

/**
 * The link Supabase emails from `resetPasswordForEmail` lands here
 * with a recovery token in the URL, which `@supabase/ssr`'s browser
 * client picks up automatically and turns into a short-lived session
 * — that's what `onAuthStateChange`'s `PASSWORD_RECOVERY` event (or an
 * already-present user on mount, in case the event fired before this
 * listener attached) confirms below, before showing the form.
 */
export function UpdatePasswordForm() {
  const router = useRouter();
  const [state, setState] = useState<ReadyState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!settled && user) {
        settled = true;
        setState("ready");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        settled = true;
        setState("ready");
      }
    });

    const timer = setTimeout(() => {
      if (!settled) setState("invalid");
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Those passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(authErrorMessage(updateError));
      return;
    }

    router.push("/home");
    router.refresh();
  }

  if (state === "checking") {
    return <p className="text-muted">Checking your link…</p>;
  }

  if (state === "invalid") {
    return (
      <div className="rounded-2xl bg-warnbg px-4 py-4 text-warn">
        <p className="font-bold">This link isn&rsquo;t valid anymore</p>
        <p className="mt-1.5 text-sm">Password reset links expire after a while. Request a new one from the sign-in page.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField
        id="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <TextField
        id="confirm-password"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        required
        minLength={6}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />

      {error && <p className="rounded-2xl bg-warnbg px-3.5 py-3 text-sm text-warn">{error}</p>}

      <Button type="submit" block disabled={loading}>
        {loading ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
