/**
 * FICTIONAL SAMPLE DATA — not a real user.
 *
 * M1 has no authentication yet, so there is exactly one demo account,
 * held in memory. A later milestone replaces this with a real signed-in
 * user coming from Supabase; nothing in `components/` should need to
 * change shape when that happens, only where this value comes from.
 */
export interface SampleUser {
  firstName: string;
  lastName: string;
  email: string;
}

export const SAMPLE_USER: SampleUser = {
  firstName: "Alex",
  lastName: "Rivera",
  email: "alex@example.com",
};

export function sampleUserFullName(user: SampleUser = SAMPLE_USER): string {
  return `${user.firstName} ${user.lastName}`.trim();
}
