/**
 * Sensitive identifiers (policy numbers, VINs) are stored in full in
 * the database — RLS, not masking, is what keeps them private. These
 * helpers exist for the *display* layer: nothing in the future Wallet
 * UI, logs, or Ask Roni responses should interpolate a raw policy
 * number or VIN without going through one of these first (M3.0 §10).
 */

const VISIBLE_TAIL = 4;

function maskKeepingTail(value: string, visibleTail: number): string {
  const cleaned = value.trim();
  if (cleaned.length <= visibleTail) return "•".repeat(cleaned.length);
  return "•".repeat(cleaned.length - visibleTail) + cleaned.slice(-visibleTail);
}

/** "AB1234567890" -> "••••••••7890" */
export function maskPolicyNumber(policyNumber: string | null): string {
  if (!policyNumber) return "Not available";
  return maskKeepingTail(policyNumber, VISIBLE_TAIL);
}

/** "1HGCM82633A004352" -> "•••••••••••••4352" */
export function maskVin(vin: string | null): string {
  if (!vin) return "Not available";
  return maskKeepingTail(vin, VISIBLE_TAIL);
}
