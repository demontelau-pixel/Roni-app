"use client";

import { useState } from "react";
import type { InsuranceOption } from "@/lib/types";
import { SCRIPTED_QUESTIONS, answerScriptedQuestion } from "@/lib/logic/ask-roni-scripted";
import { RoniAvatar } from "@/components/roni/RoniAvatar";
import { Chip } from "@/components/ui/Chip";

interface OptionAskRoniProps {
  option: InsuranceOption;
  allOptions: InsuranceOption[];
  /** When set (e.g. from the comparison screen), answers are framed against this option specifically. */
  against?: InsuranceOption;
}

/**
 * Ask Roni, scoped to one quote (M2 spec §9). Answers are computed by
 * `answerScriptedQuestion` purely from the fictional catalog already
 * on screen — there is no AI call here.
 */
export function OptionAskRoni({ option, allOptions, against }: OptionAskRoniProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  function ask(id: string) {
    if (answers[id]) return;
    setAnswers((prev) => ({ ...prev, [id]: answerScriptedQuestion(id, option, allOptions, against) }));
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
        <RoniAvatar size={24} />
        Ask Roni about this option
      </div>
      <div className="flex flex-wrap gap-2">
        {SCRIPTED_QUESTIONS.map((q) => (
          <Chip key={q.id} onClick={() => ask(q.id)} active={Boolean(answers[q.id])}>
            {q.label}
          </Chip>
        ))}
      </div>
      {Object.entries(answers).length > 0 && (
        <div className="mt-3 space-y-2.5">
          {SCRIPTED_QUESTIONS.filter((q) => answers[q.id]).map((q) => (
            <div key={q.id} className="rounded-xl bg-bg p-3 text-sm">
              <div className="mb-1 font-bold text-muted">{q.label}</div>
              <div>{answers[q.id]}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
