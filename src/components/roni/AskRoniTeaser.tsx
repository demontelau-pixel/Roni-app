"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { Chip } from "@/components/ui/Chip";

const SUGGESTIONS = [
  "Am I covered if my car is stolen?",
  "Why is my auto insurance so expensive?",
  "When does my renters policy renew?",
  "Can you compare my current auto policy?",
];

/**
 * Ported from the "Ask Roni" section of `homeScreen()`. The real
 * assistant (Ask Roni, M4) isn't built yet, so submitting a question
 * here just navigates to the `/ask` placeholder with the question
 * attached — it does not fabricate an answer.
 */
export function AskRoniTeaser() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function go(question: string) {
    const q = question.trim();
    if (!q) return;
    router.push(`/ask?q=${encodeURIComponent(q)}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    go(value);
  }

  return (
    <section>
      <h2 className="mb-3 text-xl font-bold tracking-tight">Ask Roni</h2>
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2.5 rounded-[26px] border-2 border-line bg-surface p-1.5 pl-4 shadow-[0_8px_22px_rgba(16,34,58,0.07)] focus-within:border-primary"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask anything about your insurance…"
          aria-label="Ask Roni"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[17px] outline-none"
        />
        <button
          type="submit"
          aria-label="Send"
          className="grid h-12 w-12 flex-none place-items-center rounded-full bg-primary text-primary-ink"
        >
          <Icon name="send" />
        </button>
      </form>
      <div className="mt-3 -mx-[18px] flex gap-2 overflow-x-auto px-[18px] pb-1.5">
        {SUGGESTIONS.map((q) => (
          <Chip key={q} onClick={() => go(q)}>
            {q}
          </Chip>
        ))}
      </div>
    </section>
  );
}
