"use client";

import { useState } from "react";
import { RoniAvatar } from "@/components/roni/RoniAvatar";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import type { PolicyQAAnswer } from "@/lib/services/policy-qa";
import type { PolicyChatTurn } from "@/lib/wallet/types";

interface PolicyAskPanelProps {
  policyId: string;
  initialTurns: PolicyChatTurn[];
}

interface Turn {
  question: string;
  answer?: PolicyQAAnswer;
  error?: string;
}

const SUGGESTIONS = [
  "What's my collision deductible?",
  "Is rental reimbursement included?",
  "What's my premium?",
  "When does this policy expire?",
];

/**
 * Ask Roni Policy Mode (M3.3). A separate, policy-scoped chat from
 * `/ask` (M4, untouched) — every question here is answered only from
 * `policyId`'s own extracted/manually-entered facts, via
 * `POST /api/wallet/policies/[policyId]/ask`.
 */
export function PolicyAskPanel({ policyId, initialTurns }: PolicyAskPanelProps) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>(() => initialTurns.map((turn) => ({ question: turn.question, answer: turn.answer })));
  const [loading, setLoading] = useState(false);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setQuestion("");
    setTurns((prev) => [...prev, { question: trimmed }]);

    try {
      const res = await fetch(`/api/wallet/policies/${policyId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const json = (await res.json()) as { ok: true; data: PolicyQAAnswer } | { ok: false; error: { message?: string } };
      setTurns((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (!last) return prev;
        if (json.ok) {
          next[next.length - 1] = { ...last, answer: json.data };
        } else {
          next[next.length - 1] = { ...last, error: json.error.message ?? "Something went wrong." };
        }
        return next;
      });
    } catch {
      setTurns((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (!last) return prev;
        next[next.length - 1] = { ...last, error: "Something went wrong. Please try again." };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {turns.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void ask(s)}
              className="rounded-full bg-soft px-3 py-1.5 text-xs font-semibold text-primary"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {turns.map((turn, idx) => (
          <div key={idx} className="flex flex-col gap-2">
            <div className="self-end max-w-[88%] rounded-2xl rounded-br-md bg-primary px-3.5 py-3 text-primary-ink">{turn.question}</div>
            <div className="flex items-start gap-2.5">
              <RoniAvatar size={30} />
              <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-soft px-3.5 py-3">
                {turn.answer ? (
                  <>
                    {turn.answer.policyStatement || turn.answer.generalExplanation || turn.answer.notDetermined ? (
                      <div className="flex flex-col gap-2 text-sm">
                        {turn.answer.policyStatement && (
                          <div>
                            <div className="text-xs font-bold uppercase tracking-wide text-muted">What your policy says</div>
                            <p>{turn.answer.policyStatement}</p>
                          </div>
                        )}
                        {turn.answer.generalExplanation && (
                          <div>
                            <div className="text-xs font-bold uppercase tracking-wide text-muted">General explanation</div>
                            <p>{turn.answer.generalExplanation}</p>
                          </div>
                        )}
                        {turn.answer.notDetermined && (
                          <div>
                            <div className="text-xs font-bold uppercase tracking-wide text-muted">What Roni can&apos;t determine</div>
                            <p>{turn.answer.notDetermined}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p>{turn.answer.answerText}</p>
                    )}
                    {turn.answer.citations.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        {turn.answer.citations.map((c, cIdx) => (
                          <div key={cIdx} className="flex flex-wrap items-center gap-1.5">
                            <Tag variant="grey">{c.label}</Tag>
                            {c.verified === true && <Tag variant="good">Verified reference</Tag>}
                            {c.verified === false && <Tag variant="warn">Unverified reference</Tag>}
                            {c.snippet && <span className="text-xs text-muted">“{c.snippet}”</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : turn.error ? (
                  <p className="text-warn">{turn.error}</p>
                ) : (
                  <p className="text-muted">Thinking…</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about this policy…"
          disabled={loading}
          className="w-full rounded-full border border-line bg-surface px-4 py-3 text-[15px] outline-none focus:border-primary"
        />
        <Button type="submit" size="sm" disabled={loading || !question.trim()}>
          Ask
        </Button>
      </form>
    </div>
  );
}
