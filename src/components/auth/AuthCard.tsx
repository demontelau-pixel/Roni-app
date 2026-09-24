import type { ReactNode } from "react";
import { RoniAvatar } from "@/components/roni/RoniAvatar";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Ported from the Welcome page's container (`src/app/page.tsx`) so
 * every auth screen shares the same brand header and page shape,
 * without duplicating that markup four times.
 */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-7 px-[18px] py-8 min-[520px]:border-x min-[520px]:border-line">
      <div className="flex items-center gap-2.5 text-2xl font-extrabold tracking-wide">
        <RoniAvatar size={42} />
        RONI
      </div>

      <div className="flex flex-1 flex-col justify-center gap-6">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
        </div>

        {children}

        {footer && <div className="text-center text-sm">{footer}</div>}
      </div>
    </div>
  );
}
