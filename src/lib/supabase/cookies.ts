import type { CookieOptions } from "@supabase/ssr";

/**
 * The exact shape `@supabase/ssr` passes to a `cookies.setAll(...)`
 * callback: an array of cookies it wants written, each with the
 * standard cookie attributes (`path`, `maxAge`, `sameSite`, etc.) in
 * `options`.
 *
 * WHY THIS FILE EXISTS: `createServerClient(...)`'s `cookies.setAll`
 * parameter is normally contextually typed by TypeScript from the
 * call itself, and every official Supabase example writes
 * `setAll(cookiesToSet) { ... }` with no explicit annotation, relying
 * on that inference. In this project that inference did not reliably
 * reach the callback parameter — `cookiesToSet` kept resolving to
 * implicit `any` in `next build`'s stricter checking, even though a
 * local editor might show no error. Two contributing factors, found
 * by auditing every call site:
 *
 *   1. `src/middleware.ts` originally called `createServerClient(...)`
 *      with NO generic type argument at all, so there was nothing for
 *      TypeScript to key the callback's inferred type off of.
 *   2. `@supabase/ssr`'s own changelog (0.7.0) lists "remove usage of
 *      internal type params" — a real change to how this package
 *      exposes its generics between versions, which is exactly the
 *      kind of change that can make previously-working contextual
 *      inference for this specific callback stop resolving, entirely
 *      independent of anything in this codebase.
 *
 * Rather than re-guess at what inference happens to produce on
 * whichever `@supabase/ssr` version is actually installed, every file
 * that implements `setAll` now imports `CookieToSet` from here and
 * annotates the parameter explicitly: `setAll(cookiesToSet: CookieToSet[])`.
 * This can't go implicit-`any` regardless of how the library's own
 * generics resolve, and it only needs to be correct in one place.
 */
export interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}
