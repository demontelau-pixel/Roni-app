"use client";

import type { PriorityKey } from "@/lib/types";
import { PRIORITY_LABELS } from "@/lib/logic/rank-options";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";

const ORDER: PriorityKey[] = ["price", "coverage", "deductible", "benefits"];

interface PriorityPickerProps {
  selected: PriorityKey[];
  onToggle: (key: PriorityKey) => void;
}

export function PriorityPicker({ selected, onToggle }: PriorityPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {ORDER.map((key) => {
        const active = selected.includes(key);
        return (
          <Chip key={key} active={active} aria-pressed={active} onClick={() => onToggle(key)}>
            {active && <Icon name="check" size={16} />}
            {PRIORITY_LABELS[key]}
          </Chip>
        );
      })}
    </div>
  );
}
