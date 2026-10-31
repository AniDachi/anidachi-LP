import { nextUtcMidnight, type QuotaView } from "../room-quota";
import { db } from "./db";

export type Free20HostingAdmission = {
	planCode: "free" | "plus" | "pro";
	quota: QuotaView;
};

/** Internal preflight, never a live usage reservation. SQL rechecks under the
 * existing account/assignment locks; the assigned DO owns unsettled intervals.
 * Keep public account/history entitlements unchanged until consumer migration.
 */
export async function readFree20HostingAdmission(
	ownerUserId: string,
): Promise<Free20HostingAdmission | null> {
	if (process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED !== "true") return null;
	try {
		const { data, error } = await db()
			.rpc("resolve_free20_hosting_access_v1", { p_user_id: ownerUserId })
			.abortSignal(AbortSignal.timeout(2000));
		if (error || !data || typeof data !== "object" || Array.isArray(data))
			throw new Error("Missing authority");
		if (data.enabled === false && Object.keys(data).length === 1) return null;
		const { planCode, usedSeconds, remainingSeconds, serverTime, resetAt } =
			data;
		if (
			data.enabled !== true ||
			data.ownerUserId !== ownerUserId ||
			!["free", "plus", "pro"].includes(planCode) ||
			!Number.isSafeInteger(usedSeconds) ||
			usedSeconds < 0 ||
			typeof serverTime !== "string" ||
			!Number.isFinite(Date.parse(serverTime)) ||
			typeof resetAt !== "string" ||
			!Number.isFinite(Date.parse(resetAt)) ||
			Date.parse(resetAt) !== nextUtcMidnight(new Date(serverTime)).getTime() ||
			remainingSeconds !==
				(planCode === "free" ? Math.max(0, 1200 - usedSeconds) : null) ||
			data.canHost !== (planCode !== "free" || usedSeconds < 1200)
		)
			throw new Error("Invalid authority");
		return {
			planCode,
			quota: {
				limitSeconds: planCode === "free" ? 1200 : Number.POSITIVE_INFINITY,
				usedSeconds,
				remainingSeconds: remainingSeconds ?? Number.POSITIVE_INFINITY,
				resetAt: new Date(resetAt).toISOString(),
			},
		};
	} catch {
		throw new Error("ROOM_AUTHORITY_UNAVAILABLE");
	}
}
