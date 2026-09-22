import { cx } from "@/lib/utils";

interface Step {
  label: string;
  href: string;
}

interface StepProgressProps {
  steps: Step[];
  currentIndex: number;
}

export function StepProgress({ steps, currentIndex }: StepProgressProps) {
  return (
    <ol className="flex items-center gap-2 text-xs font-bold text-muted">
      {steps.map((step, i) => (
        <li key={step.href} className="flex items-center gap-2">
          <span
            className={cx(
              "grid h-6 w-6 place-items-center rounded-full border",
              i < currentIndex && "border-primary bg-primary text-primary-ink",
              i === currentIndex && "border-primary text-primary",
              i > currentIndex && "border-line text-muted",
            )}
          >
            {i + 1}
          </span>
          <span className={i === currentIndex ? "text-ink" : undefined}>{step.label}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-4 bg-line" />}
        </li>
      ))}
    </ol>
  );
}
