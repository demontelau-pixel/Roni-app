import type { ReactNode } from "react";
import { AutoQuoteProvider } from "@/lib/state/auto-quote-context";

/**
 * Everything under `/market/auto` (vehicle → driver → priorities →
 * results → details → compare) shares one `AutoQuoteProvider` so the
 * user's answers survive navigating between those steps for the
 * lifetime of the tab (M2 spec §12).
 */
export default function AutoLayout({ children }: { children: ReactNode }) {
  return <AutoQuoteProvider>{children}</AutoQuoteProvider>;
}
