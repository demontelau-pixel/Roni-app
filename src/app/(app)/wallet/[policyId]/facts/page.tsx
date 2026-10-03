import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveAutoPolicyFacts, getPolicy } from "@/lib/wallet/repository";
import { emptyAutoPolicyFacts } from "@/lib/wallet/schemas/auto-policy";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { Icon } from "@/components/ui/Icon";
import { saveManualAutoFacts } from "./actions";

interface FactsPageProps {
  params: Promise<{ policyId: string }>;
}

const YES_NO = [
  { value: "", label: "Not determined" },
  { value: "yes", label: "Yes, included" },
  { value: "no", label: "No, not included" },
];

export default async function EditPolicyFactsPage({ params }: FactsPageProps) {
  const { policyId } = await params;
  await requireUser(`/wallet/${policyId}/facts`);
  const supabase = await createClient();

  const policy = await getPolicy(supabase, policyId);
  if (!policy) notFound();

  const latest = await getEffectiveAutoPolicyFacts(supabase, policyId);
  const f = latest?.data ?? emptyAutoPolicyFacts();
  const vehicle = f.vehicles[0] ?? null;
  const driver = f.insured.drivers[0] ?? null;

  const boundAction = saveManualAutoFacts.bind(null, policyId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href={`/wallet/${policyId}`} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-bg" aria-label="Back to policy">
          <Icon name="chevron" className="rotate-180" size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Policy details</h1>
          <div className="text-sm text-muted">Tell RONI what this policy covers. Leave anything unknown blank.</div>
        </div>
      </div>

      <form action={boundAction} className="flex flex-col gap-5">
        <Panel padded className="flex flex-col gap-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Policy</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Carrier" id="carrier" name="carrier" defaultValue={f.policy.carrier ?? ""} placeholder="e.g. Progressive" />
            <TextField label="Policy number" id="policyNumber" name="policyNumber" defaultValue={f.policy.policyNumber ?? ""} />
            <SelectField
              label="Status"
              id="status"
              name="status"
              defaultValue={f.policy.status ?? ""}
              placeholder="Not determined"
              options={[
                { value: "active", label: "Active" },
                { value: "pending", label: "Pending" },
                { value: "expired", label: "Expired" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />
            <TextField label="State" id="state" name="state" defaultValue={f.policy.state ?? ""} placeholder="e.g. FL" maxLength={2} />
            <TextField label="Effective date" id="effectiveDate" name="effectiveDate" type="date" defaultValue={f.policy.effectiveDate ?? ""} />
            <TextField label="Expiration date" id="expirationDate" name="expirationDate" type="date" defaultValue={f.policy.expirationDate ?? ""} />
          </div>
        </Panel>

        <Panel padded className="flex flex-col gap-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Cost</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Premium amount" id="premiumAmount" name="premiumAmount" type="number" step="0.01" defaultValue={f.policy.premiumAmount ?? ""} />
            <SelectField
              label="Premium frequency"
              id="premiumFrequency"
              name="premiumFrequency"
              defaultValue={f.policy.premiumFrequency ?? ""}
              placeholder="Not determined"
              options={[
                { value: "monthly", label: "Monthly" },
                { value: "quarterly", label: "Quarterly" },
                { value: "semi_annual", label: "Semi-annual" },
                { value: "annual", label: "Annual" },
                { value: "other", label: "Other" },
              ]}
            />
            <TextField label="Full term premium" id="termPremium" name="termPremium" type="number" step="0.01" defaultValue={f.policy.termPremium ?? ""} />
          </div>
        </Panel>

        <Panel padded className="flex flex-col gap-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Insured</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Named insured" id="namedInsured" name="namedInsured" defaultValue={f.insured.namedInsured ?? ""} />
            <TextField label="Insured address" id="insuredAddress" name="insuredAddress" defaultValue={f.insured.address ?? ""} />
            <TextField label="Driver name" id="driverName" name="driverName" defaultValue={driver?.name ?? ""} />
            <TextField label="Driver date of birth" id="driverDob" name="driverDob" type="date" defaultValue={driver?.dateOfBirth ?? ""} />
            <TextField label="Driver license state" id="driverLicenseState" name="driverLicenseState" defaultValue={driver?.licenseState ?? ""} maxLength={2} />
          </div>
        </Panel>

        <Panel padded className="flex flex-col gap-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Vehicle</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Year" id="vehicleYear" name="vehicleYear" type="number" defaultValue={vehicle?.year ?? ""} />
            <TextField label="Make" id="vehicleMake" name="vehicleMake" defaultValue={vehicle?.make ?? ""} />
            <TextField label="Model" id="vehicleModel" name="vehicleModel" defaultValue={vehicle?.model ?? ""} />
            <TextField label="VIN" id="vehicleVin" name="vehicleVin" defaultValue={vehicle?.vin ?? ""} />
            <SelectField
              label="Usage"
              id="vehicleUsage"
              name="vehicleUsage"
              defaultValue={vehicle?.usage ?? ""}
              placeholder="Not determined"
              options={[
                { value: "commute", label: "Commute" },
                { value: "pleasure", label: "Pleasure" },
                { value: "business", label: "Business" },
                { value: "rideshare", label: "Rideshare" },
                { value: "farm", label: "Farm" },
              ]}
            />
            <TextField label="Annual mileage" id="vehicleAnnualMileage" name="vehicleAnnualMileage" type="number" defaultValue={vehicle?.annualMileage ?? ""} />
            <TextField label="Lienholder" id="vehicleLienholder" name="vehicleLienholder" defaultValue={vehicle?.lienholder ?? ""} />
          </div>
        </Panel>

        <Panel padded className="flex flex-col gap-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Coverage</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Bodily injury — per person" id="biPerPerson" name="biPerPerson" type="number" defaultValue={f.coverages.bodilyInjury?.perPerson ?? ""} />
            <TextField label="Bodily injury — per accident" id="biPerAccident" name="biPerAccident" type="number" defaultValue={f.coverages.bodilyInjury?.perAccident ?? ""} />
            <TextField label="Property damage limit" id="propertyDamageLimit" name="propertyDamageLimit" type="number" defaultValue={f.coverages.propertyDamage?.limit ?? ""} />
            <SelectField label="PIP included" id="pipIncluded" name="pipIncluded" defaultValue={f.coverages.personalInjuryProtection.included === null ? "" : f.coverages.personalInjuryProtection.included ? "yes" : "no"} options={YES_NO} />
            <TextField label="PIP limit" id="pipLimit" name="pipLimit" type="number" defaultValue={f.coverages.personalInjuryProtection.limit ?? ""} />
            <TextField label="PIP deductible" id="pipDeductible" name="pipDeductible" type="number" defaultValue={f.coverages.personalInjuryProtection.deductible ?? ""} />
            <SelectField label="Medical payments included" id="medPayIncluded" name="medPayIncluded" defaultValue={f.coverages.medicalPayments.included === null ? "" : f.coverages.medicalPayments.included ? "yes" : "no"} options={YES_NO} />
            <TextField label="Medical payments limit" id="medPayLimit" name="medPayLimit" type="number" defaultValue={f.coverages.medicalPayments.limit ?? ""} />
            <SelectField label="Uninsured motorist included" id="umIncluded" name="umIncluded" defaultValue={f.coverages.uninsuredMotorist.included === null ? "" : f.coverages.uninsuredMotorist.included ? "yes" : "no"} options={YES_NO} />
            <TextField label="Uninsured motorist — per person" id="umPerPerson" name="umPerPerson" type="number" defaultValue={f.coverages.uninsuredMotorist.perPerson ?? ""} />
            <TextField label="Uninsured motorist — per accident" id="umPerAccident" name="umPerAccident" type="number" defaultValue={f.coverages.uninsuredMotorist.perAccident ?? ""} />
            <SelectField label="Underinsured motorist included" id="uimIncluded" name="uimIncluded" defaultValue={f.coverages.underinsuredMotorist.included === null ? "" : f.coverages.underinsuredMotorist.included ? "yes" : "no"} options={YES_NO} />
            <TextField label="Underinsured motorist — per person" id="uimPerPerson" name="uimPerPerson" type="number" defaultValue={f.coverages.underinsuredMotorist.perPerson ?? ""} />
            <TextField label="Underinsured motorist — per accident" id="uimPerAccident" name="uimPerAccident" type="number" defaultValue={f.coverages.underinsuredMotorist.perAccident ?? ""} />
          </div>
        </Panel>

        <Panel padded className="flex flex-col gap-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Deductibles &amp; extras</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField label="Collision included" id="collisionIncluded" name="collisionIncluded" defaultValue={f.coverages.collision.included === null ? "" : f.coverages.collision.included ? "yes" : "no"} options={YES_NO} />
            <TextField label="Collision deductible" id="collisionDeductible" name="collisionDeductible" type="number" defaultValue={f.coverages.collision.deductible ?? ""} />
            <SelectField label="Comprehensive included" id="comprehensiveIncluded" name="comprehensiveIncluded" defaultValue={f.coverages.comprehensive.included === null ? "" : f.coverages.comprehensive.included ? "yes" : "no"} options={YES_NO} />
            <TextField label="Comprehensive deductible" id="comprehensiveDeductible" name="comprehensiveDeductible" type="number" defaultValue={f.coverages.comprehensive.deductible ?? ""} />
            <SelectField label="Rental reimbursement included" id="rentalIncluded" name="rentalIncluded" defaultValue={f.coverages.rentalReimbursement.included === null ? "" : f.coverages.rentalReimbursement.included ? "yes" : "no"} options={YES_NO} />
            <TextField label="Rental — limit per day" id="rentalLimitPerDay" name="rentalLimitPerDay" type="number" defaultValue={f.coverages.rentalReimbursement.limitPerDay ?? ""} />
            <TextField label="Rental — max days" id="rentalMaxDays" name="rentalMaxDays" type="number" defaultValue={f.coverages.rentalReimbursement.maxDays ?? ""} />
            <SelectField label="Roadside assistance included" id="roadsideIncluded" name="roadsideIncluded" defaultValue={f.coverages.roadsideAssistance.included === null ? "" : f.coverages.roadsideAssistance.included ? "yes" : "no"} options={YES_NO} />
            <TextField label="Roadside assistance details" id="roadsideDetails" name="roadsideDetails" defaultValue={f.coverages.roadsideAssistance.details ?? ""} />
          </div>
        </Panel>

        <Panel padded className="flex flex-col gap-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Other</h2>
          <TextField label="Discounts (comma-separated)" id="discounts" name="discounts" defaultValue={f.other.discounts.join(", ")} />
          <TextField label="Important exclusions (comma-separated)" id="importantExclusions" name="importantExclusions" defaultValue={f.other.importantExclusions.join(", ")} />
        </Panel>

        <div className="flex justify-end gap-2">
          <Button href={`/wallet/${policyId}`} variant="ghost">
            Cancel
          </Button>
          <Button type="submit">Save details</Button>
        </div>
      </form>
    </div>
  );
}
