import {
	WatchHistoryAccessSchema,
	type WatchHistoryAccess,
} from "@anidachi/protocol";

/** Absolute server authority, persisted as issued. Network time consumes the lease. */
export type WatchHistoryLease = {
	access: WatchHistoryAccess;
	requestedAt: number;
	receivedAt: number;
	expiresAt: number;
	checkedAt?: number;
};

export function createWatchHistoryLease(
	raw: unknown,
	owner: string,
	requestedAt: number,
	receivedAt: number,
): WatchHistoryLease | null {
	const parsed = WatchHistoryAccessSchema.safeParse(raw);
	if (
		!parsed.success ||
		parsed.data.ownerUserId !== owner ||
		!Number.isFinite(requestedAt) ||
		!Number.isFinite(receivedAt) ||
		receivedAt < requestedAt
	)
		return null;
	const expiresAt =
		requestedAt +
		Date.parse(parsed.data.validUntil) -
		Date.parse(parsed.data.serverTime);
	return receivedAt >= expiresAt
		? null
		: { access: parsed.data, requestedAt, receivedAt, expiresAt };
}

export function parseWatchHistoryLease(
	value: unknown,
): WatchHistoryLease | null {
	if (!value || typeof value !== "object") return null;
	const lease = value as WatchHistoryLease;
	const parsed = WatchHistoryAccessSchema.safeParse(lease.access);
	if (!parsed.success) return null;
	const valid = createWatchHistoryLease(
		parsed.data,
		parsed.data.ownerUserId,
		lease.requestedAt,
		lease.receivedAt,
	);
	return valid?.expiresAt === lease.expiresAt &&
		(lease.checkedAt === undefined ||
			(Number.isFinite(lease.checkedAt) &&
				lease.checkedAt >= lease.receivedAt &&
				lease.checkedAt < lease.expiresAt))
		? {
				...valid,
				...(lease.checkedAt === undefined
					? {}
					: { checkedAt: lease.checkedAt }),
			}
		: null;
}

export function canCaptureWatchHistory(
	lease: WatchHistoryLease | null | undefined,
	owner: string,
	now: number,
	provider?: string,
): boolean {
	return (
		!!lease &&
		lease.access.ownerUserId === owner &&
		lease.access.state === "allowed" &&
		Number.isFinite(now) &&
		now >= (lease.checkedAt ?? lease.receivedAt) &&
		now < lease.expiresAt &&
		(provider !== "youtube" || lease.access.youtubeHistoryEnabled)
	);
}

export function historyServerTime(
	lease: WatchHistoryLease,
	now: number,
): number {
	return (
		Date.parse(lease.access.serverTime) + Math.max(0, now - lease.requestedAt)
	);
}

export function personalEnvelopeEligible(
	envelope: {
		captureVersion: number;
		accessEpoch: number;
		youtubeConsentEpoch: number;
		event: { accountGeneration: number; provider: string };
	},
	lease: WatchHistoryLease | null | undefined,
	owner: string,
	now: number,
): boolean {
	return (
		canCaptureWatchHistory(lease, owner, now, envelope.event.provider) &&
		!!lease &&
		envelope.captureVersion === 1 &&
		envelope.event.accountGeneration === lease.access.accountGeneration &&
		envelope.accessEpoch === lease.access.accessEpoch &&
		(envelope.event.provider !== "youtube" ||
			envelope.youtubeConsentEpoch === lease.access.youtubeConsentEpoch)
	);
}
