"use client";

import { useRouter } from "next/navigation";
import { useHealthQuote } from "@/lib/state/health-quote-context";
import { Icon } from "@/components/ui/Icon";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import { StepProgress } from "@/components/roni/StepProgress";

const STEPS = [
  { label: "Location", href: "/market/health" },
  { label: "About you", href: "/market/health/about-you" },
  { label: "Household", href: "/market/health/household" },
];

export default function HealthAboutYouStep() {
  const router = useRouter();
  const { applicant, setApplicant, applicantComplete } = useHealthQuote();

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => router.push("/market/health")}
        className="inline-flex items-center gap-1 font-bold text-primary"
      >
        <Icon name="chevron" className="rotate-180" size={18} />
        Location
      </button>

      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight">About you</h1>
        <p className="mt-1.5 text-muted">
          Age and tobacco use both affect the real premium the Marketplace returns, so Roni asks
          for them here.
        </p>
      </div>

      <StepProgress steps={STEPS} currentIndex={1} />

      <div className="rounded-2xl bg-soft px-3.5 py-3 text-sm text-primary">
        This prototype quotes for one applicant. Adding a spouse or dependents is a future
        improvement.
      </div>

      <div className="flex flex-col gap-4">
        <TextField
          id="dob"
          label="Date of birth"
          type="date"
          value={applicant.dob}
          onChange={(e) => setApplicant({ ...applicant, dob: e.target.value, age: "" })}
        />
        <SelectField
          id="gender"
          label="Gender (optional)"
          placeholder="Prefer not to say"
          value={applicant.gender}
          onChange={(e) => setApplicant({ ...applicant, gender: e.target.value as typeof applicant.gender })}
          options={[
            { value: "Female", label: "Female" },
            { value: "Male", label: "Male" },
          ]}
        />
        <SelectField
          id="tobacco"
          label="Do you use tobacco?"
          placeholder="Select one"
          value={applicant.usesTobacco}
          onChange={(e) => setApplicant({ ...applicant, usesTobacco: e.target.value as typeof applicant.usesTobacco })}
          options={[
            { value: "no", label: "No" },
            { value: "yes", label: "Yes" },
          ]}
        />
      </div>

      <Button block disabled={!applicantComplete} onClick={() => router.push("/market/health/household")}>
        Continue
      </Button>
    </div>
  );
}
