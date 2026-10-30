import {
	Free20RoomBudgetRequestSchema,
	type Free20RoomBudgetRequest,
	type HostingTimeBinding,
	type RoomUsageSummary,
} from "@anidachi/protocol";
import {
	type Free20RoomBudget,
	reconcileFree20RoomBudget,
	validateFree20RoomBudget,
} from "./free20-room-budget";
import {
	acknowledgeRoomUsageDay,
	parseRoomMeterState,
	type RoomMeterState,
	roomUsageBuckets,
} from "./room-metering";

export type Free20AccountingState = {
	schemaVersion: 1;
	sequence: number;
	pending: Free20RoomBudgetRequest | null;
	budget: Free20RoomBudget | null;
};

export function createFree20AccountingState(): Free20AccountingState {
	return { schemaVersion: 1, sequence: 0, pending: null, budget: null };
}

/** A missing row selects legacy accounting; an invalid row must never do so. */
export function parseFree20AccountingState(
	value: unknown,
	meter: RoomMeterState,
): Free20AccountingState {
	if (
		!value ||
		typeof value !== "object" ||
		Array.isArray(value) ||
		!parseRoomMeterState(meter)
	)
		throw new Error("Invalid durable Free20 accounting");
	const state = value as Free20AccountingState;
	if (
		state.schemaVersion !== 1 ||
		!Number.isSafeInteger(state.sequence) ||
		state.sequence < 0 ||
		state.pending === undefined ||
		state.budget === undefined
	)
		throw new Error("Invalid durable Free20 accounting");
	if (state.pending !== null) {
		const request = Free20RoomBudgetRequestSchema.parse(state.pending);
		if (request.checkpointSequence !== state.sequence || state.sequence === 0)
			throw new Error("Invalid durable Free20 sequence");
		const buckets = roomUsageBuckets(meter);
		if (
			request.usage.some(
				(sent) =>
					!buckets.some(
						(current) =>
							current.day === sent.day && current.seconds >= sent.seconds,
					),
			)
		)
			throw new Error("Free20 pending request exceeds durable usage");
	}
	if (state.budget !== null) {
		validateFree20RoomBudget(state.budget);
		const previous = state.budget.checkpoint;
		if (
			previous.checkpointSequence > state.sequence ||
			(state.pending &&
				previous.checkpointSequence >= state.pending.checkpointSequence) ||
			meter.day === null ||
			meter.day < previous.utcDay ||
			(meter.day === previous.utcDay &&
				meter.acknowledgedSeconds < state.budget.acknowledgedSeconds)
		)
			throw new Error("Torn durable Free20 accounting");
	}
	return state;
}

/** Replacing a lost request is safe only with a higher sequence and cumulative
 * buckets that still cover everything unacknowledged. The caller persists this
 * state AND the materialized meter atomically before sending it. */
export function prepareFree20Accounting(
	state: Free20AccountingState,
	meter: RoomMeterState,
	room: Pick<HostingTimeBinding, "roomId" | "roomGeneration">,
): Free20AccountingState {
	parseFree20AccountingState(state, meter);
	if (meter.accountingBlocked || state.sequence === Number.MAX_SAFE_INTEGER)
		throw new Error("Free20 accounting unavailable");
	if (
		state.pending &&
		(state.pending.roomId !== room.roomId ||
			state.pending.roomGeneration !== room.roomGeneration)
	)
		throw new Error("Free20 pending request belongs to another room");
	const sequence = state.sequence + 1;
	return {
		...state,
		sequence,
		pending: Free20RoomBudgetRequestSchema.parse({
			roomId: room.roomId,
			roomGeneration: room.roomGeneration,
			checkpointSequence: sequence,
			usage: roomUsageBuckets(meter),
		}),
	};
}

export function acknowledgeFree20Accounting(
	state: Free20AccountingState,
	meter: RoomMeterState,
	checkpoint: unknown,
	binding: HostingTimeBinding,
	now: number,
): { state: Free20AccountingState; meter: RoomMeterState } {
	parseFree20AccountingState(state, meter);
	if (!state.pending) throw new Error("No pending Free20 request");
	const next = reconcileFree20RoomBudget(checkpoint, {
		binding,
		request: state.pending,
		meter,
		previous: state.budget,
		now,
	});
	return {
		state: { ...state, pending: null, budget: next.budget },
		meter: next.meter,
	};
}

/** Terminal ACKs settle usage only; they cannot issue a new live budget. */
export function settleFree20Accounting(
	state: Free20AccountingState,
	meter: RoomMeterState,
	acknowledged: RoomUsageSummary[],
): { state: Free20AccountingState; meter: RoomMeterState } {
	parseFree20AccountingState(state, meter);
	const sent = state.pending?.usage;
	if (
		!sent ||
		sent.length !== acknowledged.length ||
		sent.some(
			(bucket) =>
				!acknowledged.some(
					(ack) => ack.day === bucket.day && ack.seconds === bucket.seconds,
				),
		)
	)
		throw new Error("Incomplete Free20 terminal acknowledgement");
	let next = meter;
	for (const ack of acknowledged)
		next = acknowledgeRoomUsageDay(next, ack.day, ack.seconds);
	if (roomUsageBuckets(next).length || next.accountingBlocked)
		throw new Error("Unsettled Free20 usage");
	return { state: { ...state, pending: null, budget: null }, meter: next };
}
