import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/utils";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

/** Ported from `.chip` / `.chip.on`. */
export function Chip({ active = false, className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold flex-none",
        active ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
