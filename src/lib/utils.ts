/**
 * Small, dependency-free formatting helpers shared by components.
 * Kept separate from `lib/data` (fictional content) and from
 * `lib/state` (application state) on purpose — see the README for the
 * intended UI → logic → data layering.
 */

export function formatMoney(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

/** Same as `formatMoney`, but for a value CMS might not have returned — never invents a number. */
export function formatMoneyOrUnavailable(amount: number | null): string {
  return amount === null ? "Not available" : formatMoney(amount);
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Days remaining until an ISO date, relative to `now`.
 *
 * `now` defaults to the real current time so the deployed app always
 * shows a correct, live countdown. Callers (tests, storybook-style
 * previews) can pass a fixed `now` to get deterministic output.
 */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const target = new Date(`${iso}T00:00:00Z`);
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((target.getTime() - today.getTime()) / msPerDay);
}

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
