"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { getPolicy, saveExtractedPolicyData, updatePolicy } from "@/lib/wallet/repository";
import { parseManualAutoPolicyFacts } from "@/lib/wallet/manual-facts-form";
import { AUTO_POLICY_SCHEMA_VERSION } from "@/lib/wallet/schemas/auto-policy";
import { sanitizeAutoPolicyFacts } from "@/lib/wallet/validate-auto-policy-facts";

/**
 * Saves the manual-entry form (M3.1–M3.4 "DEVELOPMENT FALLBACK": when
 * automatic extraction can't determine something, RONI lets the
 * person tell it directly rather than guessing). Stored with
 * `extractedBy: "manual"` and `extractionStatus: "complete"` — this
 * is a real, current set of facts, just sourced from the person
 * rather than a document; it is never labeled or cited as if the
 * document said it (see `lib/services/policy-qa/dev-fallback-provider.ts`'s
 * "You told RONI this" citation for exactly this distinction).
 *
 * A Server Action (not an API route) because this form is submitted
 * from a Server Component page with no other client-side need — see
 * `/wallet/[policyId]/facts/page.tsx`.
 */
export async function saveManualAutoFacts(policyId: string, formData: FormData): Promise<void> {
  const user = await requireUser(`/wallet/${policyId}/facts`);
  void user;

  const supabase = await createClient();
  const policy = await getPolicy(supabase, policyId);
  if (!policy) {
    redirect("/wallet");
  }

  const facts = sanitizeAutoPolicyFacts(parseManualAutoPolicyFacts(formData));

  await saveExtractedPolicyData(supabase, {
    policyId,
    documentId: null,
    category: "auto",
    schemaVersion: AUTO_POLICY_SCHEMA_VERSION,
    data: facts,
    extractionStatus: "complete",
    extractedBy: "manual",
    overallConfidence: null,
  });

  // Keep the policy row's own summary columns (used by the Wallet
  // list, `getPolicies`) roughly in sync with what the person just
  // told RONI, so the list view doesn't show stale/blank carrier and
  // premium info while the dashboard shows the real thing.
  await updatePolicy(supabase, policyId, {
    carrier: facts.policy.carrier,
    policyNumber: facts.policy.policyNumber,
    status: facts.policy.status ?? "unknown",
    effectiveDate: facts.policy.effectiveDate,
    expirationDate: facts.policy.expirationDate,
    premiumAmount: facts.policy.premiumAmount,
    premiumFrequency: facts.policy.premiumFrequency,
    termPremium: facts.policy.termPremium,
    state: facts.policy.state,
  });

  redirect(`/wallet/${policyId}`);
}
