import assert from "node:assert/strict";
import test from "node:test";
import {
	buildWatchHistoryV3Response,
	parseWatchProgressEventV3,
} from "./watch-history-v3";
import { applyPersonalWatchProgress } from "./personal-watch-history";
const owner = "11111111-1111-4111-8111-111111111111",
	eventId = "22222222-2222-4222-8222-222222222222";
const now = "2026-10-08T00:00:00.000Z";
function event(movie = false) {
	const id = movie
		? "AAAAAAAAAAAAAAAAAAAAAAAAAA"
		: "BBBBBBBBBBBBBBBBBBBBBBBBBB";
	return {
		schemaVersion: 3,
		clientEventId: eventId,
		clientSessionKey: "primevideo-session",
		accountGeneration: 1,
		provider: "primevideo",
		titleKey: movie
			? `primevideo:movie:${id}`
			: "primevideo:series:CCCCCCCCCCCCCCCCCCCCCCCCCC",
		episodeKey: `primevideo:${movie ? "movie" : "episode"}:${id}`,
		itemKind: movie ? "movie" : "series",
		title: movie ? "El Camino" : "Breaking Bad",
		episodeTitle: "Title",
		seasonKey: movie ? null : "primevideo:season:DDDDDDDDDDDDDDDDDDDDDDDDDD",
		seasonTitle: movie ? null : "Season 2",
		seasonNumber: movie ? null : 2,
		episodeNumber: movie ? null : 1,
		artworkUrl: "https://m.media-amazon.com/images/poster.jpg",
		sourceUrl: `https://www.primevideo.com/detail/${id}`,
		currentTime: 300,
		duration: 1800,
		progress: 1 / 6,
		observedAt: now,
		kind: "pause",
		primevideoIdentity: movie
			? { kind: "movie", providerMovieId: id }
			: {
					kind: "episode",
					seriesAnchorSeasonId: "CCCCCCCCCCCCCCCCCCCCCCCCCC",
					providerSeasonIdentifier: "DDDDDDDDDDDDDDDDDDDDDDDDDD",
					providerEpisodeIdentifier: id,
				},
	};
}
test("server accepts Prime Video movie and episode events and builds canonical personal history", () => {
	for (const movie of [false, true]) {
		const e = parseWatchProgressEventV3(event(movie));
		const row = {
			user_id: owner,
			provider: e.provider,
			title_key: e.titleKey,
			episode_key: e.episodeKey,
			item_kind: e.itemKind,
			title: e.title,
			artwork_url: e.artworkUrl,
			episode_title: e.episodeTitle,
			season_key: e.seasonKey,
			season_title: e.seasonTitle,
			season_number: e.seasonNumber,
			episode_number: e.episodeNumber,
			source_url: e.sourceUrl,
			current_time_seconds: e.currentTime,
			duration: e.duration,
			progress: e.progress,
			completed_at: null,
			latest_session_id: null,
			observed_at: now,
			server_order: 1,
			history_generation: 1,
		};
		const result = buildWatchHistoryV3Response({
			userId: owner,
			accountGeneration: 1,
			progressRows: [row],
			sessions: [],
			limit: 20,
			generatedAt: new Date(now),
		});
		assert.equal(result.items[0]!.provider, "primevideo");
		assert.equal(result.items[0]!.sourceUrl, e.sourceUrl);
		assert.equal(result.items[0]!.itemKind, e.itemKind);
		assert.equal(result.items[0]!.seasons.length, movie ? 0 : 1);
	}
});
test("both personal and legacy parsers reject untrusted Prime Video artwork before persistence", async () => {
	for (const artworkUrl of [
		"https://127.0.0.1/a",
		"https://m.media-amazon.com.evil.test/images/a",
		"https://user@m.media-amazon.com/images/a",
	]) {
		const e = { ...event(), artworkUrl };
		assert.throws(() => parseWatchProgressEventV3(e), {
			code: "INVALID_REQUEST",
		});
		await assert.rejects(
			applyPersonalWatchProgress({
				userId: owner,
				input: {
					captureVersion: 1,
					accessEpoch: 1,
					youtubeConsentEpoch: 0,
					clientSequence: 1,
					event: e,
				},
				store: {
					apply: async () => {
						throw Error("must not persist");
					},
				},
			}),
			{ code: "INVALID_REQUEST" },
		);
	}
});

test("Prime artwork allows only exact observed hosts under images", () => {
	for (const host of ["images-na.ssl-images-amazon.com", "m.media-amazon.com"])
		assert.doesNotThrow(() =>
			parseWatchProgressEventV3({
				...event(),
				artworkUrl: `https://${host}/images/I/poster.jpg?x=1`,
			}),
		);
	for (const artworkUrl of [
		"http://m.media-amazon.com/images/a",
		"https://m.media-amazon.com:443/images/a",
		"https://m.media-amazon.com/images/a#fragment",
		"https://m.media-amazon.com/outside/a",
		"https://m.media-amazon.com/images/../../outside",
		"https://images.amazon.com/images/a",
		"https://m.media-amazon.com./images/a",
	])
		assert.throws(() => parseWatchProgressEventV3({ ...event(), artworkUrl }), {
			code: "INVALID_REQUEST",
		});
});

test("Prime movie identity cannot be relabeled, mixed or point at another episode", () => {
	for (const change of [
		{ provider: "youtube" },
		{ youtubeVideoId: "abcdef" },
		{ netflixIdentity: { kind: "movie", providerMovieId: "123" } },
		{ sourceUrl: `https://www.primevideo.com/detail/${"Z".repeat(26)}` },
		{ primevideoIdentity: { kind: "movie", providerMovieId: "a".repeat(26) } },
	])
		assert.throws(
			() => parseWatchProgressEventV3({ ...event(true), ...change }),
			{ code: "INVALID_REQUEST" },
		);
});

test('durable navigation survives real history builders but legacy HTTP projection strips it', async () => {
 const {primeNavigationResponse}=await import('./prime-navigation-response');
 const e=parseWatchProgressEventV3(event(true));
 const navigation={contentId:'AAAAAAAAAAAAAAAAAAAAAAAAAA',routes:[{url:'https://www.amazon.com/gp/video/detail/B0FX2ZCPFK',observedAt:'2026-11-16T00:00:00Z'}]};
 const row={user_id:owner,provider:e.provider,title_key:e.titleKey,episode_key:e.episodeKey,item_kind:e.itemKind,title:e.title,artwork_url:e.artworkUrl,episode_title:e.episodeTitle,season_key:e.seasonKey,season_title:e.seasonTitle,season_number:e.seasonNumber,episode_number:e.episodeNumber,source_url:e.sourceUrl,prime_navigation:navigation,current_time_seconds:e.currentTime,duration:e.duration,progress:e.progress,completed_at:null,latest_session_id:null,observed_at:now,server_order:1,history_generation:1};
 const result=buildWatchHistoryV3Response({userId:owner,accountGeneration:1,progressRows:[row],sessions:[],limit:20,generatedAt:new Date(now)});
 assert.deepEqual(result.items[0]?.primeNavigation,navigation);
 assert.equal(primeNavigationResponse({headers:new Headers()},result).items[0]?.primeNavigation,undefined);
 assert.deepEqual(primeNavigationResponse({headers:new Headers({'x-anidachi-prime-navigation':'1'})},result).items[0]?.primeNavigation,navigation);
 assert.throws(()=>buildWatchHistoryV3Response({userId:owner,accountGeneration:1,progressRows:[{...row,prime_navigation:{...navigation,contentId:'BBBBBBBBBBBBBBBBBBBBBBBBBB'}}],sessions:[],limit:20,generatedAt:new Date(now)}));
});
