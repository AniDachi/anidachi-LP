import {
  RoomUsageSummarySchema,
  type RoomUsageSummary,
} from "@anidachi/protocol";
const DAY_MS = 86_400_000;
export const MAX_PENDING_USAGE_DAYS = 2;
export interface RoomMeterState {
	schemaVersion: 2;
  accumulatedMs: number;
  activeSince: number | null;
  day: string | null;
	acknowledgedSeconds: number;
	pending: RoomUsageSummary[];
	accountingBlocked: boolean;
}
export function createRoomMeterState(): RoomMeterState {
  return {
		schemaVersion: 2,
    accumulatedMs: 0,
    activeSince: null,
    day: null,
		acknowledgedSeconds: 0,
		pending: [],
		accountingBlocked: false,
  };
}
/** Advance a single interval across UTC boundaries. Cumulative values are never
 * removed until the durable control plane acknowledges the exact room/day value. */
export function reconcileRoomMeter(
  state: RoomMeterState,
  shouldMeter: boolean,
  now: number,
): RoomMeterState {
	const safeNow = validTime(now) ? now : 0;
	if (state.accountingBlocked) return state;
	if (
		state.activeSince !== null &&
		shouldMeter &&
		utcDay(safeNow) === state.day
	)
		return state;
	let next = { ...state, pending: [...state.pending] };
	let cursor = state.activeSince;
	while (cursor !== null && cursor < safeNow) {
		const boundary = (Math.floor(cursor / DAY_MS) + 1) * DAY_MS;
		const until = Math.min(boundary, safeNow);
		next.accumulatedMs = Math.min(DAY_MS, next.accumulatedMs + until - cursor);
		cursor = until;
		if (until === boundary) {
			if (next.accumulatedMs / 1000 > next.acknowledgedSeconds) {
				if (next.pending.length >= MAX_PENDING_USAGE_DAYS - 1)
					return { ...next, activeSince: null, accountingBlocked: true };
				next.pending.push({
					day: next.day ?? utcDay(until - 1),
					seconds: Math.floor(next.accumulatedMs / 1000),
				});
  }
			next.day = utcDay(boundary);
			next.accumulatedMs = 0;
			next.acknowledgedSeconds = 0;
}
	}
	if (state.activeSince === null && next.day !== utcDay(safeNow)) {
		if (
			next.day &&
			Math.floor(next.accumulatedMs / 1000) > next.acknowledgedSeconds
		) {
			if (next.pending.length >= MAX_PENDING_USAGE_DAYS - 1)
				return { ...next, activeSince: null, accountingBlocked: true };
			next.pending.push({
				day: next.day,
				seconds: Math.floor(next.accumulatedMs / 1000),
			});
		}
		next.day = utcDay(safeNow);
		next.accumulatedMs = 0;
		next.acknowledgedSeconds = 0;
	}
	next.activeSince = shouldMeter
		? Math.max(safeNow, state.activeSince ?? 0)
		: null;
	return next;
}
export function roomUsageSummary(
  state: RoomMeterState,
  now: number,
): RoomUsageSummary {
	const settled = reconcileRoomMeter(state, false, now);
  return {
		day: settled.day ?? utcDay(now),
		seconds: Math.floor(settled.accumulatedMs / 1000),
	};
}
export function roomUsageBuckets(state: RoomMeterState): RoomUsageSummary[] {
	return [
		...state.pending,
		...(state.day &&
		Math.floor(state.accumulatedMs / 1000) > state.acknowledgedSeconds
			? [{ day: state.day, seconds: Math.floor(state.accumulatedMs / 1000) }]
			: []),
	];
}
export function acknowledgeRoomUsageDay(
	state: RoomMeterState,
	day: string,
	seconds: number,
): RoomMeterState {
	const pending = state.pending.filter(
		(bucket) => bucket.day !== day || bucket.seconds > seconds,
	);
	return {
		...state,
		pending,
		acknowledgedSeconds:
			day === state.day
				? Math.max(
						state.acknowledgedSeconds,
						Math.min(seconds, Math.floor(state.accumulatedMs / 1000)),
					)
				: state.acknowledgedSeconds,
	};
}
export function parseRoomMeterState(value: unknown): RoomMeterState | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const v = value as Record<string, unknown>;
	if (
		(v.schemaVersion !== 1 && v.schemaVersion !== 2) ||
		!validTime(v.accumulatedMs) ||
		v.accumulatedMs > DAY_MS ||
		(v.activeSince !== null && !validTime(v.activeSince)) ||
		(v.day !== null &&
			!RoomUsageSummarySchema.safeParse({ day: v.day, seconds: 0 }).success)
	)
		return null;
	const base = {
		...createRoomMeterState(),
		accumulatedMs: v.accumulatedMs,
		activeSince: v.activeSince as number | null,
		day: v.day as string | null,
	};
	if (v.schemaVersion === 1) return base;
	if (
		!validTime(v.acknowledgedSeconds) ||
		v.acknowledgedSeconds > Math.floor(v.accumulatedMs / 1000) ||
		typeof v.accountingBlocked !== "boolean" ||
		!Array.isArray(v.pending) ||
		v.pending.length >= MAX_PENDING_USAGE_DAYS
	)
		return null;
	const pending: RoomUsageSummary[] = [];
	for (const item of v.pending) {
		const parsed = RoomUsageSummarySchema.safeParse(item);
		if (
			!parsed.success ||
			parsed.data.day === v.day ||
			pending.some((b) => b.day === parsed.data.day)
		)
			return null;
		pending.push(parsed.data);
	}
	return {
		...base,
		acknowledgedSeconds: v.acknowledgedSeconds,
		accountingBlocked: v.accountingBlocked,
		pending,
	};
}
function validTime(v: unknown): v is number {
	return Number.isSafeInteger(v) && (v as number) >= 0;
}
function utcDay(now: number): string {
	return new Date(now).toISOString().slice(0, 10);
}

/** Existing room tokens retain their v1 single-day behavior until natural drain. */
export function reconcileLegacyRoomMeter(
	state: RoomMeterState,
	active: boolean,
	now: number,
): RoomMeterState {
	if (active) {
		return state.activeSince !== null
			? state
			: { ...state, activeSince: now, day: state.day ?? utcDay(now) };
	}
	return state.activeSince === null
		? state
		: {
				...state,
				activeSince: null,
				accumulatedMs: Math.min(
					DAY_MS,
					state.accumulatedMs + Math.max(0, now - state.activeSince),
    ),
  };
}
