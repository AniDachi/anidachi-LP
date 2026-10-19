import type { BillingOverview } from "./billing-view";

export const EXTENSION_WELCOME_PATH = "/extension?welcome=1";
export type ExtensionWelcome =
  | { kind: "trial"; plan: "plus" | "pro"; endsAt: string; expiresInMs: number; cardlessWithoutRenewal: boolean }
  | { kind: "paid"; plan: "plus" | "pro"; expiresInMs?: number }
  | { kind: "inactive" | "sign_in" | "error" };

/** Presentation derived from a live, owner-checked server overview, never URL claims. */
export function resolveExtensionWelcome(overview: BillingOverview, elapsedMs = 0): ExtensionWelcome {
  const now = Date.parse(overview.serverTime ?? "") + Math.max(0, elapsedMs);
  const plan = overview.planCode;
  if (!Number.isFinite(now) || (plan !== "plus" && plan !== "pro")) return { kind: "inactive" };
  const expiry = Date.parse(overview.selectedPlanExpiresAt ?? "");
  if (Number.isFinite(expiry) && expiry <= now) return { kind: "inactive" };
  const subscriptions = overview.subscriptions.filter(s => s.planCode === plan);
  const paid = subscriptions.find(s => s.status === "active" && (!s.trial || s.trial.stage === "paid") &&
    (s.currentPeriodEnd === null || Date.parse(s.currentPeriodEnd) > now));
  if (paid) return { kind: "paid", plan, ...(Number.isFinite(expiry) ? { expiresInMs: expiry - now } : {}) };
  const trial = subscriptions.find(s => (s.status === "active" || s.status === "trialing") &&
    s.trial?.stage === "trial" && Date.parse(s.trial.endsAt) > now)?.trial;
  if (!trial) return { kind: "inactive" };
  return {
    kind: "trial", plan, endsAt: trial.endsAt,
    expiresInMs: Math.min(Date.parse(trial.endsAt), Number.isFinite(expiry) ? expiry : Infinity) - now,
    cardlessWithoutRenewal: trial.mode === "cardless" && trial.renewalState === "not_enabled" &&
      !trial.renewalEnabled && !trial.pendingRenewal,
  };
}
