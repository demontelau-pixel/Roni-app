import Link from "next/link";
import { RoniAvatar } from "@/components/roni/RoniAvatar";
import { Button } from "@/components/ui/Button";

/**
 * Ported from `welcomeScreen()`. M1 has no real accounts yet, so
 * "Create account" / "Sign in" both lead straight into the app with
 * the fixed sample account — a later milestone replaces this with
 * real Supabase auth without changing anything under `(app)/`.
 */
export default function WelcomePage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-between gap-7 px-[18px] py-8 min-[520px]:border-x min-[520px]:border-line">
      <div className="flex items-center gap-2.5 text-2xl font-extrabold tracking-wide">
        <RoniAvatar size={42} />
        RONI
      </div>

      <div className="flex flex-col gap-4">
        <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-tight">
          All your insurance. Made simple.
        </h1>
        <p className="max-w-[32ch] text-lg text-muted">
          Find, compare, understand, buy and manage every policy in one place.
        </p>
        <div className="rounded-2xl bg-soft px-3.5 py-3 text-sm text-primary">
          RONI V0.1 — Next.js migration. Everything you see uses fictional data.
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <Button href="/home" block>
          Continue to RONI
        </Button>
        <Link
          href="/home"
          className="flex w-full items-center justify-center rounded-full border border-line px-5 py-3 text-[15px] font-bold text-ink"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
