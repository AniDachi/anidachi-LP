/**
 * Conservative lease for private RSC data, without trusting the browser clock.
 * A document's monotonic age is at least the age of any RSC payload requested
 * by that document. This intentionally rejects old-document/back-navigation
 * snapshots instead of granting them a fresh lease at hydration.
 */
export function serverSnapshotRemainingMs(budgetMs: number, documentAgeMs = typeof window === "undefined" ? 0 : performance.now()): number {
  if (!Number.isFinite(budgetMs) || !Number.isFinite(documentAgeMs) || documentAgeMs < 0) return 0;
  return Math.max(0, Math.min(60_000, budgetMs) - documentAgeMs);
}
