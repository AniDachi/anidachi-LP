import {
	type Free20RoomBudgetRequest,
	Free20RoomBudgetRequestSchema,
	Free20RoomTimeCheckpointSchema,
	type Free20RoomUnlimitedCheckpoint,
	Free20RoomUnlimitedCheckpointSchema,
	type HostingTimeBinding,
	HostingTimeBindingSchema,
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
	reconcileRoomMeter,
	roomUsageBuckets,
} from "./room-metering";

export type Free20AccountingState = {
	schemaVersion: 2;
	sequence: number;
	pending: Free20RoomBudgetRequest | null;
	budget: Free20RoomBudget | null;
	unlimited: Free20RoomUnlimitedCheckpoint | null;
};

export function createFree20AccountingState(): Free20AccountingState {
	return {
		schemaVersion: 2,
		sequence: 0,
		pending: null,
		budget: null,
		unlimited: null,
	};
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
	const raw = value as Record<string, unknown>;
	// A schema1 row has no time right. Never let an old-format row hide one.
	if (raw.schemaVersion === 1 && raw.unlimited !== undefined)
		throw new Error("Invalid legacy Free20 accounting");
	const state = (
		raw.schemaVersion === 1
			? { ...raw, schemaVersion: 2, unlimited: null }
			: raw
	) as Free20AccountingState;
	if (
		state.schemaVersion !== 2 ||
		!Number.isSafeInteger(state.sequence) ||
		state.sequence < 0 ||
		state.pending === undefined ||
		state.budget === undefined ||
		state.unlimited === undefined
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
	if (state.unlimited !== null) {
		const right = Free20RoomUnlimitedCheckpointSchema.parse(state.unlimited);
		const dayAck =
			right.acknowledged.find((ack) => ack.day === meter.day)?.seconds ?? 0;
		if (
			state.budget !== null ||
			meter.activeSince !== null ||
			meter.day === null ||
			meter.day < right.utcDay ||
			right.checkpointSequence > state.sequence ||
			(state.pending &&
				right.checkpointSequence >= state.pending.checkpointSequence) ||
			meter.acknowledgedSeconds < dayAck
		)
			throw new Error("Torn durable unlimited time right");
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
	state = parseFree20AccountingState(state, meter);
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
	state = parseFree20AccountingState(state, meter);
	if (!state.pending) throw new Error("No pending Free20 request");
	const previous = state.unlimited ?? state.budget?.checkpoint;
	const incoming = Free20RoomTimeCheckpointSchema.parse(checkpoint);
	const scope = HostingTimeBindingSchema.parse(binding);
	if (
		previous &&
		(previous.ownerUserId !== scope.ownerUserId ||
			previous.roomId !== scope.roomId ||
			previous.roomGeneration !== scope.roomGeneration ||
			previous.utcDay > scope.utcDay ||
			previous.checkpointSequence >= incoming.checkpointSequence ||
			previous.serverTime > incoming.serverTime)
	)
		throw new Error("Stale or rebound Free20 time authority");
	if ("kind" in incoming) {
		const right = incoming;
		const request = state.pending;
		if (
			!Number.isSafeInteger(now) ||
			right.ownerUserId !== scope.ownerUserId ||
			right.roomId !== scope.roomId ||
			right.roomGeneration !== scope.roomGeneration ||
			request.roomId !== scope.roomId ||
			request.roomGeneration !== scope.roomGeneration ||
			right.utcDay !== scope.utcDay ||
			meter.day !== scope.utcDay ||
			new Date(now).toISOString().slice(0, 10) !== scope.utcDay ||
			right.checkpointSequence !== request.checkpointSequence ||
			right.serverTime > now ||
			right.refreshBy <= now ||
			meter.accountingBlocked ||
			(meter.activeSince !== null && meter.activeSince > now)
		)
			throw new Error("Unlimited time right does not match the active request");
		const buckets = roomUsageBuckets(meter);
		if (
			buckets.length !== request.usage.length ||
			request.usage.some(
				(sent) =>
					!buckets.some(
						(bucket) =>
							bucket.day === sent.day && bucket.seconds === sent.seconds,
					),
			)
		)
			throw new Error("Unlimited request differs from durable usage");
		assertExactAcknowledgement(request.usage, right.acknowledged);
		// The authority is applied now. The request ACK covers only time sent
		// before I/O; keep the materialized tail until the next cumulative ACK.
		let closed = reconcileRoomMeter(meter, false, now);
		for (const ack of right.acknowledged)
			closed = acknowledgeRoomUsageDay(closed, ack.day, ack.seconds);
		return {
			meter: closed,
			state: { ...state, budget: null, unlimited: right, pending: null },
		};
	}
	const next = reconcileFree20RoomBudget(incoming, {
		binding,
		request: state.pending,
		meter,
		previous: state.budget,
		now,
	});
	return {
		state: { ...state, pending: null, budget: next.budget, unlimited: null },
		meter: next.meter,
	};
}

/** Terminal ACKs settle usage only; they cannot issue a new live budget. */
export function settleFree20Accounting(
	state: Free20AccountingState,
	meter: RoomMeterState,
	acknowledged: RoomUsageSummary[],
): { state: Free20AccountingState; meter: RoomMeterState } {
	state = parseFree20AccountingState(state, meter);
	const sent = state.pending?.usage;
	if (!sent) throw new Error("No pending Free20 settlement");
	assertExactAcknowledgement(sent, acknowledged);
	let next = meter;
	for (const ack of acknowledged)
		next = acknowledgeRoomUsageDay(next, ack.day, ack.seconds);
	if (roomUsageBuckets(next).length || next.accountingBlocked)
		throw new Error("Unsettled Free20 usage");
	return {
		state: { ...state, pending: null, budget: null, unlimited: null },
		meter: next,
	};
}

function assertExactAcknowledgement(
	sent: RoomUsageSummary[],
	acknowledged: RoomUsageSummary[],
) {
	if (
		sent.length !== acknowledged.length ||
		sent.some(
			(bucket) =>
				!acknowledged.some(
					(ack) => ack.day === bucket.day && ack.seconds === bucket.seconds,
				),
		)
	)
		throw new Error("Incomplete Free20 terminal acknowledgement");
}
