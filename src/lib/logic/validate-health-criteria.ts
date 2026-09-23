import type { HealthMember, HealthQuoteError, HealthSearchCriteria } from "@/lib/types";

/**
 * Minimal, dependency-free shape validation for what the client sends
 * to `/api/health/*`. Rejects anything that isn't at least
 * structurally sound before it reaches the CMS client — CMS itself
 * still validates the actual values (a bad ZIP, an invalid county).
 *
 * CORRECTION (post-M2.5): now also validates `household.additionalMembers`,
 * a real per-person list, instead of the old `household.size` count
 * that was never actually sent to CMS.
 */
export function validateHealthSearchCriteria(body: unknown): { ok: true; data: HealthSearchCriteria } | { ok: false; error: HealthQuoteError } {
  const invalid = (message: string) => ({ ok: false as const, error: { code: "invalid_request" as const, message } });

  if (!body || typeof body !== "object") return invalid("Missing request body.");
  const b = body as Record<string, unknown>;

  const location = b.location as Record<string, unknown> | undefined;
  if (!location || typeof location.zip !== "string" || !location.zip) return invalid("A ZIP code is required.");
  if (typeof location.countyfips !== "string" || !location.countyfips) return invalid("A county is required.");
  if (typeof location.state !== "string" || !location.state) return invalid("A state is required.");

  if (typeof b.year !== "number" || !Number.isInteger(b.year)) return invalid("A coverage year is required.");

  const applicant = b.applicant as Record<string, unknown> | undefined;
  if (!applicant || (!applicant.age && !applicant.dob)) return invalid("An age or date of birth is required.");

  const household = (b.household as Record<string, unknown> | undefined) ?? {};
  const rawMembers = Array.isArray(household.additionalMembers) ? household.additionalMembers : [];

  const additionalMembers: HealthMember[] = [];
  for (const raw of rawMembers) {
    if (!raw || typeof raw !== "object") return invalid("A household member is missing required information.");
    const m = raw as Record<string, unknown>;
    const age = typeof m.age === "string" ? m.age : "";
    const dob = typeof m.dob === "string" ? m.dob : "";
    const usesTobacco = m.usesTobacco === "yes" || m.usesTobacco === "no" ? m.usesTobacco : "";
    if (!age && !dob) return invalid("Every household member needs an age or date of birth.");
    if (!usesTobacco) return invalid("Every household member needs a tobacco-use answer.");
    additionalMembers.push({
      id: typeof m.id === "string" ? m.id : String(additionalMembers.length),
      age,
      dob,
      gender: m.gender === "Male" || m.gender === "Female" ? m.gender : "",
      usesTobacco,
    });
  }

  return {
    ok: true,
    data: {
      location: {
        zip: String(location.zip),
        countyfips: String(location.countyfips),
        state: String(location.state),
      },
      year: b.year,
      applicant: {
        age: typeof applicant.age === "string" ? applicant.age : "",
        dob: typeof applicant.dob === "string" ? applicant.dob : "",
        gender: applicant.gender === "Male" || applicant.gender === "Female" ? applicant.gender : "",
        usesTobacco: applicant.usesTobacco === "yes" || applicant.usesTobacco === "no" ? applicant.usesTobacco : "",
      },
      household: {
        income: typeof household.income === "string" ? household.income : "",
        additionalMembers,
      },
    },
  };
}
