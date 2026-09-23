"use client";

import { useRouter } from "next/navigation";
import { useHealthQuote } from "@/lib/state/health-quote-context";
import type { HealthMember } from "@/lib/types";
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

function MemberCard({
  member,
  index,
  onChange,
  onRemove,
}: {
  member: HealthMember;
  index: number;
  onChange: (m: HealthMember) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-bold">Household member {index + 1}</div>
        <button type="button" onClick={onRemove} aria-label="Remove this person" className="text-muted">
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className="flex flex-col gap-3.5">
        <TextField
          id={`member-dob-${member.id}`}
          label="Date of birth"
          type="date"
          value={member.dob}
          onChange={(e) => onChange({ ...member, dob: e.target.value, age: "" })}
        />
        <SelectField
          id={`member-gender-${member.id}`}
          label="Gender (optional)"
          placeholder="Prefer not to say"
          value={member.gender}
          onChange={(e) => onChange({ ...member, gender: e.target.value as HealthMember["gender"] })}
          options={[
            { value: "Female", label: "Female" },
            { value: "Male", label: "Male" },
          ]}
        />
        <SelectField
          id={`member-tobacco-${member.id}`}
          label="Uses tobacco?"
          placeholder="Select one"
          value={member.usesTobacco}
          onChange={(e) => onChange({ ...member, usesTobacco: e.target.value as HealthMember["usesTobacco"] })}
          options={[
            { value: "no", label: "No" },
            { value: "yes", label: "Yes" },
          ]}
        />
      </div>
    </div>
  );
}

/**
 * Ported/corrected: this used to ask for a household "size" number
 * that was never actually sent to CMS — every search silently priced
 * a household of one no matter what was entered. CMS prices a
 * household from real per-person data, so this step now collects the
 * same minimum for each additional person (date of birth + tobacco
 * use) that the "About you" step already collects for the applicant.
 * Nothing is invented: a person isn't included in the request until
 * their required fields are filled in (see `useHealthQuote().householdComplete`).
 */
export default function HealthHouseholdStep() {
  const router = useRouter();
  const { household, setIncome, addMember, updateMember, removeMember, householdComplete } = useHealthQuote();

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => router.push("/market/health/about-you")}
        className="inline-flex items-center gap-1 font-bold text-primary"
      >
        <Icon name="chevron" className="rotate-180" size={18} />
        About you
      </button>

      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight">Your household</h1>
        <p className="mt-1.5 text-muted">
          Add anyone else who&rsquo;ll be on this plan with you. CMS prices a household using each
          person&rsquo;s own age and tobacco use, not just a headcount — Roni asks for the same
          minimum for each person you add.
        </p>
      </div>

      <StepProgress steps={STEPS} currentIndex={2} />

      <div className="flex flex-col gap-3.5">
        {household.additionalMembers.map((m, i) => (
          <MemberCard
            key={m.id}
            member={m}
            index={i}
            onChange={(updated) => updateMember(m.id, updated)}
            onRemove={() => removeMember(m.id)}
          />
        ))}
        <Button variant="soft" size="sm" onClick={addMember}>
          <Icon name="plus" size={16} />
          Add a household member
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <TextField
          id="income"
          label="Household yearly income (optional)"
          inputMode="numeric"
          placeholder="e.g. 52000"
          value={household.income}
          onChange={(e) => setIncome(e.target.value.replace(/\D/g, ""))}
        />
        <p className="text-xs text-muted">
          Roni sends this to CMS only to estimate your tax credit for this search — it isn&rsquo;t
          saved anywhere.
        </p>
      </div>

      {!householdComplete && (
        <p className="text-sm text-warn">
          Every household member needs a date of birth and a tobacco-use answer before Roni can
          search — or remove anyone you&rsquo;d rather not include yet.
        </p>
      )}

      <Button block disabled={!householdComplete} onClick={() => router.push("/market/health/results")}>
        See plans
      </Button>
    </div>
  );
}
