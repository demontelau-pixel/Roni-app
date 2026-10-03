import "server-only";
import { DevFallbackPolicyQAProvider } from "@/lib/services/policy-qa/dev-fallback-provider";
import type { PolicyQAAnswer, PolicyQAContext, PolicyQAProvider } from "@/lib/services/policy-qa/types";

export type { PolicyQAAnswer, PolicyQACitation, PolicyQAContext, PolicyQAProvider } from "@/lib/services/policy-qa/types";

/** The provider the app currently uses — swap this line, not the callers. */
export const policyQAProvider: PolicyQAProvider = new DevFallbackPolicyQAProvider();

export async function answerPolicyQuestion(context: PolicyQAContext): Promise<PolicyQAAnswer> {
  return policyQAProvider.answer(context);
}
