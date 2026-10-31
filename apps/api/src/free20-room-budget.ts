import {
	type Free20RoomBudgetCheckpoint,
	Free20RoomBudgetCheckpointSchema,
	type Free20RoomBudgetRequest,
	Free20RoomBudgetRequestSchema,
	type HostingTimeBinding,
	HostingTimeBindingSchema,
} from "@anidachi/protocol";
import {
	acknowledgeRoomUsageDay,
	parseRoomMeterState,
	type RoomMeterState,
	roomUsageBuckets,
	roomUsageSummary,
} from "./room-metering";

export type Free20RoomBudget = {
	checkpoint: Free20RoomBudgetCheckpoint;
	/** Cumulative room allowance, not account remaining. Never add it to usage. */
	allowedSeconds: number;
	/** Restore fence: the paired meter must retain at least this cumulative ACK. */
	acknowledgedSeconds: number;
};

function validMeter(meter: RoomMeterState, day: string, now: number) {
	if (
		!Number.isSafeInteger(now) ||
		!Number.isFinite(new Date(now).getTime()) ||
		meter.schemaVersion !== 2 ||
		!parseRoomMeterState(meter) ||
		meter.accountingBlocked ||
		meter.day !== day ||
		new Date(now).toISOString().slice(0, 10) !== day ||
		meter.pending.some((bucket) => bucket.day >= day) ||
		(meter.activeSince !== null &&
			(meter.activeSince > now ||
				new Date(meter.activeSince).toISOString().slice(0, 10) !== day))
	) {
		throw new Error("Free20 meter unavailable");
	}
}
export function validateFree20RoomBudget(budget: Free20RoomBudget) {
	Free20RoomBudgetCheckpointSchema.parse(budget.checkpoint);
	if (
		!Number.isSafeInteger(budget.allowedSeconds) ||
		budget.allowedSeconds < 0 ||
		budget.allowedSeconds > 1200 ||
		!Number.isSafeInteger(budget.acknowledgedSeconds) ||
		budget.acknowledgedSeconds < 0 ||
		budget.acknowledgedSeconds > 86_400 ||
		budget.acknowledgedSeconds > budget.checkpoint.committedSeconds ||
		budget.allowedSeconds >
			Math.max(
				0,
				1200 - budget.checkpoint.committedSeconds + budget.acknowledgedSeconds,
			)
	) {
		throw new Error("Invalid Free20 room allowance");
	}
}
function sameRoom(a: HostingTimeBinding, b: HostingTimeBinding) {
	return (
		a.ownerUserId === b.ownerUserId &&
		a.roomId === b.roomId &&
		a.roomGeneration === b.roomGeneration
	);
}

/** Pure reconciliation used by the gated runtime. The caller must persist the materialized
 * meter and outgoing sequence before I/O, serialize lifecycle callbacks, and
 * persist the returned meter + budget together. null binding means ended.
 * An error applies NOTHING, grants NOTHING, and must never become a full budget.
 * Existing terminal-before-rollover and settlement-before-release fences remain
 * mandatory; this helper cannot authorize or resurrect a room.
 */
export function reconcileFree20RoomBudget(
	value: unknown,
	context: {
		binding: HostingTimeBinding | null;
		request: Free20RoomBudgetRequest;
		meter: RoomMeterState;
		previous: Free20RoomBudget | null;
		now: number;
	},
): { meter: RoomMeterState; budget: Free20RoomBudget } {
	const binding = HostingTimeBindingSchema.parse(context.binding);
	const request = Free20RoomBudgetRequestSchema.parse(context.request);
	const checkpoint = Free20RoomBudgetCheckpointSchema.parse(value);
	const { meter, previous, now } = context;
	validMeter(meter, binding.utcDay, now);
	if (
		!sameRoom(binding, checkpoint) ||
		checkpoint.utcDay !== binding.utcDay ||
		request.roomId !== binding.roomId ||
		request.roomGeneration !== binding.roomGeneration ||
		request.checkpointSequence !== checkpoint.checkpointSequence ||
		checkpoint.serverTime > now ||
		checkpoint.refreshBy <= now
	) {
		throw new Error("Free20 checkpoint does not match the active request");
	}
	if (previous) {
		validateFree20RoomBudget(previous);
		if (
			!sameRoom(previous.checkpoint, binding) ||
			previous.checkpoint.utcDay > binding.utcDay ||
			previous.checkpoint.checkpointSequence >= checkpoint.checkpointSequence ||
			previous.checkpoint.serverTime > checkpoint.serverTime ||
			(previous.checkpoint.utcDay === binding.utcDay &&
				meter.acknowledgedSeconds < previous.acknowledgedSeconds)
		) {
			throw new Error("Stale Free20 checkpoint");
		}
	}
	const pending = roomUsageBuckets(meter);
	if (
		pending.length !== request.usage.length ||
		pending.some(
			(bucket) =>
				!request.usage.some(
					(sent) => sent.day === bucket.day && sent.seconds === bucket.seconds,
				),
		)
	) {
		throw new Error("Free20 request differs from the durable meter checkpoint");
	}
	if (
		checkpoint.acknowledged.length !== request.usage.length ||
		request.usage.some(
			(sent) =>
				!checkpoint.acknowledged.some(
					(ack) => ack.day === sent.day && ack.seconds === sent.seconds,
				),
		)
	) {
		// A server cumulative ACK ahead of this durable checkpoint is uncertainty,
		// not extra credit. Never clamp it and then subtract an unrelated ledger.
		throw new Error("Incomplete or inconsistent Free20 usage acknowledgement");
	}
	let next = meter;
	for (const ack of checkpoint.acknowledged)
		next = acknowledgeRoomUsageDay(next, ack.day, ack.seconds);
	if (
		next.pending.length ||
		checkpoint.committedSeconds < next.acknowledgedSeconds
	) {
		throw new Error("Inconsistent Free20 account usage");
	}
	const allowed = Math.max(
		0,
		1200 - checkpoint.committedSeconds + next.acknowledgedSeconds,
	);
	return {
		meter: next,
		budget: {
			checkpoint,
			acknowledgedSeconds: next.acknowledgedSeconds,
			allowedSeconds:
				previous?.checkpoint.utcDay === checkpoint.utcDay
					? Math.min(previous.allowedSeconds, allowed)
					: allowed,
		},
	};
}

/** A finite time view from the existing meter, not the public room snapshot or
 * an admission decision. No writes, polling, scheduling, or client clock input.
 */
export function readFree20RoomTime(
	budget: Free20RoomBudget,
	meter: RoomMeterState,
	now: number,
) {
	validateFree20RoomBudget(budget);
	validMeter(meter, budget.checkpoint.utcDay, now);
	if (
		meter.pending.length ||
		meter.acknowledgedSeconds < budget.acknowledgedSeconds ||
		now < budget.checkpoint.serverTime ||
		now >= budget.checkpoint.refreshBy
	) {
		throw new Error("Free20 authority requires refresh");
	}
	const remainingSeconds = Math.max(
		0,
		budget.allowedSeconds - roomUsageSummary(meter, now).seconds,
	);
	return {
		kind: "daily_free" as const,
		budgetSeconds: 1200 as const,
		usedSeconds: 1200 - remainingSeconds,
		remainingSeconds,
		metering: meter.activeSince !== null,
	};
}
