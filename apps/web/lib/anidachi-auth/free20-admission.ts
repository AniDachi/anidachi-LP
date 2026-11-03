import { nextUtcMidnight, type QuotaView } from "../room-quota";
import { db, getRoomById, readFree20RoomUsage, resolveWatchHistoryAccess } from "./db";
import { type Free20AbuseContext, Free20ContextError } from "./free20-abuse";
import { readFree20AccountBudget } from "./free20-account-budget";

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
	context: Free20AbuseContext | null = null,
): Promise<Free20HostingAdmission | null> {
	if (process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED !== "true") return null;
	try {
		const abuse = process.env.ANIDACHI_FREE20_ABUSE_ENABLED === "true";
		const { data, error } = await db()
			.rpc(
				abuse
					? "resolve_free20_context_access_v1"
					: "resolve_free20_hosting_access_v1",
				{
					p_user_id: ownerUserId,
					...(abuse
						? {
								p_browser_hash: context?.browser ?? null,
								p_installation_hash: context?.installation ?? null,
							}
						: {}),
				},
			)
			.abortSignal(AbortSignal.timeout(2000));
		if (
			error?.message.includes("FREE20_CONTEXT_REQUIRED") ||
			error?.message.includes("FREE20_CONTEXT_INVALID")
		)
			throw new Free20ContextError();
		if (error?.message.includes("FREE20_CONTEXT_BUSY"))
			throw new Free20ContextError("FREE20_CONTEXT_BUSY");
		if (error || !data || typeof data !== "object" || Array.isArray(data))
			throw new Error("Missing authority");
		if (
			data.enabled === false &&
			Object.keys(data).every((key) =>
				["enabled", "abuseEnabled"].includes(key),
			)
		)
			return null;
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
	} catch (error) {
		if (error instanceof Free20ContextError) throw error;
		throw new Error("ROOM_AUTHORITY_UNAVAILABLE");
	}
}

/** Guest and post-admission reads use the host room's durable binding. No guest
 * marker or owner enrollment token participates; no scope attachment is possible. */
export async function readFree20BoundRoomAdmission(
	roomId: string,
): Promise<Free20HostingAdmission | null> {
	try {
		const room = await getRoomById(roomId);
		if (
			!room ||
			room.status === "ended" ||
			room.hosting_time_mode !== "daily_free20"
		)
			throw new Error("Unavailable");
		if (room.free20_abuse_protected !== true)
			return readFree20HostingAdmission(room.host_user_id);
		const budget = await readFree20AccountBudget(
			room.host_user_id,
			new Date(),
			{
				resolveAuthority: resolveWatchHistoryAccess,
				readUsage: (_owner, day) => readFree20RoomUsage(roomId, day),
			},
		);
		const current = await getRoomById(roomId);
		if (
			!current ||
			current.host_user_id !== room.host_user_id ||
			current.status === "ended" ||
			current.free20_abuse_protected !== true
		)
			throw new Error("Unavailable");
		const free = budget.kind === "daily_free";
		return {
			planCode: free ? "free" : budget.planCode,
			quota: {
				limitSeconds: free ? 1200 : Infinity,
				usedSeconds: free ? budget.committedSeconds : 0,
				remainingSeconds: free
					? budget.remainingAfterCommittedSeconds
					: Infinity,
				resetAt: budget.resetAt,
			},
		};
	} catch {
		throw new Error("ROOM_AUTHORITY_UNAVAILABLE");
	}
}
