/**
 * Plain helpers for the auth forms. No Supabase client here and no
 * `server-only` — these run in Client Components.
 */

/** Supabase's own `AuthError.message` strings, mapped to RONI's voice. Anything not listed falls back to the original message, never hidden. */
const FRIENDLY_MESSAGES: Array<[string, string]> = [
  ["Invalid login credentials", "That email or password doesn't match an account. Double-check them, or reset your password below."],
  ["Email not confirmed", "Please confirm your email first — check your inbox for the link we sent you."],
  ["User already registered", "An account with that email already exists. Try signing in instead."],
  ["Password should be at least", "Choose a longer password — at least 6 characters."],
  ["Unable to validate email address", "That doesn't look like a valid email address."],
  ["New password should be different", "Choose a password you haven't used before on this account."],
  ["For security purposes", "You've tried this a few times — please wait a moment before trying again."],
];

export function authErrorMessage(error: { message: string } | null | undefined): string | null {
  if (!error) return null;
  const match = FRIENDLY_MESSAGES.find(([needle]) => error.message.includes(needle));
  return match ? match[1] : error.message;
}

/**
 * Only ever redirect after auth to a same-site, relative path — never
 * whatever a `?next=` query parameter happens to contain verbatim.
 * `//evil.com` and `https://evil.com` are both rejected (the former is
 * a protocol-relative URL, a classic open-redirect trick); anything
 * that doesn't start with exactly one `/` is rejected too.
 */
export function safeNext(next: string | null | undefined, fallback: string = "/home"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
