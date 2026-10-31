import { nextUtcMidnight, utcDayOf } from "../room-quota";
import { resolveAccountEntitlements } from "./account-entitlements";
import { getUsageSecondsForDay, resolveWatchHistoryAccess } from "./db";

type BudgetContext = {
	ownerUserId: string;
	/** Database authority time, not the caller's clock or ledger read completion. */
	serverTime: string;
	utcDay: string;
	resetAt: string;
	/** Re-read authority no later than this boundary; this is not a host lease. */
	refreshBy: string;
};

/** Internal server view only. Not HostingTimeSnapshot, admission, a reservation,
 * or live remaining time. Committed usage can lag an active/pending room interval.
 * Before admission or live issuance, reconcile that interval and its ACK once,
 * and retain the existing active-host assignment / settlement fences.
 */
export type Free20AccountBudget = BudgetContext &
	(
		| {
				kind: "daily_free";
				budgetSeconds: 1200;
				/** Raw ledger total, including any liveness overshoot beyond the budget. */
				committedSeconds: number;
				remainingAfterCommittedSeconds: number;
		  }
		| { kind: "unlimited"; planCode: "plus" | "pro" }
	);

type Dependencies = {
	resolveAuthority: typeof resolveWatchHistoryAccess;
	readUsage: typeof getUsageSecondsForDay;
};

/** Used by the explicitly gated internal Free20 reconciliation route.
 * userId must come from authenticated server context. Existing authority resolves
 * paid/trial/manual grants; trial offer eligibility is not daily Free eligibility.
 * No usage writes, caching, polling, resets or grant-source inference occur here.
 * The legacy resolver/policy/denial and history/media permissions stay unchanged.
 */
export async function readFree20AccountBudget(
	userId: string,
	now: Date,
	deps: Dependencies = {
		resolveAuthority: resolveWatchHistoryAccess,
		readUsage: getUsageSecondsForDay,
	},
): Promise<Free20AccountBudget> {
	const access = await resolveAccountEntitlements(
		userId,
		now,
		deps.resolveAuthority,
	);
	const at = new Date(access.history.serverTime);
	const reset = nextUtcMidnight(at);
	const unlimited = access.policy.planCode !== "free";
	const context: BudgetContext = {
		ownerUserId: access.history.ownerUserId,
		serverTime: at.toISOString(),
		utcDay: utcDayOf(at),
		resetAt: reset.toISOString(),
		// Keep within existing authority freshness and the chosen UTC period.
		// A lower-tier grant may outlast the selected plan: refresh at the earlier
		// boundary without converting plan expiry into Free or changing any grant.
		refreshBy: new Date(
			Math.min(
				Date.parse(access.history.validUntil),
				reset.getTime(),
				unlimited && access.selectedPlanExpiresAt !== null
					? Date.parse(access.selectedPlanExpiresAt)
					: Number.POSITIVE_INFINITY,
			),
		).toISOString(),
	};
	if (access.policy.planCode !== "free")
		return { ...context, kind: "unlimited", planCode: access.policy.planCode };

	const committedSeconds = await deps.readUsage(userId, context.utcDay);
	if (!Number.isSafeInteger(committedSeconds) || committedSeconds < 0) {
		throw new Error("Invalid committed Free20 usage");
	}
	return {
		...context,
		kind: "daily_free",
		budgetSeconds: 1200,
		committedSeconds,
		remainingAfterCommittedSeconds: Math.max(0, 1200 - committedSeconds),
	};
}
