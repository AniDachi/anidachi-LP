import {
	getPlanPolicy,
	PlanCodeSchema,
	WatchHistoryAccessSchema,
	type PlanPolicy,
	type WatchHistoryAccess,
} from "@anidachi/protocol";
import { resolveWatchHistoryAccess } from "./db";

export class HistoryAccessError extends Error {
	constructor(
		public readonly code:
			| "HISTORY_ACCESS_UNAVAILABLE"
			| "HISTORY_PLAN_REQUIRED"
			| "HISTORY_ACCESS_CHANGED"
			| "UNAUTHORIZED",
		public readonly status: 401 | 403 | 409 | 503,
	) {
		super(code);
		this.name = "HistoryAccessError";
	}
}
export type AccountEntitlements = {
	policy: PlanPolicy;
	history: WatchHistoryAccess;
	/** Expiry of the winning plan, distinct from any-paid history continuity. */
	selectedPlanExpiresAt: string | null;
};
/** JWT/session supplies identity only. DB time and transactional state issue authority. */
export async function resolveAccountEntitlements(
	userId: string,
	now: Date,
	resolve: (userId: string) => Promise<unknown> = resolveWatchHistoryAccess,
): Promise<AccountEntitlements> {
	try {
		if (!Number.isFinite(now.getTime())) throw new Error("Invalid clock");
		const value = (await resolve(userId)) as Record<string, unknown> | null;
		if (!value) throw new Error("Missing authority");
		const plan = PlanCodeSchema.parse(value.planCode);
		const history = WatchHistoryAccessSchema.parse(value.history);
		const policy = getPlanPolicy(plan);
		if (
			history.ownerUserId !== userId ||
			policy.historyEnabled !== (history.state === "allowed")
		)
			throw new Error("Authority mismatch");
		// DB clock is authoritative, not an application instance's wall clock.
		for (const field of ["paidUntil", "selectedPlanExpiresAt"] as const) {
			const expiry = value[field];
			if (
				expiry !== null &&
				(typeof expiry !== "string" || !Number.isFinite(Date.parse(expiry)))
			)
				throw new Error("Missing expiry authority");
			if (
				policy.historyEnabled &&
				typeof expiry === "string" &&
				Date.parse(expiry) <= Date.parse(history.serverTime)
			)
				throw new Error("Expired authority");
		}
		if (
			policy.historyEnabled &&
			typeof value.paidUntil === "string" &&
			Date.parse(history.validUntil) > Date.parse(value.paidUntil)
		)
			throw new Error("Lease exceeds paid access");
		return {
			policy,
			history,
			selectedPlanExpiresAt: value.selectedPlanExpiresAt as string | null,
		};
	} catch {
		throw new HistoryAccessError("HISTORY_ACCESS_UNAVAILABLE", 503);
	}
}
