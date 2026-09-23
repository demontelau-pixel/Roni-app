"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useHealthQuote } from "@/lib/state/health-quote-context";
import type { HealthQuoteError } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import { StepProgress } from "@/components/roni/StepProgress";
import { HealthQuoteErrorState } from "@/components/roni/HealthQuoteErrorState";

const STEPS = [
  { label: "Location", href: "/market/health" },
  { label: "About you", href: "/market/health/about-you" },
  { label: "Household", href: "/market/health/household" },
];

interface CountyOption {
  fips: string;
  name: string;
  state: string;
}

export default function HealthLocationStep() {
  const router = useRouter();
  const { location, setLocation, year, setYear, locationComplete } = useHealthQuote();

  const [zipInput, setZipInput] = useState(location.zip);
  const [counties, setCounties] = useState<CountyOption[]>([]);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "error">("idle");
  const [lookupError, setLookupError] = useState<HealthQuoteError | null>(null);

  const [years, setYears] = useState<number[] | null>(null);
  const [yearsError, setYearsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health/market-years")
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setYears(res.data.supported);
          if (!year) setYear(res.data.current);
        } else {
          setYearsError(true);
        }
      })
      .catch(() => !cancelled && setYearsError(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookupZip(zip: string) {
    setCounties([]);
    setLookupError(null);
    if (!/^\d{5}$/.test(zip)) return;
    setLookupState("loading");
    try {
      const res = await fetch("/api/health/counties", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ zip }),
      });
      const body = await res.json();
      if (!body.ok) {
        setLookupState("error");
        setLookupError(body.error);
        return;
      }
      const found: CountyOption[] = body.data.map((c: { fips: string; name: string; state: string }) => ({
        fips: c.fips,
        name: c.name,
        state: c.state,
      }));
      setCounties(found);
      setLookupState("idle");
      const onlyMatch = found.length === 1 ? found[0] : undefined;
      if (onlyMatch) {
        setLocation({ zip, countyfips: onlyMatch.fips, state: onlyMatch.state });
      } else {
        setLocation({ zip, countyfips: "", state: "" });
      }
    } catch {
      setLookupState("error");
      setLookupError({ code: "cms_unavailable", message: "Roni couldn't look up that ZIP code right now. Please try again." });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Link href="/market" className="inline-flex items-center gap-1 font-bold text-primary">
        <Icon name="chevron" className="rotate-180" size={18} />
        Marketplace
      </Link>

      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight">Health insurance</h1>
        <p className="mt-1.5 text-muted">
          Roni looks these up for real from the federal Health Insurance Marketplace. Let&rsquo;s
          start with where you live.
        </p>
      </div>

      <StepProgress steps={STEPS} currentIndex={0} />

      <div className="flex flex-col gap-4">
        <TextField
          id="zip"
          label="ZIP code"
          inputMode="numeric"
          placeholder="43215"
          value={zipInput}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 5);
            setZipInput(v);
            if (v.length === 5) lookupZip(v);
            else setCounties([]);
          }}
        />

        {lookupState === "loading" && <p className="text-sm text-muted">Looking up your county…</p>}
        {lookupState === "error" && lookupError && (
          <HealthQuoteErrorState error={lookupError} onRetry={() => lookupZip(zipInput)} />
        )}
        {counties.length > 1 && (
          <SelectField
            id="county"
            label="Which county?"
            placeholder="Select your county"
            value={location.countyfips}
            onChange={(e) => {
              const c = counties.find((x) => x.fips === e.target.value);
              if (c) setLocation({ zip: zipInput, countyfips: c.fips, state: c.state });
            }}
            options={counties.map((c) => ({ value: c.fips, label: `${c.name}, ${c.state}` }))}
          />
        )}
        {(() => {
          const soleCounty = counties.length === 1 ? counties[0] : undefined;
          if (!soleCounty || !location.countyfips) return null;
          return (
            <p className="text-sm text-good">
              {soleCounty.name}, {soleCounty.state} ✓
            </p>
          );
        })()}

        {yearsError ? (
          <p className="text-sm text-warn">Roni couldn&rsquo;t load coverage years right now — try reloading this page.</p>
        ) : (
          <SelectField
            id="year"
            label="Coverage year"
            disabled={!years}
            placeholder={years ? "Select a year" : "Loading years…"}
            value={year ? String(year) : ""}
            onChange={(e) => setYear(Number(e.target.value))}
            options={(years ?? []).map((y) => ({ value: String(y), label: String(y) }))}
          />
        )}
      </div>

      <Button block disabled={!locationComplete} onClick={() => router.push("/market/health/about-you")}>
        Continue
      </Button>
    </div>
  );
}
