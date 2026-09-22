import type { ReactNode } from "react";
import { AppStateProvider } from "@/lib/state/app-state";
import { AppShell } from "@/components/layout/AppShell";

/**
 * Layout for every screen that lives "inside the app" (Home,
 * Marketplace, Wallet, Ask Roni, Profile). The welcome/root screen at
 * `/` intentionally sits outside this group, so it renders without
 * the nav — same as the original prototype's `welcomeScreen()`.
 */
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <AppStateProvider>
      <AppShell>{children}</AppShell>
    </AppStateProvider>
  );
}
