import type { ReactNode } from "react";
import { cx } from "@/lib/utils";

type TagVariant = "default" | "grey" | "good" | "warn";

const VARIANT_CLASSES: Record<TagVariant, string> = {
  default: "bg-soft text-primary",
  grey: "bg-line text-muted",
  good: "bg-goodbg text-good",
  warn: "bg-warnbg text-warn",
};

interface TagProps {
  children: ReactNode;
  variant?: TagVariant;
  icon?: ReactNode;
  className?: string;
}

export function Tag({ children, variant = "default", icon, className }: TagProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
