import { expect, it } from "vitest";
import { PersonalWatchProgressRequestSchema } from "../src/personal-watch-history";
import {
	WatchHistoryBrowseQuerySchema,
	getWatchHistoryBrowseSourceModes,
} from "../src/watch-history-browse";
import {
	WatchProgressEventSchema,
	WatchHistoryResponseMetaSchema,
} from "../src/watch-history";
const event = {
	schemaVersion: 3,
	clientEventId: "33333333-3333-4333-8333-333333333333",
	clientSessionKey: "tab:1",
	accountGeneration: 1,
	provider: "youtube",
	titleKey: "youtube:video:abcdefghijk",
	itemKind: "movie",
	title: "Video",
	artworkUrl: null,
	episodeKey: "youtube:video:abcdefghijk",
	episodeTitle: "Video",
	seasonKey: null,
	seasonTitle: null,
	seasonNumber: null,
	episodeNumber: null,
	sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
	youtubeVideoId: "abcdefghijk",
	currentTime: 10,
	duration: 100,
	progress: 0.1,
	observedAt: "2026-09-08T12:00:00Z",
	kind: "heartbeat",
};
const request = {
	captureVersion: 1,
	accessEpoch: 0,
	youtubeConsentEpoch: 0,
	clientSequence: 1,
	event,
};
it("preserves canonical v3 validation inside strict personal envelopes", () => {
	expect(PersonalWatchProgressRequestSchema.safeParse(request).success).toBe(
		true,
	);
	for (const patch of [
		{ captureVersion: 2 },
		{ ownerUserId: "attacker" },
		{ clientSequence: 0 },
		{ clientSequence: Number.MAX_SAFE_INTEGER + 1 },
		{ accessEpoch: -1 },
		{ youtubeConsentEpoch: -1 },
	])
		expect(
			PersonalWatchProgressRequestSchema.safeParse({ ...request, ...patch })
				.success,
		).toBe(false);
	for (const patch of [
		{ sharedRoom: null },
		{ sharedRoom: undefined },
		{ sharedRoom: {} },
		{ schemaVersion: 4 },
		{ ownerUserId: "attacker" },
		{ sourceUrl: "https://www.youtube.com/watch?v=wrong" },
	])
		expect(
			PersonalWatchProgressRequestSchema.safeParse({
				...request,
				event: { ...event, ...patch },
			}).success,
		).toBe(false);
	expect(
		WatchProgressEventSchema.safeParse({ ...event, sharedRoom: null }).success,
	).toBe(true);
	expect(
		WatchHistoryResponseMetaSchema.safeParse({
			schemaVersion: 3,
			ownerUserId: "11111111-1111-4111-8111-111111111111",
			accountGeneration: 1,
			serverTime: event.observedAt,
		}).success,
	).toBe(true);
});
it("personal browsing includes both legacy sources and excludes social filters", () => {
	expect(
		WatchHistoryBrowseQuerySchema.safeParse({ mode: "personal" }).success,
	).toBe(true);
	expect(getWatchHistoryBrowseSourceModes("personal")).toEqual([
		"solo",
		"shared",
	]);
	expect(getWatchHistoryBrowseSourceModes("solo")).toEqual(["solo"]);
	expect(getWatchHistoryBrowseSourceModes("shared")).toEqual(["shared"]);
	for (const field of ["groupId", "participantUserId"])
		expect(
			WatchHistoryBrowseQuerySchema.safeParse({
				mode: "personal",
				[field]: "11111111-1111-4111-8111-111111111111",
			}).success,
		).toBe(false);
});
