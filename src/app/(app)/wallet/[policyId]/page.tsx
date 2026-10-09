import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  getExtractionEvidence,
  getEffectiveAutoPolicyFacts,
  getLatestAnalysisJob,
  getPolicy,
  getPolicyDocuments,
} from "@/lib/wallet/repository";
import { AnalysisStatus } from "@/components/roni/AnalysisStatus";
import { emptyAutoPolicyFacts } from "@/lib/wallet/schemas/auto-policy";
import { annotateAutoPolicyFacts } from "@/lib/wallet/annotate";
import { deriveProcessingState, policyStatusLabel } from "@/lib/wallet/processing-state";
import { extractionUserMessage } from "@/lib/wallet/extraction-message";
import { retryPolicyExtraction } from "@/app/(app)/wallet/[policyId]/actions";
import { maskPolicyNumber, maskVin } from "@/lib/wallet/mask";
import { formatMoneyOrUnavailable } from "@/lib/utils";
import { FactRow } from "@/components/roni/FactRow";
import { ViewDocumentButton } from "@/components/roni/ViewDocumentButton";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { Icon } from "@/components/ui/Icon";
import type { ExtractedField } from "@/lib/wallet/schemas/extracted-field";

interface PolicyDashboardPageProps {
  params: Promise<{ policyId: string }>;
}

function moneyOrNull(n: number | null): string | null {
  return n === null ? null : formatMoneyOrUnavailable(n);
}

function limitPairText(field: { perPerson: ExtractedField<number | null>; perAccident: ExtractedField<number | null> } | null): string | null {
  if (!field) return null;
  if (field.perPerson.value === null || field.perAccident.value === null) return null;
  return `${formatMoneyOrUnavailable(field.perPerson.value)} / ${formatMoneyOrUnavailable(field.perAccident.value)}`;
}

function singleLimitText(field: { limit: ExtractedField<number | null> } | null): string | null {
  if (!field || field.limit.value === null) return null;
  return formatMoneyOrUnavailable(field.limit.value);
}

function triText(value: boolean | null): string | null {
  if (value === null) return null;
  return value ? "Included" : "Not included";
}

/**
 * The Policy Dashboard (M3.1–M3.4 brief, "WALLET UI / POLICY
 * DASHBOARD"). Renders whatever the latest extraction/manual-entry
 * round produced, honestly: every unknown fact reads "Not
 * determined," never a blank or a guess.
 */
export default async function PolicyDashboardPage({ params }: PolicyDashboardPageProps) {
  const { policyId } = await params;
  await requireUser(`/wallet/${policyId}`);
  const supabase = await createClient();

  const policy = await getPolicy(supabase, policyId);
  if (!policy) notFound();

  const [latest, documents] = await Promise.all([
    getEffectiveAutoPolicyFacts(supabase, policyId),
    getPolicyDocuments(supabase, policyId),
  ]);
  const evidence = latest ? await getExtractionEvidence(supabase, latest.id) : [];
  const facts = latest?.data ?? emptyAutoPolicyFacts();
  const annotated = annotateAutoPolicyFacts(facts, evidence);
  const processingState = deriveProcessingState(latest?.extractionStatus ?? null);
  const stateDisplay = policyStatusLabel(latest?.extractedBy ?? null, processingState);
  const mostRecentDocument = documents[0] ?? null;
  const userMessage = extractionUserMessage(latest?.extractedBy ?? null, processingState);
  const latestJob = mostRecentDocument ? await getLatestAnalysisJob(supabase, mostRecentDocument.id) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <Link href="/wallet" className="grid h-9 w-9 flex-none place-items-center rounded-full text-muted hover:bg-bg" aria-label="Back to Wallet">
          <Icon name="chevron" className="rotate-180" size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Auto insurance</h1>
            <Tag variant={stateDisplay.tone === "good" ? "good" : stateDisplay.tone === "warn" ? "warn" : "grey"}>
              {stateDisplay.label}
            </Tag>
          </div>
          <div className="text-sm text-muted">{facts.policy.carrier ?? "Carrier not determined"}</div>
        </div>
      </div>

      {mostRecentDocument && (latestJob?.status === "queued" || latestJob?.status === "processing") && (
        <AnalysisStatus
          policyId={policyId}
          documentId={mostRecentDocument.id}
          initialStatus={latestJob.status}
          hasPreviousResult={latest !== null}
        />
      )}

      {userMessage && latestJob?.status !== "queued" && latestJob?.status !== "processing" && (
        <Panel padded className="flex flex-col gap-3 bg-warnbg/40">
          <div className="flex items-start gap-2">
            <Icon name="alert" size={20} className="mt-0.5 flex-none text-warn" />
            <div>
              <div className="font-bold">{userMessage.title}</div>
              <p className="mt-1 text-sm text-muted">{userMessage.body}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button href={`/wallet/${policyId}/facts`} size="sm">
              Add policy details
            </Button>
            {mostRecentDocument && (
              <form action={retryPolicyExtraction.bind(null, policyId)}>
                <Button type="submit" variant="soft" size="sm">
                  Retry analysis
                </Button>
              </form>
            )}
          </div>
        </Panel>
      )}

      <Panel padded>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">Header</h2>
        <FactRow label="Policy number" displayValue={maskPolicyNumber(facts.policy.policyNumber)} field={annotated.policy.policyNumber} />
        <FactRow label="Status" displayValue={facts.policy.status} field={annotated.policy.status} />
        <FactRow label="Effective date" displayValue={facts.policy.effectiveDate} field={annotated.policy.effectiveDate} />
        <FactRow label="Expiration date" displayValue={facts.policy.expirationDate} field={annotated.policy.expirationDate} />
        <FactRow label="State" displayValue={facts.policy.state} field={annotated.policy.state} />
      </Panel>

      <Panel padded>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">Cost</h2>
        <FactRow label="Currency" displayValue={facts.policy.currency} field={annotated.policy.currency} />
        <FactRow
          label="Premium"
          displayValue={
            facts.policy.premiumAmount !== null
              ? `${formatMoneyOrUnavailable(facts.policy.premiumAmount)}${facts.policy.premiumFrequency ? ` / ${facts.policy.premiumFrequency.replace("_", "-")}` : ""}`
              : null
          }
          field={annotated.policy.premiumAmount}
        />
        <FactRow label="Full term premium" displayValue={moneyOrNull(facts.policy.termPremium)} field={annotated.policy.termPremium} />
        <FactRow
          label="Installment amount"
          displayValue={moneyOrNull(facts.policy.paymentInstallmentAmount)}
          field={annotated.policy.paymentInstallmentAmount}
        />
        <FactRow label="Payment frequency" displayValue={facts.policy.paymentFrequency?.replace("_", "-")} field={annotated.policy.paymentFrequency} />
      </Panel>

      <Panel padded>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">Vehicles</h2>
        {facts.vehicles.length === 0 ? (
          <p className="py-2 text-sm text-muted">No vehicle on file.</p>
        ) : (
          facts.vehicles.map((v, idx) => (
            <div key={idx} className={idx > 0 ? "mt-3 border-t border-line pt-3" : undefined}>
              <FactRow
                label="Vehicle"
                displayValue={v.year && v.make && v.model ? `${v.year} ${v.make} ${v.model}` : null}
                field={annotated.vehicles[idx]?.make}
              />
              <FactRow label="VIN" displayValue={maskVin(v.vin)} field={annotated.vehicles[idx]?.vin} />
              <FactRow label="Usage" displayValue={v.usage} field={annotated.vehicles[idx]?.usage} />
              <FactRow label="Annual mileage" displayValue={v.annualMileage !== null ? `${v.annualMileage.toLocaleString()} mi/yr` : null} field={annotated.vehicles[idx]?.annualMileage} />
              <FactRow label="Lienholder" displayValue={v.lienholder} field={annotated.vehicles[idx]?.lienholder} />
            </div>
          ))
        )}
      </Panel>

      <Panel padded>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">Drivers</h2>
        <FactRow label="Named insured" displayValue={facts.insured.namedInsured} field={annotated.insured.namedInsured} />
        {facts.insured.drivers.map((d, idx) => (
          <FactRow key={idx} label={`Driver ${idx + 1}`} displayValue={d.name} field={annotated.insured.drivers[idx]?.name} />
        ))}
      </Panel>

      <Panel padded>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">Coverage</h2>
        <FactRow label="Bodily injury liability" displayValue={limitPairText(annotated.coverages.bodilyInjury)} field={annotated.coverages.bodilyInjury?.perPerson} />
        <FactRow label="Property damage liability" displayValue={singleLimitText(annotated.coverages.propertyDamage)} field={annotated.coverages.propertyDamage?.limit} />
        <FactRow label="Collision" displayValue={triText(facts.coverages.collision.included)} field={annotated.coverages.collision.included} />
        <FactRow label="Comprehensive" displayValue={triText(facts.coverages.comprehensive.included)} field={annotated.coverages.comprehensive.included} />
        <FactRow label="PIP" displayValue={triText(facts.coverages.personalInjuryProtection.included)} field={annotated.coverages.personalInjuryProtection.included} />
        <FactRow label="PIP limit" displayValue={moneyOrNull(facts.coverages.personalInjuryProtection.limit)} field={annotated.coverages.personalInjuryProtection.limit} />
        <FactRow label="Medical payments" displayValue={triText(facts.coverages.medicalPayments.included)} field={annotated.coverages.medicalPayments.included} />
        <FactRow label="Medical payments limit" displayValue={moneyOrNull(facts.coverages.medicalPayments.limit)} field={annotated.coverages.medicalPayments.limit} />
        <FactRow label="Uninsured motorist" displayValue={triText(facts.coverages.uninsuredMotorist.included)} field={annotated.coverages.uninsuredMotorist.included} />
        <FactRow
          label="Uninsured motorist limit"
          displayValue={limitPairText({ perPerson: annotated.coverages.uninsuredMotorist.perPerson, perAccident: annotated.coverages.uninsuredMotorist.perAccident })}
          field={annotated.coverages.uninsuredMotorist.perPerson}
        />
        <FactRow label="Underinsured motorist" displayValue={triText(facts.coverages.underinsuredMotorist.included)} field={annotated.coverages.underinsuredMotorist.included} />
        <FactRow
          label="Underinsured motorist limit"
          displayValue={limitPairText({ perPerson: annotated.coverages.underinsuredMotorist.perPerson, perAccident: annotated.coverages.underinsuredMotorist.perAccident })}
          field={annotated.coverages.underinsuredMotorist.perPerson}
        />
        <FactRow label="Rental reimbursement" displayValue={triText(facts.coverages.rentalReimbursement.included)} field={annotated.coverages.rentalReimbursement.included} />
        <FactRow label="Roadside assistance" displayValue={triText(facts.coverages.roadsideAssistance.included)} field={annotated.coverages.roadsideAssistance.included} />
        {facts.coverages.roadsideAssistance.details && (
          <FactRow label="Roadside assistance details" displayValue={facts.coverages.roadsideAssistance.details} field={annotated.coverages.roadsideAssistance.details} />
        )}
        {facts.coverages.other.map((coverage, index) => (
          <div key={`${coverage.name}-${index}`} className="border-t border-line py-2">
            <div className="font-semibold">{coverage.name}</div>
            <div className="mt-1 text-sm text-muted">
              {coverage.included === null ? "Not determined" : coverage.included ? "Included" : "Not included"}
              {coverage.limit ? ` · ${coverage.limit}` : ""}
              {coverage.deductible !== null ? ` · ${formatMoneyOrUnavailable(coverage.deductible)} deductible` : ""}
              {coverage.details ? ` · ${coverage.details}` : ""}
            </div>
          </div>
        ))}
      </Panel>

      <Panel padded>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">Deductibles</h2>
        <FactRow label="Collision deductible" displayValue={moneyOrNull(facts.coverages.collision.deductible)} field={annotated.coverages.collision.deductible} />
        <FactRow label="Comprehensive deductible" displayValue={moneyOrNull(facts.coverages.comprehensive.deductible)} field={annotated.coverages.comprehensive.deductible} />
        <FactRow label="PIP deductible" displayValue={moneyOrNull(facts.coverages.personalInjuryProtection.deductible)} field={annotated.coverages.personalInjuryProtection.deductible} />
      </Panel>

      <Panel padded>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">Insights</h2>
        {latest?.roniSummary && (
          <div className="mb-3 rounded-lg bg-bg p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
              <Icon name="star" size={14} />
              RONI Summary
            </div>
            <p className="text-sm">{latest.roniSummary}</p>
            <p className="mt-1.5 text-xs text-muted">
              RONI&apos;s plain-language summary of the facts extracted from this policy — not a new fact itself.
            </p>
          </div>
        )}
        {facts.other.discounts.length === 0 &&
        facts.other.importantExclusions.length === 0 &&
        facts.other.importantConditions.length === 0 &&
        facts.other.endorsements.length === 0 &&
        !facts.other.claimsContact.phone &&
        !facts.other.claimsContact.email &&
        !facts.other.claimsContact.website ? (
          <p className="py-2 text-sm text-muted">Nothing recorded yet.</p>
        ) : (
          <>
            {facts.other.discounts.length > 0 && (
              <div className="py-2">
                <div className="text-sm text-muted">Discounts</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {facts.other.discounts.map((d) => (
                    <Tag key={d}>{d}</Tag>
                  ))}
                </div>
              </div>
            )}
            {facts.other.importantExclusions.length > 0 && (
              <div className="py-2">
                <div className="text-sm text-muted">Important exclusions</div>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {facts.other.importantExclusions.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            {facts.other.importantConditions.length > 0 && (
              <div className="py-2">
                <div className="text-sm text-muted">Important conditions</div>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {facts.other.importantConditions.map((condition) => (
                    <li key={condition}>{condition}</li>
                  ))}
                </ul>
              </div>
            )}
            {facts.other.endorsements.length > 0 && (
              <div className="py-2">
                <div className="text-sm text-muted">Endorsements and modifications</div>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {facts.other.endorsements.map((endorsement) => (
                    <li key={endorsement}>{endorsement}</li>
                  ))}
                </ul>
              </div>
            )}
            {(facts.other.claimsContact.phone || facts.other.claimsContact.email || facts.other.claimsContact.website) && (
              <div className="py-2">
                <div className="text-sm text-muted">Claims contact in the policy</div>
                <div className="mt-1 text-sm">
                  {[facts.other.claimsContact.phone, facts.other.claimsContact.email, facts.other.claimsContact.website].filter(Boolean).join(" · ")}
                </div>
              </div>
            )}
          </>
        )}
      </Panel>

      <Panel padded className="flex flex-col gap-3">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Button href={`/wallet/${policyId}/ask`} size="sm">
            <Icon name="star" size={16} />
            Ask Roni about this policy
          </Button>
          <Button href={`/wallet/${policyId}/compare`} variant="soft" size="sm">
            <Icon name="compare" size={16} />
            Compare similar coverage
          </Button>
          <Button href={`/wallet/${policyId}/facts`} variant="ghost" size="sm">
            Edit details
          </Button>
          {mostRecentDocument && (
            <form action={retryPolicyExtraction.bind(null, policyId)}>
              <Button type="submit" variant="ghost" size="sm">
                Re-run analysis
              </Button>
            </form>
          )}
        </div>
        {mostRecentDocument && <ViewDocumentButton policyId={policyId} documentId={mostRecentDocument.id} />}
      </Panel>
    </div>
  );
}
