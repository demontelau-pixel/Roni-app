import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Reusable auth foundation for M3.1+ (M3.0 §8). Nothing in the app
 * calls these yet — Marketplace, Home, Ask Roni and the current
 * Wallet placeholder stay exactly as they are. This exists so a
 * future `/wallet` page can protect itself with two lines:
 *
 *   const user = await requireUser("/wallet");
 *   // `user` is guaranteed non-null below this line
 *
 * `requireUser` redirects to `/sign-in` (a page M3.0 does not build)
 * if there's no signed-in user — wiring that page up, and calling
 * this from real Wallet routes, is explicitly out of scope here.
 */

export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser(redirectTo: string = "/"): Promise<User> {
  const user = await getUser();
  if (!user) {
    const next = encodeURIComponent(redirectTo);
    redirect(`/sign-in?next=${next}`);
  }
  return user;
}
