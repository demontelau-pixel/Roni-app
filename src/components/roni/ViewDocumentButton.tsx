"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface ViewDocumentButtonProps {
  policyId: string;
  documentId: string;
}

/**
 * "View original document" (M3.1–M3.4 brief, Policy Dashboard
 * "Actions"). Fetches a fresh, short-lived signed URL on click rather
 * than embedding one at render time, so it can't go stale on a page
 * left open (see the signed-url route's doc comment).
 */
export function ViewDocumentButton({ policyId, documentId }: ViewDocumentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/wallet/policies/${policyId}/documents/${documentId}/signed-url`);
      const json = (await res.json()) as { ok: true; data: { url: string } } | { ok: false; error: { message?: string } };
      if (!json.ok) {
        setError(json.error.message ?? "Could not open that document.");
        return;
      }
      window.open(json.data.url, "_blank", "noopener,noreferrer");
    } catch {
      setError("Could not open that document.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? "Opening…" : "View original document"}
      </Button>
      {error && <p className="mt-1.5 text-xs text-warn">{error}</p>}
    </div>
  );
}
