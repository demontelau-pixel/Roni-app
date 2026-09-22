import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/utils";

type Variant = "primary" | "ghost" | "soft" | "sun";
type Size = "md" | "sm";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-primary text-primary-ink",
  ghost: "bg-transparent border border-line text-ink",
  soft: "bg-soft text-primary",
  sun: "bg-sun text-deep",
};

const SIZE_CLASSES: Record<Size, string> = {
  md: "px-5 py-3 min-h-12 text-[15px]",
  sm: "px-3.5 py-2 min-h-[38px] text-sm",
};

interface SharedProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  children: ReactNode;
  className?: string;
}

interface ButtonAsButton
  extends SharedProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof SharedProps> {
  href?: undefined;
}

interface ButtonAsLink extends SharedProps {
  href: string;
}

type ButtonProps = ButtonAsButton | ButtonAsLink;

/**
 * Ported from the prototype's `.btn` family of classes. Renders a
 * `<Link>` when `href` is given (for navigation) or a `<button>`
 * otherwise (for in-page actions).
 */
export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    block = false,
    children,
    className,
  } = props;

  const classes = cx(
    "inline-flex items-center justify-center gap-2 rounded-full font-bold text-center transition-opacity active:opacity-80 disabled:opacity-40 disabled:pointer-events-none",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    block && "flex w-full",
    className,
  );

  if ("href" in props && props.href !== undefined) {
    return (
      <Link href={props.href} className={classes}>
        {children}
      </Link>
    );
  }

  const { href: _href, ...buttonRest } = props as ButtonAsButton;
  void _href;
  return (
    <button className={classes} {...buttonRest}>
      {children}
    </button>
  );
}
