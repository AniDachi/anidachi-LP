import { createWatchHistoryLease } from "../src/watch-history-access";
export const historyOwner = "00000000-0000-4000-8000-000000000001";
const fixtureNow = Date.now() - 1_000;
export function paidHistoryLease(
	owner = historyOwner,
	now = fixtureNow,
	generation = 1,
	youtubeHistoryEnabled = true,
) {
	return createWatchHistoryLease(
		{
			accessVersion: 1,
			ownerUserId: owner,
			accountGeneration: generation,
			accessEpoch: 1,
			youtubeConsentEpoch: 1,
			state: "allowed",
			serverTime: new Date(now).toISOString(),
			captureNotBefore: new Date(now - 1_000).toISOString(),
			validUntil: new Date(now + 300_000).toISOString(),
			youtubeHistoryEnabled,
		},
		owner,
		now,
		now,
	)!;
}
