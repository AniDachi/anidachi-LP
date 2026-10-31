import {
	Free20RoomBudgetCheckpointSchema,
	type Free20RoomBudgetRequest,
	Free20RoomBudgetRequestSchema,
	Free20RoomUnlimitedCheckpointSchema,
	HostingTimeBindingSchema,
	RoomUsageSummarySchema,
} from "@anidachi/protocol";
import {
	commitRoomUsageDay,
	getRoomById,
	getUsageSecondsForDay,
	type RoomRow,
	resolveWatchHistoryAccess,
} from "./db";
import { readFree20AccountBudget } from "./free20-account-budget";

type Room = Pick<
	RoomRow,
	"room_id" | "host_user_id" | "host_plan_code" | "hosting_time_mode" | "status"
>;
type Dependencies = {
	readRoom: (roomId: string) => Promise<Room | null>;
	commitUsage: typeof commitRoomUsageDay;
	resolveAuthority: typeof resolveWatchHistoryAccess;
	readUsage: typeof getUsageSecondsForDay;
};

/** Used by the gated internal budget route. Requires the existing authenticated,
 * serialized DO lifecycle and active-host assignment fences. It never admits a
 * room, releases an assignment, selects a grant source or enables Free20.
 * Retries must use cumulative durable usage; a lost ACK is not a failed commit.
 */
export async function settleFree20RoomBudget(
	input: Free20RoomBudgetRequest,
	now: Date,
	deps: Dependencies = {
		readRoom: getRoomById,
		commitUsage: commitRoomUsageDay,
		resolveAuthority: resolveWatchHistoryAccess,
		readUsage: getUsageSecondsForDay,
	},
) {
	const request = Free20RoomBudgetRequestSchema.parse(input);
	// Existing rooms/SQL support immutable room IDs with generation 1 only.
	if (request.roomGeneration !== 1)
		throw new Error("Unsupported room generation");
	const room = await deps.readRoom(request.roomId);
	if (
		!room ||
		room.room_id !== request.roomId ||
		room.status === "ended" ||
		room.hosting_time_mode !== "daily_free20" ||
		room.host_plan_code !== "free"
	) {
		throw new Error("Free20 room unavailable");
	}
	const owner = HostingTimeBindingSchema.shape.ownerUserId.parse(
		room.host_user_id,
	);
	const acknowledged = [];
	for (const usage of request.usage) {
		const ack = RoomUsageSummarySchema.parse(
			await deps.commitUsage(request.roomId, usage),
		);
		if (ack.day !== usage.day || ack.seconds < usage.seconds) {
			throw new Error("Free20 usage acknowledgement unavailable");
		}
		acknowledged.push(ack);
	}
	// Do not move this read before settlement or return a partial response.
	const budget = await readFree20AccountBudget(owner, now, deps);
	const current = await deps.readRoom(request.roomId);
	if (
		!current ||
		current.room_id !== request.roomId ||
		current.host_user_id !== owner ||
		current.hosting_time_mode !== "daily_free20" ||
		current.host_plan_code !== "free" ||
		current.status === "ended"
	) {
		throw new Error("Free20 room changed during settlement");
	}
	const context = {
		ownerUserId: owner,
		roomId: request.roomId,
		roomGeneration: request.roomGeneration,
		checkpointSequence: request.checkpointSequence,
		utcDay: budget.utcDay,
		serverTime: Date.parse(budget.serverTime),
		resetAt: Date.parse(budget.resetAt),
		refreshBy: Date.parse(budget.refreshBy),
		acknowledged,
	};
	if (budget.kind === "unlimited") {
		return Free20RoomUnlimitedCheckpointSchema.parse({
			...context,
			roomTimeVersion: 1,
			kind: "confirmed_unlimited",
			authority: "account_entitlements_v1",
			planCode: budget.planCode,
		});
	}
	return Free20RoomBudgetCheckpointSchema.parse({
		...context,
		roomBudgetVersion: 1,
		budgetSeconds: budget.budgetSeconds,
		committedSeconds: budget.committedSeconds,
	});
}
