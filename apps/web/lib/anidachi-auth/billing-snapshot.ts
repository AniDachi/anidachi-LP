import { billingDisplayValidityMs, type BillingOverview } from "../billing-view";

type Dependencies = {
  websiteUser(): Promise<{ id: string } | null>;
  overview(userId: string): Promise<BillingOverview>;
  now?: () => number;
};
/** Server bootstrap must use the same live website-family check as billing API. */
export async function loadBillingSnapshot(ownerUserId: string, deps: Dependencies) {
  const now = deps.now ?? Date.now;
  const started = now();
  const user = await deps.websiteUser();
  if (!user || user.id !== ownerUserId) return undefined;
  const overview = await deps.overview(ownerUserId);
  if (overview.ownerUserId !== ownerUserId) return undefined;
  const remainingMs = billingDisplayValidityMs(overview) - (now() - started);
  return remainingMs > 0 ? { overview, remainingMs } : undefined;
}
