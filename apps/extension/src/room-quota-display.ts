import type { RoomUsageSummary, RoomQuotaSnapshot } from "@anidachi/protocol";

export interface RoomUsageDisplayAnchor {
	roomUsage: RoomUsageSummary | null;
	localMeteredMs: number;
}

export function roomQuotaRemainingSeconds(params: {
	serverRemainingSeconds: number;
	resetAt: string;
	roomUsage: RoomUsageSummary | null;
	localMeteredMs: number;
}): number {
	const serverRemainingSeconds = nonnegative(params.serverRemainingSeconds);
	const usageMatchesQuotaDay =
		params.roomUsage === null ||
		params.roomUsage.day === quotaDayFromResetAt(params.resetAt);
	const roomUsageSeconds = usageMatchesQuotaDay
		? nonnegative(params.roomUsage?.seconds ?? 0)
		: 0;
	const localMeteredSeconds = nonnegative(params.localMeteredMs) / 1_000;
	return Math.max(
		0,
		Math.floor(serverRemainingSeconds - roomUsageSeconds - localMeteredSeconds),
	);
}

export function applyRoomUsageSnapshot(
	current: RoomUsageDisplayAnchor,
	incoming: RoomUsageSummary | undefined,
): RoomUsageDisplayAnchor {
	if (!incoming || !isNewerRoomUsage(current.roomUsage, incoming)) {
		return current;
	}
	return { roomUsage: incoming, localMeteredMs: 0 };
}

function isNewerRoomUsage(
	current: RoomUsageSummary | null,
	incoming: RoomUsageSummary,
): boolean {
	if (!current) return true;
	if (current.day === incoming.day) return incoming.seconds > current.seconds;
	return current.seconds === 0;
}

function quotaDayFromResetAt(resetAt: string): string | null {
	const resetAtMs = Date.parse(resetAt);
	if (!Number.isFinite(resetAtMs) || resetAtMs <= 0) return null;
	return new Date(resetAtMs - 1).toISOString().slice(0, 10);
}

function nonnegative(value: number): number {
	return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export interface AuthoritativeQuotaAnchor {
	quota: RoomQuotaSnapshot;
	serverSeq: number;
  minimumDay?: string;
}

/** Accept quota independently of source changes, but never rewind its room clock. */
export function acceptAuthoritativeQuota(
	current: AuthoritativeQuotaAnchor | null,
	quota: RoomQuotaSnapshot,
	serverSeq: number,
): AuthoritativeQuotaAnchor | null {
	if (
		current &&
		(serverSeq < current.serverSeq ||
			quota.day < (current.minimumDay ?? current.quota.day) ||
			quota.measuredAt < current.quota.measuredAt ||
			(serverSeq === current.serverSeq &&
				JSON.stringify(quota) === JSON.stringify(current.quota)))
	)
		return current;
	return { quota, serverSeq };
}

export function authoritativeQuotaRemainingSeconds(
	quota: RoomQuotaSnapshot | null,
	localMeteredMs: number,
): number | null {
	if (!quota) return null;
	return Math.max(
		0,
		Math.floor(
			quota.remainingSeconds -
				(quota.metering ? nonnegative(localMeteredMs) / 1000 : 0),
		),
	);
}
