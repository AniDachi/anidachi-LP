import assert from "node:assert/strict";
import test from "node:test";
import { applyPersonalWatchProgress } from "./personal-watch-history";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const NOW = "2026-09-08T00:00:00.000Z";
function progressEvent(overrides: Record<string, unknown> = {}) {
	return {
		schemaVersion: 3,
		clientEventId: EVENT_ID,
		clientSessionKey: "solo-session-one",
		accountGeneration: 1,
		provider: "crunchyroll",
		titleKey: "crunchyroll:series:SERIESONE",
		itemKind: "series",
		title: "Series One",
		artworkUrl: null,
		episodeKey: "crunchyroll:episode:EPISODEONE",
		episodeTitle: "Episode One",
		seasonKey: "crunchyroll:season:SEASONONE",
		seasonTitle: "Season One",
		seasonNumber: 1,
		episodeNumber: 1,
		sourceUrl: "https://www.crunchyroll.com/watch/CONTENTONE",
		currentTime: 600,
		duration: 1_200,
		progress: 0.5,
		observedAt: NOW,
		kind: "pause",
		crunchyrollIdentity: {
			providerSeriesId: "SERIESONE",
			providerSeasonIdentifier: "SEASONONE",
			providerEpisodeIdentifier: "EPISODEONE",
			providerContentId: "CONTENTONE",
			audioLocale: "ja-JP",
		},
		...overrides,
	};
}

const catalogContext = {
	region: "US",
	requestedLocale: "en-US",
	audioLocale: "ja-JP",
	subtitleLocales: ["en-US"],
	observedAt: NOW,
};

const envelope = () => ({
	captureVersion: 1,
	accessEpoch: 1,
	youtubeConsentEpoch: 0,
	clientSequence: 1,
	event: progressEvent(),
});
test("personal writer does not request host authority and preserves own envelope", async () => {
	let received: unknown;
	await assert.rejects(
		applyPersonalWatchProgress({
			userId: USER_ID,
			input: envelope(),
			store: {
				async apply(userId, input) {
					assert.equal(userId, USER_ID);
					received = input;
					throw { message: "HISTORY_PLAN_REQUIRED" };
				},
			},
		}),
		{ status: 403, code: "HISTORY_PLAN_REQUIRED" },
	);
	assert.deepEqual(received, envelope());
});
test("personal writer rejects legacy and shared bodies before persistence", async () => {
	const store = {
		async apply() {
			throw Error("must not call");
		},
	};
	await assert.rejects(
		applyPersonalWatchProgress({
			userId: USER_ID,
			input: progressEvent(),
			store,
		}),
		{ status: 426, code: "HISTORY_CLIENT_UPDATE_REQUIRED" },
	);
	await assert.rejects(
		applyPersonalWatchProgress({
			userId: USER_ID,
			input: { ...envelope(), event: { ...progressEvent(), sharedRoom: null } },
			store,
		}),
		{ status: 400 },
	);
});
test("receipt replay errors remain access errors, never fallback", async () => {
	for (const [message, status] of [
		["HISTORY_ACCESS_CHANGED", 409],
		["HISTORY_ACCESS_UNAVAILABLE", 503],
	] as const) {
		await assert.rejects(
			applyPersonalWatchProgress({
				userId: USER_ID,
				input: envelope(),
				store: {
					async apply() {
						throw { message };
					},
				},
			}),
			{ status, code: message },
		);
	}
});
