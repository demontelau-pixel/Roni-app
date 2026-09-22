/**
 * FICTIONAL SAMPLE DATA — placeholder for a RONI Monitor finding.
 *
 * The real "Roni found N comparable options" card depends on the
 * Marketplace catalog and the ranking engine, which are out of scope
 * for M1 (planned for M2). Until then, this reproduces the exact
 * illustrative numbers the original prototype showed on Home, so the
 * screen looks and behaves the same after the migration.
 */
export interface MonitoringFinding {
  policyId: string;
  comparableOptionCount: number;
  maxMonthlySavings: number;
}

export const SAMPLE_MONITORING_FINDINGS: MonitoringFinding[] = [
  { policyId: "auto", comparableOptionCount: 3, maxMonthlySavings: 37 },
];

export function monitoringFindingFor(policyId: string): MonitoringFinding | undefined {
  return SAMPLE_MONITORING_FINDINGS.find((f) => f.policyId === policyId);
}
