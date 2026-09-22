import type { ReactNode } from "react";
import { cx } from "@/lib/utils";

interface PanelProps {
  children: ReactNode;
  padded?: boolean;
  className?: string;
}

/** Ported from `.panel` / `.panel.pad`: the rounded card surface used everywhere. */
export function Panel({ children, padded = false, className }: PanelProps) {
  return (
    <div
      className={cx(
        "rounded-[20px] border border-line bg-surface overflow-hidden shadow-[0_1px_2px_rgba(16,34,58,0.05),0_8px_22px_rgba(16,34,58,0.05)]",
        padded && "p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
