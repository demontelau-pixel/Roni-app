"use client";

import { useRouter } from "next/navigation";
import { useAutoQuote } from "@/lib/state/auto-quote-context";
import { Icon } from "@/components/ui/Icon";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import { StepProgress } from "@/components/roni/StepProgress";

const STEPS = [
  { label: "Vehicle", href: "/market/auto" },
  { label: "Driver", href: "/market/auto/driver" },
  { label: "Priorities", href: "/market/auto/priorities" },
];

/** Ported from the "Driver" step of the prototype's Auto quote flow (M2 spec §2, Step 2). */
export default function AutoDriverStep() {
  const router = useRouter();
  const { driver, setDriver, vehicleComplete } = useAutoQuote();

  const canContinue = Boolean(driver.dob && driver.maritalStatus && driver.drivingHistory && driver.currentlyInsured);

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => router.push("/market/auto")}
        className="inline-flex items-center gap-1 font-bold text-primary"
      >
        <Icon name="chevron" className="rotate-180" size={18} />
        Vehicle
      </button>

      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight">Tell Roni about the driver</h1>
        <p className="mt-1.5 text-muted">A few basics — nothing sensitive is required for this prototype.</p>
      </div>

      <StepProgress steps={STEPS} currentIndex={1} />

      {!vehicleComplete && (
        <div className="rounded-2xl bg-warnbg px-3.5 py-3 text-sm text-warn">
          The vehicle step isn&rsquo;t complete yet — you can still continue, but go back and finish it when you can.
        </div>
      )}

      <div className="rounded-2xl bg-soft px-3.5 py-3 text-sm text-primary">
        Prototype/demo data only. Please don&rsquo;t enter your real date of birth or other real personal details.
      </div>

      <div className="flex flex-col gap-4">
        <TextField
          id="dob"
          label="Date of birth"
          type="date"
          value={driver.dob}
          onChange={(e) => setDriver({ ...driver, dob: e.target.value })}
        />
        <SelectField
          id="marital"
          label="Marital status"
          placeholder="Select one"
          value={driver.maritalStatus}
          onChange={(e) => setDriver({ ...driver, maritalStatus: e.target.value as typeof driver.maritalStatus })}
          options={[
            { value: "single", label: "Single" },
            { value: "married", label: "Married" },
            { value: "domestic_partner", label: "Domestic partner" },
          ]}
        />
        <SelectField
          id="history"
          label="Driving history"
          placeholder="Select one"
          value={driver.drivingHistory}
          onChange={(e) => setDriver({ ...driver, drivingHistory: e.target.value as typeof driver.drivingHistory })}
          options={[
            { value: "clean", label: "Clean — no incidents" },
            { value: "one_incident", label: "One incident" },
            { value: "multiple_incidents", label: "Multiple incidents" },
          ]}
        />
        <SelectField
          id="insured"
          label="Currently insured?"
          placeholder="Select one"
          value={driver.currentlyInsured}
          onChange={(e) => setDriver({ ...driver, currentlyInsured: e.target.value as typeof driver.currentlyInsured })}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
        />
        {driver.currentlyInsured === "yes" && (
          <div className="grid grid-cols-2 gap-4">
            <TextField
              id="carrier"
              label="Current carrier (optional)"
              placeholder="e.g. Progressive"
              value={driver.currentCarrier}
              onChange={(e) => setDriver({ ...driver, currentCarrier: e.target.value })}
            />
            <TextField
              id="premium"
              label="Current monthly premium (optional)"
              inputMode="numeric"
              placeholder="184"
              value={driver.currentMonthlyPremium}
              onChange={(e) => setDriver({ ...driver, currentMonthlyPremium: e.target.value })}
            />
          </div>
        )}
      </div>

      <Button block disabled={!canContinue} onClick={() => router.push("/market/auto/priorities")}>
        Continue
      </Button>
    </div>
  );
}
