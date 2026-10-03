import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";
import { getEffectiveAutoPolicyFacts, getExtractionEvidence, getPolicy } from "@/lib/wallet/repository";
import { emptyAutoPolicyFacts } from "@/lib/wallet/schemas/auto-policy";
import { annotateAutoPolicyFacts } from "@/lib/wallet/annotate";
import { answerPolicyQuestion } from "@/lib/services/policy-qa";

/**
 * "Ask Roni about this policy" (M3.3). Every answer is grounded in
 * this ONE policy's extracted/manually-entered facts and their
 * evidence — never generic memory (brief principle 6) — which is why
 * this route, not a general chat endpoint, exists: `policyId` fixes
 * the context before the question is even read.
 */
export async function POST(request: Request, { params }: { params: Promise<{ policyId: string }> }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: { code: "unauthenticated", message: "Please sign in." } }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: "invalid_request", message: "Invalid request body." } }, { status: 400 });
  }
  const question = typeof body === "object" && body !== null && "question" in body ? (body as { question: unknown }).question : undefined;
  if (typeof question !== "string" || question.trim().length === 0) {
    return NextResponse.json({ ok: false, error: { code: "missing_question", message: "Please ask a question." } }, { status: 400 });
  }

  const { policyId } = await params;
  const supabase = await createClient();

  const policy = await getPolicy(supabase, policyId);
  if (!policy) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Policy not found." } }, { status: 404 });
  }

  const latest = await getEffectiveAutoPolicyFacts(supabase, policyId);
  const facts = latest?.data ?? emptyAutoPolicyFacts();
  const evidence = latest ? await getExtractionEvidence(supabase, latest.id) : [];
  const annotated = annotateAutoPolicyFacts(facts, evidence);

  const answer = await answerPolicyQuestion({
    policyId,
    facts: annotated,
    carrierLabel: policy.carrier ?? facts.policy.carrier,
    question,
  });

  return NextResponse.json({ ok: true, data: answer });
}
