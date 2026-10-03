"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { Icon } from "@/components/ui/Icon";
import { validatePolicyDocumentFile } from "@/lib/wallet/upload-validation";
import { createClient } from "@/lib/supabase/client";

type UploadPhase = "idle" | "uploading" | "processing" | "error";

/**
 * RONI Bloque 1 (corrección) — the upload UI now does three requests
 * instead of one, matching fix #1/#2's server-side split:
 *
 *   1. `POST /api/wallet/policies` — tiny JSON body (name/type/size
 *      only, never the file) — creates the policy + document records
 *      and returns a short-lived Supabase Storage signed-upload target
 *      for a server-chosen path.
 *   2. The browser's OWN Supabase client uploads the actual file bytes
 *      DIRECTLY to Storage via that signed URL — those bytes never
 *      transit a Vercel function at all, which is the actual fix for
 *      "PDFs de 15 MB enviados por una función con límite de 4.5 MB."
 *   3. `POST /api/wallet/policies/{policyId}/documents/{documentId}/analyze`
 *      — sends only the two ids, never the file again — and triggers
 *      the durable job-runner server-side.
 *
 * `"uploading"` now covers step 2 (the real file transfer, direct to
 * Storage) and `"processing"` covers step 3 (the server running
 * extraction) — these were already separate concepts before this fix,
 * but previously mapped onto a single request; now they're two.
 */
export function UploadPolicyForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    const validation = validatePolicyDocumentFile(file);
    if (!validation.ok) {
      setError(validation.reason ?? "That file can't be uploaded.");
      return;
    }

    setError(null);
    setFileName(file.name);

    try {
      // Step 1: ask the server for an upload target. Only the file's
      // name/type/size are sent here — never its bytes.
      setPhase("uploading");
      const prepareRes = await fetch("/api/wallet/policies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, mimeType: file.type, fileSize: file.size }),
      });
      const prepared = (await prepareRes.json()) as
        | { ok: true; data: { policyId: string; documentId: string; storagePath: string; uploadToken: string } }
        | { ok: false; error: { message?: string } };

      if (!prepared.ok) {
        setError(prepared.error.message ?? "Something went wrong. Please try again.");
        setPhase("error");
        return;
      }

      const { policyId, documentId, storagePath, uploadToken } = prepared.data;

      // Step 2: upload the actual bytes directly to private Storage,
      // using the signed, single-use token from step 1 — this request
      // goes straight to Supabase, not through any Vercel function.
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("policy-documents")
        .uploadToSignedUrl(storagePath, uploadToken, file, { contentType: file.type });

      if (uploadError) {
        setError("Something went wrong while uploading your file. Please check your connection and try again.");
        setPhase("error");
        return;
      }

      // Step 3: tell the server which document to analyze — only the
      // ids, never the file again. RONI Bloque 1 (corrección), fix #2:
      // this no longer runs the analysis itself and no longer blocks on
      // it — it just records a `queued` job and returns immediately.
      // The actual analysis runs later, out of band, when the Vercel
      // Cron worker next fires (`app/api/cron/process-analysis-jobs/route.ts`).
      // Either way (queued successfully, already in progress, or even a
      // failure to queue) the person's document is already safely
      // stored, so we route them to the Policy Dashboard regardless —
      // `AnalysisStatus.tsx` there is what shows the real, live
      // progress of the job this call just created, not this form.
      setPhase("processing");
      await fetch(`/api/wallet/policies/${policyId}/documents/${documentId}/analyze`, { method: "POST" }).catch(() => {
        // A network failure queuing analysis doesn't strand the
        // person — they land on the Policy Dashboard either way, which
        // offers "Retry analysis" if nothing ever got queued.
      });

      router.push(`/wallet/${policyId}`);
    } catch {
      setError("Something went wrong while uploading. Please check your connection and try again.");
      setPhase("error");
    }
  }

  const busy = phase === "uploading" || phase === "processing";

  return (
    <Panel padded className="flex flex-col gap-4">
      <label
        htmlFor="policy-file"
        className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line px-4 py-10 text-center cursor-pointer hover:border-primary transition-colors"
      >
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-soft text-primary">
          <Icon name="upload" size={26} />
        </div>
        <div>
          <div className="font-bold">{fileName ?? "Choose a PDF to upload"}</div>
          <div className="mt-1 text-sm text-muted">Auto insurance policy, PDF only, up to 15 MB.</div>
        </div>
        <input
          ref={inputRef}
          id="policy-file"
          type="file"
          accept="application/pdf"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </label>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl bg-warnbg px-3.5 py-3 text-sm text-warn">
          <Icon name="alert" size={18} className="mt-0.5 flex-none" />
          <span>{error}</span>
        </div>
      )}

      {busy && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          {phase === "uploading" ? "Uploading your policy…" : "Queuing your policy for analysis…"}
        </div>
      )}

      <Button
        type="button"
        block
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Please wait…" : "Select a PDF"}
      </Button>

      {/*
        RONI Bloque 1 (corrección), fix #4 — the previous copy here said
        "is never shared," which was misleading: this document IS sent
        to RONI's AI provider (Anthropic) so it can be read and
        interpreted. Storage itself is private (only this account can
        read the stored file), but "never shared" and "sent to an AI
        provider to interpret it" are two different claims, and the
        person should know the second one BEFORE they upload, not
        discover it later.
      */}
      <p className="text-xs text-muted">
        Your document is stored privately in your account. To read and interpret it, RONI sends it to our AI
        provider (Anthropic) — it is not shared publicly or with other people. RONI does not yet read every
        policy layout automatically — you can always add or correct details by hand after uploading.
      </p>
    </Panel>
  );
}
