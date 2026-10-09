import "server-only";
import type { PolicyQAAnswer, PolicyQAProvider } from "@/lib/services/policy-qa/types";

/**
 * Honest safe state used until a real AI provider is configured. It never
 * pattern-matches a question or presents a scripted answer as AI.
 */
export class UnavailablePolicyQAProvider implements PolicyQAProvider {
  readonly id = "unavailable:not-configured";

  async answer(): Promise<PolicyQAAnswer> {
    const message = "Ask Roni is not available until the AI service is configured. Please review the policy document or contact your insurer.";
    return {
      answerText: message,
      policyStatement: null,
      generalExplanation: null,
      notDetermined: message,
      citations: [],
      grounded: false,
    };
  }
}
