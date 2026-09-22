"use client";

import { useRouter } from "next/navigation";
import { useAutoQuote } from "@/lib/state/auto-quote-context";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { StepProgress } from "@/components/roni/StepProgress";
import { PriorityPicker } from "@/components/roni/PriorityPicker";

const STEPS = [
  { label: "Vehicle", href: "/market/auto" },
  { label: "Driver", href: "/market/auto/driver" },
  { label: "Priorities", href: "/market/auto/priorities" },
];

/** Ported from "What matters most to you?" (M2 spec §3). */
export default function AutoPrioritiesStep() {
  const router = useRouter();
  const { priorities, togglePriority } = useAutoQuote();

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => router.push("/market/auto/driver")}
        className="inline-flex items-center gap-1 font-bold text-primary"
      >
        <Icon name="chevron" className="rotate-180" size={18} />
        Driver
      </button>

      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight">What matters most to you?</h1>
        <p className="mt-1.5 text-muted">
          Pick as many as you like. RONI never decides for you — your priorities decide the order the
          options appear in.
        </p>
      </div>

      <StepProgress steps={STEPS} currentIndex={2} />

      <PriorityPicker selected={priorities} onToggle={togglePriority} />

      <Button block onClick={() => router.push("/market/auto/results")}>
        See options
      </Button>
    </div>
  );
}
