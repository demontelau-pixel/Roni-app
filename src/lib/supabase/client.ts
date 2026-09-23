import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Supabase client for Client Components (the browser).
 *
 * Uses the publishable key (Supabase's current replacement for the
 * older "anon key" — same low privilege level, RLS decides what it
 * can actually reach), which is safe to ship to the browser. This
 * file never reads a secret/service key.
 *
 * Call this once per component that needs it — it's cheap, and the
 * underlying auth session is shared via cookies, not by reusing a
 * single client instance.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
