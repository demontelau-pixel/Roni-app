import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";
import {
  getEffectiveAutoPolicyFacts,
  getExtractionEvidence,
  getPolicy,
  getPolicyDocumentBytes,
  getPolicyDocuments,
  savePolicyChatTurn,
} from "@/lib/wallet/repository";
import { emptyAutoPolicyFacts } from "@/lib/wallet/schemas/auto-policy";
import { annotateAutoPolicyFacts } from "@/lib/wallet/annotate";
import { answerPolicyQuestion } from "@/lib/services/policy-qa";
import { documentTextExtractor } from "@/lib/services/document-text";

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
  if (typeof question !== "string" || question.trim().length === 0 || question.trim().length > 1_000) {
    return NextResponse.json({ ok: false, error: { code: "missing_question", message: "Please ask a question." } }, { status: 400 });
  }

  const { policyId } = await params;
  const supabase = await createClient();

  const policy = await getPolicy(supabase, policyId);
  if (!policy) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Policy not found." } }, { status: 404 });
  }

  const documents = await getPolicyDocuments(supabase, policyId);
  const selectedDocument = documents[0] ?? null;
  if (!selectedDocument) {
    return NextResponse.json(
      { ok: false, error: { code: "no_document", message: "This policy does not have a document to ask about." } },
      { status: 409 },
    );
  }

  let documentBytes: Awaited<ReturnType<typeof getPolicyDocumentBytes>>;
  try {
    documentBytes = await getPolicyDocumentBytes(supabase, selectedDocument.id);
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "document_unavailable", message: "RONI could not read this policy document. Please try again." } },
      { status: 502 },
    );
  }
  if (!documentBytes || documentBytes.document.policyId !== policyId) {
    // The second check keeps the document-policy relationship explicit even
    // though getPolicyDocuments is already RLS-scoped to this policy.
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Policy document not found." } }, { status: 404 });
  }

  let pageCount: number | null = null;
  let pages: Array<{ pageNumber: number; text: string }> = [];
  try {
    const text = await documentTextExtractor.extractText({ fileBytes: documentBytes.bytes, mimeType: documentBytes.document.mimeType });
    if (text.status === "success") {
      pageCount = text.pages.length;
      pages = text.pages.map((page) => ({ pageNumber: page.pageNumber, text: page.text }));
    }
  } catch {
    // A scan or malformed text layer must not prevent the real PDF-native
    // provider from answering; it merely means page numbers can't be bounded
    // independently before the provider response is sanitized.
    pageCount = null;
  }

  const latest = await getEffectiveAutoPolicyFacts(supabase, policyId);
  const facts = latest?.data ?? emptyAutoPolicyFacts();
  const evidence = latest ? await getExtractionEvidence(supabase, latest.id) : [];
  const annotated = annotateAutoPolicyFacts(facts, evidence);

  const answer = await answerPolicyQuestion({
    policyId,
    facts: annotated,
    carrierLabel: policy.carrier ?? facts.policy.carrier,
    question: question.trim(),
    document: {
      bytes: documentBytes.bytes,
      mimeType: documentBytes.document.mimeType,
      originalFilename: documentBytes.document.originalFilename,
      pageCount,
      pages,
    },
  });

  try {
    await savePolicyChatTurn(supabase, { policyId, question: question.trim(), answer });
  } catch {
    // The answer must not be reported as successfully delivered if its
    // promised private history could not be saved.
    return NextResponse.json(
      { ok: false, error: { code: "conversation_save_failed", message: "RONI could not save this conversation. Please try again." } },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, data: answer });
}
