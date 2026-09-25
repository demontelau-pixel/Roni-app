import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";
import type { User } from "@supabase/supabase-js";

/**
 * The real, authenticated user's display identity — never the
 * fictional `SAMPLE_USER` (`lib/data/user.ts`). Any field RONI
 * genuinely doesn't know is `null`; callers decide their own neutral
 * fallback text (Home falls back to the demo name only when there's
 * no signed-in user at all; Profile falls back to "there").
 */
export interface AuthenticatedIdentity {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

function pickName(profileValue: string | null | undefined, metadataValue: unknown): string | null {
  if (profileValue && profileValue.trim()) return profileValue;
  if (typeof metadataValue === "string" && metadataValue.trim()) return metadataValue;
  return null;
}

/**
 * Priority, per the M3 Auth follow-up fix:
 *   1. `profiles.first_name` / `profiles.last_name` — the source of
 *      truth once set.
 *   2. `user.user_metadata.first_name` / `.last_name` — what
 *      `SignUpForm` passed as `options.data` at sign-up time. Falling
 *      back to this covers a real, observed case: the
 *      `handle_new_user` trigger (`supabase/migrations/0001_core_tables.sql`)
 *      can run before that metadata is attached to the `auth.users`
 *      row, leaving `profiles.first_name` null even though the name
 *      the person actually typed is sitting right there on their
 *      session.
 *   3. `null` — callers show a neutral fallback ("there"), never the
 *      fictional demo name.
 *
 * Takes an already-fetched `user` (from `getUser()`/`requireUser()`)
 * rather than fetching one itself, so a caller that already has one
 * (like Profile, via `requireUser()`) doesn't pay for a second,
 * redundant auth check.
 */
export async function resolveIdentity(user: User): Promise<AuthenticatedIdentity> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const profile = data as {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;

  return {
    firstName: pickName(profile?.first_name, user.user_metadata?.first_name),
    lastName: pickName(profile?.last_name, user.user_metadata?.last_name),
    email: profile?.email ?? user.email ?? null,
  };
}

/** Same as `resolveIdentity`, but for callers (like Home) that don't already know whether anyone is signed in. Returns `null` when nobody is. */
export async function getCurrentIdentity(): Promise<AuthenticatedIdentity | null> {
  const user = await getUser();
  if (!user) return null;
  return resolveIdentity(user);
}
