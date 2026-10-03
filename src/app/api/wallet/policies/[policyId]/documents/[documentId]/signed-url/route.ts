import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";
import { getPolicy, getPolicyDocument } from "@/lib/wallet/repository";

/**
 * Issues a short-lived signed URL for one document, so "View original
 * document" on the Policy Dashboard never needs the bucket to be
 * public (M3.1 spec: "No public storage URLs. Use signed/private
 * access where needed."). Generated fresh per click rather than once
 * at page-render time, so it can't go stale while sitting on a page
 * the person left open.
 *
 * Both `getPolicy` and `getPolicyDocument` (`lib/wallet/repository.ts`)
 * already scope their query to the signed-in user via RLS *and* an
 * explicit `owner_user_id` check — so a request for someone else's
 * policy or document id simply finds nothing (404), never another
 * user's file.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ policyId: string; documentId: string }> }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: { code: "unauthenticated", message: "Please sign in." } }, { status: 401 });
  }

  const { policyId, documentId } = await params;
  const supabase = await createClient();

  const policy = await getPolicy(supabase, policyId);
  if (!policy) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Policy not found." } }, { status: 404 });
  }

  const document = await getPolicyDocument(supabase, documentId);
  if (!document || document.policyId !== policyId) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Document not found." } }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from(document.storageBucket)
    .createSignedUrl(document.storagePath, 60);

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: { code: "signing_failed", message: "Could not open that document right now." } },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, data: { url: data.signedUrl, expiresInSeconds: 60 } });
}
