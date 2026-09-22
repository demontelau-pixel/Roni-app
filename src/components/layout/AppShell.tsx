import type { ReactNode } from "react";
import { Nav } from "@/components/layout/Nav";

interface AppShellProps {
  children: ReactNode;
}

/**
 * Ported from the prototype's `#app` / `main` rules. `flex-row-reverse`
 * at 900px is what turns `<Nav>` into a left sidebar while keeping
 * `<main>` first in the DOM (see the comment in `Nav.tsx`).
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative mx-auto flex h-dvh max-w-[480px] flex-col overflow-hidden bg-bg min-[520px]:border-x min-[520px]:border-line min-[900px]:max-w-[1180px] min-[900px]:flex-row-reverse">
      <main className="flex-1 overflow-y-auto px-[18px] pt-5 pb-8 min-[900px]:px-11 min-[900px]:py-9">
        <div className="mx-auto max-w-[760px]">{children}</div>
      </main>
      <Nav />
    </div>
  );
}
