import Link from "next/link";
import { AUTO_OPTIONS } from "@/lib/data/auto-options";
import { Icon } from "@/components/ui/Icon";
import { CompareTable } from "@/components/roni/CompareTable";
import { OptionAskRoni } from "@/components/roni/OptionAskRoni";

interface ComparePageProps {
  searchParams: Promise<{ ids?: string }>;
}

export default async function AutoComparePage({ searchParams }: ComparePageProps) {
  const { ids } = await searchParams;
  const requested = (ids ?? "").split(",").filter(Boolean);
  const options = requested
    .map((id) => AUTO_OPTIONS.find((o) => o.id === id))
    .filter((o): o is NonNullable<typeof o> => Boolean(o))
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/market/auto/results" className="inline-flex items-center gap-1 font-bold text-primary">
        <Icon name="chevron" className="rotate-180" size={18} />
        Results
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auto — side by side</h1>
        <p className="mt-1.5 text-muted">
          These are the options you picked to compare. Nothing here is a universal best — RONI is
          showing you the trade-offs so you can decide.
        </p>
      </div>

      <CompareTable options={options} />

      {options.length === 2 && (
        <div className="grid gap-3.5 min-[720px]:grid-cols-2">
          {options.map((option, i) => (
            <OptionAskRoni
              key={option.id}
              option={option}
              allOptions={options}
              against={options[1 - i]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
