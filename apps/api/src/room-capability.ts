import {
	type RoomMediaCapabilityLease,
 type RoomEndReason,
	ROOM_MEDIA_CAPABILITY_END_GRACE_MS,
	ROOM_MEDIA_CAPABILITY_RENEW_BEFORE_MS,
} from "@anidachi/protocol";
export const ROOM_POLICY_STORAGE_KEY = "room_policy_v2";
export type RoomPolicyState = {
	schemaVersion: 2;
	hostId: string;
	lease: RoomMediaCapabilityLease;
	refreshAt: number;
	closingAt: number | null;
 endingReason:RoomEndReason|null;
	budget: { day: string; allowedSeconds: number } | null;
	quotaWarnedDay: string | null;
	alarmAt: number;
};
export function initialRoomPolicy(
	hostId: string,
	lease: RoomMediaCapabilityLease,
	now: number,
): RoomPolicyState {
	return {
		schemaVersion: 2,
		hostId,
		lease,
		refreshAt: now,
		closingAt: null,
 endingReason:null,
		budget: null,
		quotaWarnedDay: null,
		alarmAt: now,
	};
}
export function failRoomPolicy(
	state: RoomPolicyState,
	now: number,
): RoomPolicyState {
	return {
		...state,
		closingAt: state.closingAt ?? now + ROOM_MEDIA_CAPABILITY_END_GRACE_MS,
		refreshAt: now + 60_000,
	};
}
export function renewRoomPolicy(
	state: RoomPolicyState,
	lease: RoomMediaCapabilityLease,
): RoomPolicyState {
	const old = state.lease;
	if (
		state.closingAt ||
		lease.roomId !== old.roomId ||
		lease.roomGeneration !== old.roomGeneration ||
		lease.capabilities.hostPlanCode !== old.capabilities.hostPlanCode ||
		lease.capabilities.capabilityRevision <= old.capabilities.capabilityRevision
	)
		return state;
	return {
		...state,
		lease,
		refreshAt: Math.max(
			Date.parse(lease.issuedAt) + 60_000,
			Date.parse(lease.capabilities.capabilitiesValidUntil) -
				ROOM_MEDIA_CAPABILITY_RENEW_BEFORE_MS,
		),
	};
}
export function nextRoomPolicyAlarm(
	state: RoomPolicyState,
	now: number,
	meter: { day: string; seconds: number },
	active: boolean,
): number {
	const expiry = Date.parse(state.lease.capabilities.capabilitiesValidUntil);
	const candidates = state.closingAt
		? [state.closingAt]
		: [state.refreshAt, expiry];
	if (state.lease.capabilities.hostPlanCode === "free") {
		const midnight = (Math.floor(now / 86400000) + 1) * 86400000;
		candidates.push(midnight);
		if (!state.budget || state.budget.day !== meter.day) candidates.push(now);
		else if (active) {
			const remaining = state.budget.allowedSeconds - meter.seconds;
			candidates.push(now + Math.max(0, remaining) * 1000);
			if (state.quotaWarnedDay !== meter.day)
				candidates.push(now + Math.max(0, remaining - 300) * 1000);
		}
	}
	return Math.max(now, Math.min(...candidates));
}
