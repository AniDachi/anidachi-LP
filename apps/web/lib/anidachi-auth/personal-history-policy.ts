import { WatchHistoryAccessSchema } from "@anidachi/protocol";
import { db } from "./db";
import { WatchHistoryV3ApiError } from "./watch-history-v3";

export type PersonalHistoryReadFence = {
	active: boolean;
	policyVersion: 1;
	access: {
		ownerUserId: string;
		accountGeneration: number;
		accessEpoch: number;
	} | null;
};
export function personalHistoryError(
	error: unknown,
): WatchHistoryV3ApiError | null {
	const message =
		error && typeof error === "object" && "message" in error
			? String(error.message)
			: "";
	for (const [code, status] of [
		["HISTORY_PLAN_REQUIRED", 403],
		["HISTORY_ACCESS_CHANGED", 409],
		["HISTORY_CLIENT_UPDATE_REQUIRED", 426],
		["HISTORY_ACCESS_UNAVAILABLE", 503],
	] as const) {
		if (message.includes(code))
			return new WatchHistoryV3ApiError(status, code, code);
	}
	return null;
}
export async function checkPersonalHistoryOperation(
	userId: string,
	operation: "read" | "legacy" | "personal" | "metadata" = "read",
): Promise<PersonalHistoryReadFence> {
	try {
		const result = await db()
			.rpc("check_personal_history_operation_v1", {
				p_user_id: userId,
				p_operation: operation,
			})
			.abortSignal(AbortSignal.timeout(10_000));
		if (result.error) throw result.error;
		const value = result.data;
		if (
			!value ||
			typeof value.active !== "boolean" ||
			value.policyVersion !== 1
		)
			throw Error("HISTORY_ACCESS_UNAVAILABLE");
		if (value.access === null && !value.active && operation !== "personal")
			return { active: false, policyVersion: 1, access: null };
		const access = WatchHistoryAccessSchema.safeParse(value.access);
		if (!access.success || access.data.ownerUserId !== userId)
			throw Error("HISTORY_ACCESS_UNAVAILABLE");
		if (operation !== "metadata" && access.data.state !== "allowed")
			throw Error("HISTORY_PLAN_REQUIRED");
		return { active: value.active, policyVersion: 1, access: access.data };
	} catch (error) {
		throw (
			personalHistoryError(error) ??
			new WatchHistoryV3ApiError(
				503,
				"HISTORY_ACCESS_UNAVAILABLE",
				"History access is temporarily unavailable",
			)
		);
	}
}
/** No process cache. Recheck after enrichment so an access transition discards
 * the response, including paid→Free→paid and activation during a legacy read. */
export async function withPersonalHistoryRead<T>(
	userId: string,
	read: () => Promise<T>,
	operation: "read" | "legacy" | "metadata" = "read",
	check = checkPersonalHistoryOperation,
): Promise<T> {
	const before = await check(userId, operation);
	const result = await read();
	const after = await check(userId, operation);
	if (
		before.active !== after.active ||
		before.policyVersion !== after.policyVersion ||
		before.access?.ownerUserId !== after.access?.ownerUserId ||
		before.access?.accountGeneration !== after.access?.accountGeneration ||
		before.access?.accessEpoch !== after.access?.accessEpoch
	)
		throw new WatchHistoryV3ApiError(
			409,
			"HISTORY_ACCESS_CHANGED",
			"History access changed during the request",
		);
	return result;
}
