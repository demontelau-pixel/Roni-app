import type { ReactNode } from "react";
import { HealthQuoteProvider } from "@/lib/state/health-quote-context";

export default function HealthLayout({ children }: { children: ReactNode }) {
  return <HealthQuoteProvider>{children}</HealthQuoteProvider>;
}
