"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type JobStatus = "queued" | "processing" | "complete" | "failed" | "needs_review";

interface JobStatusPayload {
  status: JobStatus;
  attemptNumber: number;
  startedAt: string | null;
  finishedAt: string | null;
  errorReason: string | null;
}

interface AnalysisStatusProps {
  policyId: string;
  documentId: string;
  /** The job status this page was server-rendered with — used only to decide whether to start polling at all, and as the initial paint before the first client poll lands. */
  initialStatus: JobStatus | null;
  /** Whether the Policy Dashboard below this banner is currently showing a PREVIOUS, already-completed extraction while this new one runs — so the person isn't left thinking the numbers on screen are already the result of the analysis in progress. */
  hasPreviousResult: boolean;
}

const POLL_INTERVAL_MS = 4000;

/**
 * RONI Bloque 1 (corrección), fix #3 — connects the Wallet UI to the
 * REAL analysis job status via the authorized `job-status` endpoint,
 * instead of a fixed "please wait" spinner with nothing behind it. This
 * is necessary now that analysis runs out of band (fix #2): the page
 * that requested analysis (upload, or "Retry") redirects immediately,
 * long before the Vercel Cron worker has actually picked the job up —
 * without this, the person would see the OLD extraction (or nothing)
 * with no indication that a new one is genuinely in progress.
 *
 * Renders NOTHING while there's no active job to show (a `complete` or
 * absent job — the server-rendered dashboard already shows that state
 * correctly) — this component's only job is the small window where
 * `queued`/`processing` is the real, current state.
 *
 * On reaching `complete`/`failed`/`needs_review`, calls
 * `router.refresh()` once — a Server Component re-render of the same
 * page (`[policyId]/page.tsx`), which re-reads the now-current
 * `policy_extracted_data`/evidence rows, so the newly finished result
 * (not the previous one) is what appears, without a full page reload.
 */
export function AnalysisStatus({ policyId, documentId, initialStatus, hasPreviousResult }: AnalysisStatusProps) {
  const router = useRouter();
  const [status, setStatus] = useState<JobStatusPayload | null>(
    initialStatus ? { status: initialStatus, attemptNumber: 1, startedAt: null, finishedAt: null, errorReason: null } : null,
  );
  const hasRefreshedRef = useRef(false);

  const isActive = status?.status === "queued" || status?.status === "processing";

  useEffect(() => {
    if (!isActive) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/wallet/policies/${policyId}/documents/${documentId}/job-status`, { cache: "no-store" });
        const json = (await res.json()) as { ok: true; data: { job: JobStatusPayload | null } } | { ok: false };
        if (cancelled || !json.ok || !json.data.job) return;

        setStatus(json.data.job);

        if (json.data.job.status !== "queued" && json.data.job.status !== "processing" && !hasRefreshedRef.current) {
          hasRefreshedRef.current = true;
          router.refresh();
        }
      } catch {
        // A transient network hiccup while polling — not surfaced as an
        // error; the next tick just tries again.
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    void poll();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isActive, policyId, documentId, router]);

  if (!isActive) return null;

  return (
    <div className="flex items-start gap-2 rounded-2xl bg-soft px-3.5 py-3 text-sm">
      <span className="mt-1 h-2 w-2 flex-none animate-pulse rounded-full bg-primary" />
      <div>
        <div>
          {status?.status === "queued"
            ? "Your policy is queued for analysis…"
            : `Analyzing your policy (attempt ${status?.attemptNumber ?? 1} of 5)…`}
        </div>
        {hasPreviousResult && (
          <div className="mt-0.5 text-xs text-muted">
            The details below are from a previous analysis — they&apos;ll update automatically when this one finishes.
          </div>
        )}
      </div>
    </div>
  );
}
