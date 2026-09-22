import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

interface ComingSoonProps {
  icon: IconName;
  title: string;
  milestone: string;
  description: string;
  children?: ReactNode;
}

/**
 * Placeholder for a screen that exists in the original prototype but
 * is out of scope for M1. Keeping every nav destination reachable
 * (rather than 404ing) is what "navigation works" means for this
 * milestone — the real screen is built when its milestone starts.
 */
export function ComingSoon({ icon, title, milestone, description, children }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-soft text-primary">
        <Icon name={icon} size={28} />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mx-auto mt-2 max-w-[42ch] text-muted">{description}</p>
      </div>
      <span className="rounded-full bg-line px-3.5 py-1.5 text-xs font-bold text-muted">
        Planned for {milestone}
      </span>
      {children}
    </div>
  );
}
