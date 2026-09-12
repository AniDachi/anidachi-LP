import {
	ROOM_PRESENCE_MAX_AGE_MS,
	RoomPresenceEvidenceSchema,
	type RoomPresenceEvidence,
} from "@anidachi/protocol";

export const ROOM_PRESENCE_STORAGE_KEY = "room_presence_pending_v1";
export const MAX_PRESENCE_PENDING = 105;
export const MAX_PRESENCE_ATTEMPTS = 8;
export interface PresencePending {
	evidence: RoomPresenceEvidence;
	attempts: number;
	nextAttemptAt: number;
}
export interface PresenceState {
	schemaVersion: 1;
	pending: PresencePending[];
	overflow: number;
}
const key = (e: RoomPresenceEvidence) =>
	`${e.roomId}:${e.roomGeneration}:${e.participants.map((p) => p.userId).join(":")}`;
export function presencePairs(
	roomId: string,
	roomGeneration: number,
	participants: RoomPresenceEvidence["participants"][number][],
	observedAt: number,
): RoomPresenceEvidence[] {
	const distinct = [
		...new Map(participants.map((p) => [p.userId, p])).values(),
	].sort((a, b) => a.userId.localeCompare(b.userId));
	const pairs: RoomPresenceEvidence[] = [];
	for (let i = 0; i < distinct.length; i++)
		for (let j = i + 1; j < distinct.length; j++) {
			const parsed = RoomPresenceEvidenceSchema.safeParse({
				roomId,
				roomGeneration,
				participants: [distinct[i], distinct[j]],
				observedAt,
			});
			if (parsed.success) pairs.push(parsed.data);
		}
	return pairs;
}
export function parsePresenceState(raw: unknown): PresenceState | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const s = raw as PresenceState;
	if (
		s.schemaVersion !== 1 ||
		!Number.isSafeInteger(s.overflow) ||
		s.overflow < 0 ||
		!Array.isArray(s.pending) ||
		s.pending.length > MAX_PRESENCE_PENDING
	)
		return undefined;
	if (
		s.pending.some(
			(p) =>
				!p ||
				typeof p !== "object" ||
				!RoomPresenceEvidenceSchema.safeParse(p.evidence).success ||
				!Number.isSafeInteger(p.attempts) ||
				p.attempts < 0 ||
				p.attempts > MAX_PRESENCE_ATTEMPTS ||
				!Number.isSafeInteger(p.nextAttemptAt) ||
				p.nextAttemptAt < 0,
		)
	)
		return undefined;
	return s;
}
export function coalescePresence(
	raw: PresenceState | undefined,
	evidence: RoomPresenceEvidence[],
	now: number,
): PresenceState {
	const state: PresenceState = {
		schemaVersion: 1,
		pending: raw?.pending.slice() ?? [],
		overflow: raw?.overflow ?? 0,
	};
	for (const input of evidence) {
		const e = RoomPresenceEvidenceSchema.parse(input);
		const index = state.pending.findIndex((p) => key(p.evidence) === key(e));
		if (index >= 0 && state.pending[index]!.evidence.observedAt >= e.observedAt)
			continue;
		if (index >= 0) state.pending.splice(index, 1);
		state.pending.push({ evidence: e, attempts: 0, nextAttemptAt: now });
	}
	state.pending.sort((a, b) => a.evidence.observedAt - b.evidence.observedAt);
	if (state.pending.length > MAX_PRESENCE_PENDING) {
		state.overflow = Math.min(
			Number.MAX_SAFE_INTEGER,
			state.overflow + state.pending.length - MAX_PRESENCE_PENDING,
		);
		state.pending.splice(0, state.pending.length - MAX_PRESENCE_PENDING);
	}
	return state;
}
export function claimPresence(
	raw: PresenceState,
	now: number,
): { state: PresenceState; claimed: PresencePending[] } {
	const claimed: PresencePending[] = [];
	const pending = raw.pending
		.filter(
			(p) =>
				now - p.evidence.observedAt <= ROOM_PRESENCE_MAX_AGE_MS &&
				!(p.attempts >= MAX_PRESENCE_ATTEMPTS && p.nextAttemptAt <= now),
		)
		.map((p) => {
			if (p.nextAttemptAt > now) return p;
			// At most four network operations per durable claim; defer the rest so an
			// unresolved callback cannot cause a due-alarm spin or unbounded fanout.
			if (claimed.length >= 4) return { ...p, nextAttemptAt: now + 10_000 };
			const next = {
				...p,
				attempts: p.attempts + 1,
				nextAttemptAt: now + 8_000 + Math.min(300_000, 5_000 * 2 ** p.attempts),
			};
			claimed.push(next);
			return next;
		});
	return { state: { ...raw, pending }, claimed };
}
export function acknowledgePresence(
	state: PresenceState,
	claim: PresencePending,
): PresenceState {
	return {
		...state,
		pending: state.pending.filter(
			(p) => JSON.stringify(p.evidence) !== JSON.stringify(claim.evidence),
		),
	};
}
export function nextPresenceAlarm(raw: unknown): number | null {
	const state = parsePresenceState(raw);
	return state?.pending.length
		? Math.min(
				...state.pending.map((p) =>
					Math.min(
						p.nextAttemptAt,
						p.evidence.observedAt + ROOM_PRESENCE_MAX_AGE_MS + 1,
					),
				),
			)
		: null;
}
