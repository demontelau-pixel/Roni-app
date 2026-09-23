import type { HealthQuoteError } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

interface HealthQuoteErrorStateProps {
  error: HealthQuoteError;
  onRetry?: () => void;
}

/** Always shows Roni's own pre-written message — never CMS's raw error body (M2.5 spec §8). */
export function HealthQuoteErrorState({ error, onRetry }: HealthQuoteErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-3.5 rounded-2xl border border-line bg-surface px-5 py-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-warnbg text-warn">
        <Icon name="info" size={22} />
      </div>
      <p className="max-w-[36ch] text-[15px]">{error.message}</p>
      {onRetry && (
        <Button size="sm" variant="ghost" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
