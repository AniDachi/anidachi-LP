import {
	Free20DisplayTimeSchema,
	Free20RoomUnlimitedCheckpointSchema,
	type Free20DisplayTime,
	type Free20RoomBudgetResponse,
} from "@anidachi/protocol";
import {
	readFree20StatusAuthority,
	validateFree20StatusAuthority,
} from "./account-hosting-status";

/** Optional display provenance only. The accounting checkpoint and room policy
 * remain authoritative even if this independent, bounded read is unavailable. */
export async function readFree20DisplayTime(
	checkpoint: Free20RoomBudgetResponse["checkpoint"],
	readAuthority = readFree20StatusAuthority,
): Promise<Free20DisplayTime | undefined> {
	const parsed = Free20RoomUnlimitedCheckpointSchema.safeParse(checkpoint);
	if (!parsed.success) return undefined;
	const bound = parsed.data;
	const started = performance.now();
	try {
		const source = validateFree20StatusAuthority(
			bound.ownerUserId,
			await readAuthority(bound.ownerUserId),
		);
		if (
			!source?.grant ||
			source.planCode !== bound.planCode ||
			source.resetAt !== bound.resetAt ||
			new Date(source.serverTime).toISOString().slice(0, 10) !== bound.utcDay ||
			source.serverTime < bound.serverTime ||
			source.assignment?.role !== "host" ||
			source.assignment.hostUserId !== bound.ownerUserId ||
			source.assignment.roomId !== bound.roomId ||
			source.assignment.roomGeneration !== bound.roomGeneration ||
			source.assignment.hostingTimeMode !== "daily_free20" ||
			source.assignment.status !== "live"
		)
			return undefined;
		const validUntil = Math.min(
			bound.refreshBy,
			source.refreshBy,
			source.grant.validUntil ?? Number.POSITIVE_INFINITY,
		);
		// Include the full elapsed read conservatively. A slow source must never
		// turn an already expired checkpoint or grant into a fresh display.
		const elapsed = performance.now() - started;
		if (
			!Number.isFinite(elapsed) ||
			elapsed < 0 ||
			validUntil - source.serverTime <= elapsed
		)
			return undefined;
		return Free20DisplayTimeSchema.parse({
			access: { kind: "confirmed_unlimited", ...source.grant },
			validUntil,
		});
	} catch {
		return undefined;
	}
}
