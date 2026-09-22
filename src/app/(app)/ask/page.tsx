import { RoniAvatar } from "@/components/roni/RoniAvatar";
import { ComingSoon } from "@/components/roni/ComingSoon";

interface AskPageProps {
  searchParams: Promise<{ q?: string }>;
}

/**
 * Ask Roni's real, scripted conversation (ported from `askScreen()` /
 * `answerScripted()` in the prototype) is M4 scope. This placeholder
 * still reads the `?q=` the Home screen's "Ask Roni" box sends, so
 * trying it doesn't feel like a dead end — it just doesn't answer yet.
 */
export default async function AskPage({ searchParams }: AskPageProps) {
  const { q } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <RoniAvatar size={46} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ask Roni</h1>
          <div className="text-sm text-muted">Your insurance assistant.</div>
        </div>
      </div>

      {q && (
        <div className="self-end max-w-[88%] rounded-2xl rounded-br-md bg-primary px-3.5 py-3 text-primary-ink">
          {q}
        </div>
      )}

      <ComingSoon
        icon="star"
        title="Ask Roni is not wired up yet"
        milestone="M4"
        description="The scripted question-and-answer assistant from the prototype (with policy citations and quick actions) will be rebuilt here as its own milestone."
      />
    </div>
  );
}
