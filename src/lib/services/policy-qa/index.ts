import "server-only";
import { AnthropicPolicyQAProvider } from "@/lib/services/policy-qa/anthropic-provider";
import { DevFallbackPolicyQAProvider } from "@/lib/services/policy-qa/dev-fallback-provider";
import { UnavailablePolicyQAProvider } from "@/lib/services/policy-qa/unavailable-provider";
import type { PolicyQAAnswer, PolicyQAContext, PolicyQAProvider } from "@/lib/services/policy-qa/types";

export type { PolicyQAAnswer, PolicyQACitation, PolicyQAContext, PolicyQAProvider } from "@/lib/services/policy-qa/types";

/**
 * Production defaults to the real document-backed provider when its server
 * key is configured. The deterministic fallback remains opt-in for local
 * development only and is never the default presented as Ask Roni.
 */
function selectProvider(): PolicyQAProvider {
  if (process.env.POLICY_QA_PROVIDER?.trim().toLowerCase() === "dev-fallback") return new DevFallbackPolicyQAProvider();
  if (process.env.ANTHROPIC_API_KEY?.trim()) return new AnthropicPolicyQAProvider();
  return new UnavailablePolicyQAProvider();
}

export const policyQAProvider: PolicyQAProvider = selectProvider();

export async function answerPolicyQuestion(context: PolicyQAContext): Promise<PolicyQAAnswer> {
  return policyQAProvider.answer(context);
}
