"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
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

/** Ported from the "Vehicle" step of the prototype's Auto quote flow (M2 spec §2, Step 1). */
export default function AutoVehicleStep() {
  const router = useRouter();
  const { vehicle, setVehicle, vehicleComplete } = useAutoQuote();

  return (
    <div className="flex flex-col gap-5">
      <Link href="/market" className="inline-flex items-center gap-1 font-bold text-primary">
        <Icon name="chevron" className="rotate-180" size={18} />
        Marketplace
      </Link>

      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight">Auto insurance</h1>
        <p className="mt-1.5 text-muted">Let&rsquo;s start with the vehicle you want to insure.</p>
      </div>

      <StepProgress steps={STEPS} currentIndex={0} />

      <div className="rounded-2xl bg-soft px-3.5 py-3 text-sm text-primary">
        This is a prototype — everything you enter here is demo data and isn&rsquo;t stored anywhere.
      </div>

      <div className="flex flex-col gap-4">
        <TextField
          id="zip"
          label="ZIP code"
          inputMode="numeric"
          placeholder="43215"
          value={vehicle.zip}
          onChange={(e) => setVehicle({ ...vehicle, zip: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-4">
          <TextField
            id="year"
            label="Vehicle year"
            inputMode="numeric"
            placeholder="2021"
            value={vehicle.year}
            onChange={(e) => setVehicle({ ...vehicle, year: e.target.value })}
          />
          <TextField
            id="make"
            label="Make"
            placeholder="Honda"
            value={vehicle.make}
            onChange={(e) => setVehicle({ ...vehicle, make: e.target.value })}
          />
        </div>
        <TextField
          id="model"
          label="Model"
          placeholder="Civic LX"
          value={vehicle.model}
          onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
        />
        <SelectField
          id="ownership"
          label="Ownership"
          placeholder="Select one"
          value={vehicle.ownership}
          onChange={(e) => setVehicle({ ...vehicle, ownership: e.target.value as typeof vehicle.ownership })}
          options={[
            { value: "own", label: "Own" },
            { value: "finance", label: "Finance" },
            { value: "lease", label: "Lease" },
          ]}
        />
      </div>

      <Button block disabled={!vehicleComplete} onClick={() => router.push("/market/auto/driver")}>
        Continue
      </Button>
    </div>
  );
}
