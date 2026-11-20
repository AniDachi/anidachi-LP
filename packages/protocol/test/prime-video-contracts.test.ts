import { describe, expect, it } from "vitest";
import {
	PlaybackStateSchema,
	canonicalizeRoomSourceUrl,
	RoomSourceDescriptorSchema,
	WatchSourceDescriptorSchema,
	WatchProgressEventSchema,
	PersonalWatchProgressRequestSchema,
	WatchCatalogSnapshotInputSchema,
	WatchCatalogBeginRequestSchema,
	WatchCatalogCommitRequestSchema,
	WatchCatalogBeginAckSchema,
	WatchCatalogCommitAckSchema,
	WatchHistoryCapacityV1Schema,
	WatchHistoryCapacityV2Schema,
	WatchHistoryCapacityCompatibleSchema,
	WatchHistoryCapacitySchema,
	WatchHistoryBrowseQuerySchema,
	WatchHistoryBrowseTitleEpisodesQuerySchema,
	WatchHistoryBrowseSessionsQuerySchema,
	WatchHistoryGridQuerySchema,
	WatchHistoryGridResponseSchema,
	WatchHistoryEditorQuerySchema,
	WatchHistoryEditRequestSchema,
	WatchHistoryEditorResponseSchema,
	WatchHistoryItemSchema,
	WatchHistoryTitleEpisodesResponseSchema,
	WatchProviderSchema,
	WatchLibraryItemSchema,
	WatchHistoryBrowseTitleEpisodesResponseSchema,
	WatchHistoryBrowseResponseSchema,
	PrimeVideoProviderIdSchema,
	PrimeVideoHistoryIdentitySchema,
	isPrimeVideoHistoryKey,
	primeVideoHistoryKeys,
	primeVideoSourceUrl,
	primeVideoFingerprint,
	WatchHistoryCapacityV3Schema,
	buildPersonalHistoryResumeUrl,
	parsePersonalHistoryResumeUrl,
} from "../src";

const NOW = "2026-11-16T00:00:00.000Z";
it("preserves the optional host player visit without requiring it from existing clients", () => {
	const state = { videoFingerprint: "primevideo|detail/0CCCCCCCCCCCCCCCCCCCCCCCCC", hostTime: 30, updatedAt: 1, playing: true, playbackRate: 1 };
	expect(PlaybackStateSchema.parse(state)).toEqual(state);
	const visit = { ...state, primePlayerVisit: crypto.randomUUID() };
	expect(PlaybackStateSchema.parse(visit)).toEqual(visit);
	for (const hostSurface of ["player", "catalog"]) {
		expect(PlaybackStateSchema.parse({ ...state, hostSurface }).hostSurface).toBe(hostSurface);
	}
	expect(PlaybackStateSchema.safeParse({ ...state, hostSurface: "unknown" }).success).toBe(false);
	expect(PlaybackStateSchema.safeParse({ ...state, primePlayerVisit: "invalid" }).success).toBe(false);
});
const ID = "11111111-1111-4111-8111-111111111111";
const ANCHOR = "0AAAAAAAAAAAAAAAAAAAAAAAAA";
const SEASON = "0BBBBBBBBBBBBBBBBBBBBBBBBB";
const EPISODE = "0CCCCCCCCCCCCCCCCCCCCCCCCC";
const MOVIE = "0DDDDDDDDDDDDDDDDDDDDDDDDD";
const titleKey = `primevideo:series:${ANCHOR}`;
const seasonKey = `primevideo:season:${SEASON}`;
const episodeKey = `primevideo:episode:${EPISODE}`;
const sourceUrl = `https://www.primevideo.com/detail/${EPISODE}`;
const movieKey = `primevideo:movie:${MOVIE}`;
const movieUrl = `https://www.primevideo.com/detail/${MOVIE}`;
const meta = {
	schemaVersion: 3,
	ownerUserId: ID,
	accountGeneration: 4,
	serverTime: NOW,
};
const identity = {
	kind: "episode",
	seriesAnchorSeasonId: ANCHOR,
	providerSeasonIdentifier: SEASON,
	providerEpisodeIdentifier: EPISODE,
};
const aggregate = { completedEpisodes: 0, availableEpisodes: 1, progress: 0 };
function progress() {
	return {
		schemaVersion: 3,
		clientEventId: ID,
		clientSessionKey: "tab:source:1",
		accountGeneration: 4,
		provider: "primevideo",
		titleKey,
		itemKind: "series",
		title: "Series",
		artworkUrl: null,
		episodeKey,
		episodeTitle: "Episode",
		seasonKey,
		seasonTitle: "Season 2",
		seasonNumber: 2,
		episodeNumber: 1,
		sourceUrl,
		currentTime: 600,
		duration: 1200,
		progress: 0.5,
		observedAt: NOW,
		kind: "pause",
		sharedRoom: null,
		primevideoIdentity: identity,
	};
}
function catalog() {
	return {
		schemaVersion: 3,
		provider: "primevideo",
		titleKey,
		providerSeriesId: ANCHOR,
		title: "Series",
		completeness: "partial",
		context: {
			region: null,
			requestedLocale: "en-US",
			audioLocale: null,
			subtitleLocales: [],
			observedAt: NOW,
		},
		seasons: [
			{
				seasonKey,
				providerSeasonIdentifier: SEASON,
				title: "Season 2",
				seasonNumber: 2,
				order: 1,
				episodes: [
					{
						episodeKey,
						providerEpisodeIdentifier: EPISODE,
						title: "Episode",
						episodeNumber: 1,
						order: 0,
						releasedAt: null,
						available: true,
						watchVariants: [
							{
								providerContentId: EPISODE,
								audioLocale: null,
								original: true,
								order: 0,
								sourceUrl,
							},
						],
					},
				],
			},
		],
	};
}
function begin() {
	const c = catalog();
	return {
		schemaVersion: 3,
		accountGeneration: 4,
		provider: c.provider,
		titleKey,
		providerSeriesId: ANCHOR,
		context: c.context,
		historyAccess: { accessVersion: 1, accessEpoch: 2 },
	};
}
function observedEpisode() {
	return {
		episodeKey,
		episodeTitle: "Episode",
		episodeNumber: 1,
		seasonKey,
		seasonTitle: "Season 2",
		seasonNumber: 2,
		sourceUrl,
		currentTime: 600,
		duration: 1200,
		progress: 0.5,
		completedAt: null,
		lastWatchedAt: NOW,
		sessions: [],
	};
}
function page() {
	return {
		meta,
		generatedAt: NOW,
		provider: "primevideo",
		titleKey,
		observedEpisodeCount: 1,
		completedEpisodeCount: 0,
		episodes: [observedEpisode()],
		catalog: {
			state: "unavailable",
			title: null,
			aggregate: null,
			seasons: [],
		},
		complete: true,
		nextCursor: null,
	};
}
function item() {
	return {
		provider: "primevideo",
		titleKey,
		observedEpisodeCount: 1,
		completedEpisodeCount: 0,
		episodePage: { complete: true, nextCursor: null },
		itemKind: "series",
		title: "Series",
		sourceUrl,
		artworkUrl: null,
		catalogState: "partial",
		aggregate: {
			completedEpisodes: 0,
			availableEpisodes: null,
			progress: null,
		},
		seasons: [
			{
				seasonKey,
				seasonTitle: "Season 2",
				seasonNumber: 2,
				order: 1,
				aggregate: {
					completedEpisodes: 0,
					availableEpisodes: null,
					progress: null,
				},
				episodes: [observedEpisode()],
				nextEpisode: null,
			},
		],
		sessions: [],
		latestActivity: {
			episodeKey,
			currentTime: 600,
			duration: 1200,
			progress: 0.5,
			completedAt: null,
			lastWatchedAt: NOW,
		},
		lastWatchedAt: NOW,
	};
}
function editor() {
	return {
		meta,
		provider: "primevideo",
		titleKey,
		revision: "a".repeat(32),
		catalogComplete: false,
		episodes: [
			{
				episodeKey,
				episodeTitle: "Episode",
				episodeNumber: 1,
				seasonKey,
				seasonTitle: "Season 2",
				seasonNumber: 2,
				seasonOrder: 1,
				order: 0,
				sourceUrl,
				available: true,
				watched: false,
				currentTime: 600,
				duration: 1200,
				progress: 0.5,
			},
		],
	};
}
function grid() {
	return {
		meta,
		provider: "primevideo",
		titleKey,
		state: "complete",
		revision: "accepted",
		seasonKey,
		seasons: [
			{
				seasonKey,
				seasonTitle: "Season 2",
				seasonNumber: 2,
				order: 1,
				aggregate,
				nextEpisode: null,
				kind: "season",
			},
		],
		mainAggregate: aggregate,
		specialsAggregate: null,
		episodes: [
			{
				episodeKey,
				episodeTitle: "Episode",
				episodeNumber: 1,
				seasonKey,
				order: 0,
				releasedAt: null,
				available: true,
				sourceUrl,
				history: null,
			},
		],
		nextCursor: null,
	};
}

describe("Prime Video source contracts", () => {
	it("canonicalizes only detail identity and binds descriptors and fingerprints", () => {
		const result = canonicalizeRoomSourceUrl(
			`${sourceUrl}/?tracking=1#player`,
			"primevideo",
		);
		expect(result).toEqual({
			ok: true,
			source: {
				provider: "primevideo",
				sourceUrl,
				canonicalUrl: sourceUrl,
				videoFingerprint: `primevideo|detail/${EPISODE}`,
			},
		});
		if (!result.ok) throw Error("missing source");
		expect(RoomSourceDescriptorSchema.safeParse(result.source).success).toBe(
			true,
		);
		expect(
			WatchSourceDescriptorSchema.safeParse({
				...result.source,
				title: "Episode",
			}).success,
		).toBe(true);
		for (const patch of [
			{ sourceUrl: `${sourceUrl}?tracking=1` },
			{ canonicalUrl: `${sourceUrl}/` },
			{ videoFingerprint: `primevideo|detail/${MOVIE}` },
			{ provider: "youtube" },
			{ sourceUrl: movieUrl },
		]) {
			expect(
				RoomSourceDescriptorSchema.safeParse({ ...result.source, ...patch })
					.success,
			).toBe(false);
			expect(
				WatchSourceDescriptorSchema.safeParse({
					...result.source,
					title: "Episode",
					...patch,
				}).success,
			).toBe(false);
		}
		expect(canonicalizeRoomSourceUrl(sourceUrl, "netflix").ok).toBe(false);
	});
	it.each([
		`http://www.primevideo.com/detail/${EPISODE}`,
		`https://user:pass@www.primevideo.com/detail/${EPISODE}`,
		`https://www.primevideo.com.evil.test/detail/${EPISODE}`,
		`https://primevideo.com/detail/${EPISODE}`,
		`https://api.primevideo.com/detail/${EPISODE}`,
		`https://www.primevideo.com./detail/${EPISODE}`,
		`https://www.primevideo.com:444/detail/${EPISODE}`,
		`https://www.primevideo.com:443/detail/${EPISODE}`,
		`https://www.primevideo.com/watch/${EPISODE}`,
		`https://www.primevideo.com/en/detail/${EPISODE}`,
		`${sourceUrl}/slug`,
		`https://www.primevideo.com/detail/${EPISODE.toLowerCase()}`,
		`${sourceUrl}A`,
		sourceUrl.slice(0, -1),
		`https://www.primevideo.com/detail/%30${EPISODE.slice(1)}`,
		`${sourceUrl}\\extra`,
		` ${sourceUrl}`,
		`https://www.primevideo.com/a/../detail/${EPISODE}`,
		`https://www.primevideo.com/detail/./${EPISODE}`,
	])("rejects unsupported or hostile URL %s", (url) =>
		expect(canonicalizeRoomSourceUrl(url).ok).toBe(false));
	it.each([
		"youtube",
		"crunchyroll",
		"generic",
		"netflix",
	])("guards Prime-looking invalid sources under %s", (provider) => {
		const legacy = {
			provider,
			title: "Video",
			sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
			canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk",
			videoFingerprint: "youtube|abcdefghijk",
		};
		for (const url of [
			sourceUrl,
			`http://user:pass@www.primevideo.com:444/detail/${EPISODE}`,
			"https://api.primevideo.com/browse",
			`https://www.primevideo.com./detail/${EPISODE}`,
		]) {
			expect(
				WatchSourceDescriptorSchema.safeParse({ ...legacy, sourceUrl: url })
					.success,
			).toBe(false);
			expect(
				WatchSourceDescriptorSchema.safeParse({ ...legacy, canonicalUrl: url })
					.success,
			).toBe(false);
		}
		expect(
			WatchSourceDescriptorSchema.safeParse({
				...legacy,
				videoFingerprint: `primevideo|detail/${EPISODE}`,
			}).success,
		).toBe(false);
	});
});

describe("Prime Video progress identities", () => {
	it("requires one exact episode identity with an explicit first-season anchor", () => {
		expect(
			WatchProgressEventSchema.parse(progress()).primevideoIdentity,
		).toEqual(identity);
		const { sharedRoom: _room, ...event } = progress();
		expect(
			PersonalWatchProgressRequestSchema.safeParse({
				captureVersion: 1,
				accessEpoch: 2,
				youtubeConsentEpoch: 0,
				clientSequence: 1,
				event,
			}).success,
		).toBe(true);
		for (const patch of [
			{ titleKey: `primevideo:series:${SEASON}` },
			{ seasonKey: `primevideo:season:${ANCHOR}` },
			{ episodeKey: movieKey },
			{ sourceUrl: movieUrl },
			{ sourceUrl: `${sourceUrl}?ref=1` },
			{ itemKind: "movie" },
			{ primevideoIdentity: undefined },
			{ primevideoIdentity: { ...identity, providerSeriesId: ANCHOR } },
			{
				primevideoIdentity: {
					...identity,
					seriesAnchorSeasonId: "Series Title",
				},
			},
			{ primevideoIdentity: { ...identity, providerMovieId: MOVIE } },
			{ youtubeVideoId: "abcdefghijk" },
			{ netflixIdentity: { kind: "movie", providerMovieId: "123" } },
			{ provider: "amazon" },
			{ provider: "youtube" },
		])
			expect(
				WatchProgressEventSchema.safeParse({ ...progress(), ...patch }).success,
			).toBe(false);
	});
	it("uses one movie key and null season/ordinal metadata", () => {
		const movie = {
			...progress(),
			itemKind: "movie",
			titleKey: movieKey,
			episodeKey: movieKey,
			sourceUrl: movieUrl,
			seasonKey: null,
			seasonTitle: null,
			seasonNumber: null,
			episodeNumber: null,
			primevideoIdentity: { kind: "movie", providerMovieId: MOVIE },
		};
		expect(WatchProgressEventSchema.safeParse(movie).success).toBe(true);
		for (const patch of [
			{ titleKey },
			{ episodeKey: `primevideo:episode:${MOVIE}` },
			{ seasonKey },
			{ seasonTitle: "Season" },
			{ seasonNumber: 1 },
			{ episodeNumber: 1 },
			{
				primevideoIdentity: {
					...movie.primevideoIdentity,
					seriesAnchorSeasonId: ANCHOR,
				},
			},
		])
			expect(
				WatchProgressEventSchema.safeParse({ ...movie, ...patch }).success,
			).toBe(false);
	});
});

describe("Prime Video catalog admission", () => {
	it("accepts partial catalogs with explicit anchor and one exact source per episode", () => {
		expect(
			WatchCatalogSnapshotInputSchema.parse(catalog()).providerSeriesId,
		).toBe(ANCHOR);
		for (const mutate of [
			(c: ReturnType<typeof catalog>) => {
				c.providerSeriesId = "Series";
				c.titleKey = "primevideo:series:Series";
			},
			(c: ReturnType<typeof catalog>) => {
				c.seasons[0]!.providerSeasonIdentifier = "1";
				c.seasons[0]!.seasonKey = "primevideo:season:1";
			},
			(c: ReturnType<typeof catalog>) => {
				c.seasons[0]!.episodes[0]!.episodeKey = "netflix:episode:123";
			},
			(c: ReturnType<typeof catalog>) => {
				c.seasons[0]!.episodes[0]!.watchVariants[0]!.sourceUrl = movieUrl;
			},
			(c: ReturnType<typeof catalog>) => {
				c.seasons[0]!.episodes[0]!.watchVariants[0]!.providerContentId = MOVIE;
				c.seasons[0]!.episodes[0]!.watchVariants[0]!.sourceUrl = movieUrl;
			},
			(c: ReturnType<typeof catalog>) => {
				c.seasons[0]!.episodes[0]!.watchVariants.push({
					...c.seasons[0]!.episodes[0]!.watchVariants[0]!,
					original: false,
				});
			},
			(c: ReturnType<typeof catalog>) => {
				c.provider = "crunchyroll";
				c.titleKey = `crunchyroll:series:${ANCHOR}`;
			},
		]) {
			const c = catalog();
			mutate(c);
			expect(WatchCatalogSnapshotInputSchema.safeParse(c).success).toBe(false);
		}
	});
	it("binds requests/snapshots/acks to provider, exact anchor, context and generation", () => {
		const request = { ...begin(), revision: 1, snapshot: catalog() };
		expect(WatchCatalogBeginRequestSchema.safeParse(begin()).success).toBe(
			true,
		);
		expect(WatchCatalogCommitRequestSchema.safeParse(request).success).toBe(
			true,
		);
		for (const patch of [
			{ provider: "netflix" },
			{ providerSeriesId: SEASON, titleKey: `primevideo:series:${SEASON}` },
			{ context: { ...request.context, region: "US" } },
		])
			expect(
				WatchCatalogCommitRequestSchema.safeParse({ ...request, ...patch })
					.success,
			).toBe(false);
		expect(
			WatchCatalogBeginRequestSchema.safeParse({
				...begin(),
				providerSeriesId: "unknown",
				titleKey: "primevideo:series:unknown",
			}).success,
		).toBe(false);
		const ack = {
			meta,
			schemaVersion: 3,
			provider: "primevideo",
			titleKey,
			accountGeneration: 4,
			revision: 1,
			effectiveCatalogState: "partial",
			projectionRevision: null,
			acceptedHash: null,
			acceptedAt: null,
		};
		for (const [schema, value] of [
			[
				WatchCatalogBeginAckSchema,
				{ ...ack, refreshRequired: false, availabilityChanged: false },
			],
			[WatchCatalogCommitAckSchema, { ...ack, outcome: "applied" }],
		] as const) {
			expect(schema.safeParse(value).success).toBe(true);
			expect(
				schema.safeParse({ ...value, titleKey: "netflix:series:123" }).success,
			).toBe(false);
			expect(schema.safeParse({ ...value, accountGeneration: 3 }).success).toBe(
				false,
			);
		}
	});
});

describe("Prime Video reads and editing", () => {
	it("validates read title/episode identities and exact canonical sources", () => {
		expect(WatchProviderSchema.safeParse("primevideo").success).toBe(true);
		expect(WatchHistoryItemSchema.safeParse(item()).success).toBe(true);
		expect(
			WatchHistoryTitleEpisodesResponseSchema.safeParse(page()).success,
		).toBe(true);
		for (const provider of ["netflix", "crunchyroll", "youtube", "amazon"]) {
			expect(
				WatchHistoryItemSchema.safeParse({ ...item(), provider }).success,
			).toBe(false);
			expect(
				WatchHistoryTitleEpisodesResponseSchema.safeParse({
					...page(),
					provider,
				}).success,
			).toBe(false);
		}
		for (const patch of [
			{ sourceUrl: movieUrl },
			{ sourceUrl: `${sourceUrl}?ref=1` },
			{ episodeKey: "netflix:episode:123" },
			{ seasonKey: "legacy" },
		])
			expect(
				WatchHistoryTitleEpisodesResponseSchema.safeParse({
					...page(),
					episodes: [{ ...observedEpisode(), ...patch }],
				}).success,
			).toBe(false);
		expect(
			WatchHistoryItemSchema.safeParse({ ...item(), itemKind: "movie" })
				.success,
		).toBe(false);
		const movie = {
			...page(),
			titleKey: movieKey,
			episodes: [
				{
					...observedEpisode(),
					episodeKey: movieKey,
					sourceUrl: movieUrl,
					seasonKey: null,
					seasonTitle: null,
					seasonNumber: null,
					episodeNumber: null,
				},
			],
		};
		expect(
			WatchHistoryTitleEpisodesResponseSchema.safeParse(movie).success,
		).toBe(true);
		for (const patch of [
			{ seasonTitle: "Season" },
			{ seasonNumber: 1 },
			{ episodeNumber: 1 },
		])
			expect(
				WatchHistoryTitleEpisodesResponseSchema.safeParse({
					...movie,
					episodes: [{ ...movie.episodes[0], ...patch }],
				}).success,
			).toBe(false);
	});
	it("keeps Prime keys provider-bound in browse queries", () => {
		expect(
			WatchHistoryBrowseQuerySchema.parse({
				mode: "personal",
				provider: "primevideo",
				providerVersion: 3,
			}).providerVersion,
		).toBe(3);
		expect(
			WatchHistoryBrowseTitleEpisodesQuerySchema.safeParse({
				mode: "personal",
				provider: "primevideo",
				titleKey,
			}).success,
		).toBe(true);
		expect(
			WatchHistoryBrowseSessionsQuerySchema.safeParse({
				mode: "personal",
				provider: "primevideo",
				titleKey,
				episodeKey,
			}).success,
		).toBe(true);
		for (const provider of [
			"primevideo",
			"youtube",
			"netflix",
			"crunchyroll",
		]) {
			const foreignTitle =
				provider === "primevideo" ? "netflix:series:123" : titleKey;
			expect(
				WatchHistoryBrowseTitleEpisodesQuerySchema.safeParse({
					mode: "personal",
					provider,
					titleKey: foreignTitle,
				}).success,
			).toBe(false);
			expect(
				WatchHistoryBrowseSessionsQuerySchema.safeParse({
					mode: "personal",
					provider,
					titleKey: foreignTitle,
					episodeKey,
				}).success,
			).toBe(false);
		}
	});
	it("validates grid identities without exposing partial catalogs as exact grids", () => {
		expect(
			WatchHistoryGridQuerySchema.safeParse({
				provider: "primevideo",
				titleKey,
				seasonKey,
			}).success,
		).toBe(true);
		expect(WatchHistoryGridResponseSchema.safeParse(grid()).success).toBe(true);
		for (const patch of [
			{ provider: "crunchyroll" },
			{ titleKey: "netflix:series:123" },
			{ state: "partial" },
			{ episodes: [{ ...grid().episodes[0], sourceUrl: movieUrl }] },
		])
			expect(
				WatchHistoryGridResponseSchema.safeParse({ ...grid(), ...patch })
					.success,
			).toBe(false);
	});
	it("validates episode/movie editor boundaries and rejects mixed identities", () => {
		expect(
			WatchHistoryEditorQuerySchema.safeParse({
				provider: "primevideo",
				titleKey,
				accountGeneration: 4,
			}).success,
		).toBe(true);
		expect(WatchHistoryEditorResponseSchema.safeParse(editor()).success).toBe(
			true,
		);
		const edit = {
			provider: "primevideo",
			titleKey,
			accountGeneration: 4,
			clientMutationId: ID,
			revision: "a".repeat(32),
			changes: [{ episodeKey, watched: true }],
		};
		expect(WatchHistoryEditRequestSchema.safeParse(edit).success).toBe(true);
		expect(
			WatchHistoryEditRequestSchema.safeParse({
				...edit,
				changes: [{ episodeKey: movieKey, watched: true }],
			}).success,
		).toBe(false);
		expect(
			WatchHistoryEditorResponseSchema.safeParse({
				...editor(),
				episodes: [{ ...editor().episodes[0], sourceUrl: movieUrl }],
			}).success,
		).toBe(false);
		const movie = {
			...editor(),
			titleKey: movieKey,
			episodes: [
				{
					...editor().episodes[0],
					episodeKey: movieKey,
					sourceUrl: movieUrl,
					seasonKey: null,
					seasonTitle: null,
					seasonNumber: null,
					episodeNumber: null,
				},
			],
		};
		expect(WatchHistoryEditorResponseSchema.safeParse(movie).success).toBe(
			true,
		);
		expect(
			WatchHistoryEditorResponseSchema.safeParse({ ...movie, titleKey })
				.success,
		).toBe(false);
	});
	it("binds resume to exact source, owner generation and bounded lifetime", async () => {
		const url = await buildPersonalHistoryResumeUrl({
			ownerUserId: ID,
			accountGeneration: 4,
			provider: "primevideo",
			sourceUrl,
			currentTime: 600,
			now: 1000,
			intentId: ID,
		});
		expect(parsePersonalHistoryResumeUrl(url, 1000)).toMatchObject({
			provider: "primevideo",
			sourceUrl,
			currentTime: 600,
		});
		const differentMovie = new URL(url);
		differentMovie.pathname = `/detail/${MOVIE}`;
		expect(parsePersonalHistoryResumeUrl(differentMovie.href, 1000)).toBeNull();
		expect(parsePersonalHistoryResumeUrl(url, 301000)).toBeNull();
	});
});

it("adds exact capacity v3 while preserving the v1/v2 shapes and omitted provider version", () => {
	const v1 = {
		capacityVersion: 1,
		ownerUserId: ID,
		accountGeneration: 4,
		serverTime: NOW,
		providers: {
			youtube: { used: 101, limit: 100 },
			crunchyroll: { used: 250, limit: 200 },
		},
	};
	const v2 = {
		...v1,
		capacityVersion: 2,
		providers: { ...v1.providers, netflix: { used: 201, limit: 200 } },
	};
	const v3 = {
		...v2,
		capacityVersion: 3,
		providers: { ...v2.providers, primevideo: { used: 201, limit: 200 } },
	};
	expect(WatchHistoryCapacitySchema).toBe(WatchHistoryCapacityV1Schema);
	expect(WatchHistoryCapacityV1Schema.parse(v1)).toEqual(v1);
	expect(WatchHistoryCapacityV2Schema.parse(v2)).toEqual(v2);
	expect(WatchHistoryCapacityCompatibleSchema.parse(v3)).toEqual(v3);
	expect(
		WatchHistoryCapacityV1Schema.safeParse({ ...v3, capacityVersion: 1 })
			.success,
	).toBe(false);
	expect(
		WatchHistoryCapacityV2Schema.safeParse({ ...v3, capacityVersion: 2 })
			.success,
	).toBe(false);
	for (const primevideo of [
		{ used: -1, limit: 200 },
		{ used: 0.5, limit: 200 },
		{ used: 0, limit: 100 },
		{ used: 0, limit: 200, full: false },
	])
		expect(
			WatchHistoryCapacityCompatibleSchema.safeParse({
				...v3,
				providers: { ...v3.providers, primevideo },
			}).success,
		).toBe(false);
	expect(
		WatchHistoryCapacityCompatibleSchema.safeParse({
			...v2,
			capacityVersion: 3,
		}).success,
	).toBe(false);
	expect(
		WatchHistoryBrowseQuerySchema.parse({ mode: "personal" }),
	).not.toHaveProperty("providerVersion");
	for (const providerVersion of [0, 4, "3", null])
		expect(
			WatchHistoryBrowseQuerySchema.safeParse({
				mode: "personal",
				providerVersion,
			}).success,
		).toBe(false);
});

it("exports strict opaque Prime identity and deterministic source/key helpers", () => {
	expect(PrimeVideoProviderIdSchema.parse(EPISODE)).toBe(EPISODE);
	for (const value of [
		EPISODE.toLowerCase(),
		`${EPISODE}A`,
		EPISODE.slice(1),
		` ${EPISODE}`,
		"urn:amazon:video:123",
	])
		expect(PrimeVideoProviderIdSchema.safeParse(value).success).toBe(false);
	expect(PrimeVideoHistoryIdentitySchema.parse(identity)).toEqual(identity);
	expect(
		PrimeVideoHistoryIdentitySchema.safeParse({
			...identity,
			providerMovieId: MOVIE,
		}).success,
	).toBe(false);
	expect(
		PrimeVideoHistoryIdentitySchema.safeParse({
			...identity,
			providerSeriesId: ANCHOR,
		}).success,
	).toBe(false);
	expect(
		primeVideoHistoryKeys(PrimeVideoHistoryIdentitySchema.parse(identity)),
	).toEqual({ itemKind: "series", titleKey, seasonKey, episodeKey });
	expect(
		primeVideoHistoryKeys({ kind: "movie", providerMovieId: MOVIE }),
	).toEqual({
		itemKind: "movie",
		titleKey: movieKey,
		episodeKey: movieKey,
		seasonKey: null,
	});
	expect(primeVideoSourceUrl(EPISODE)).toBe(sourceUrl);
	expect(primeVideoFingerprint(EPISODE)).toBe(`primevideo|detail/${EPISODE}`);
	expect(isPrimeVideoHistoryKey(titleKey, "series")).toBe(true);
	expect(isPrimeVideoHistoryKey(movieKey, "movie")).toBe(true);
	expect(isPrimeVideoHistoryKey(movieKey, "episode")).toBe(false);
	expect(
		isPrimeVideoHistoryKey(
			`primevideo:series:${ANCHOR.toLowerCase()}`,
			"series",
		),
	).toBe(false);
	expect(
		WatchHistoryCapacityV3Schema.safeParse({
			capacityVersion: 3,
			ownerUserId: ID,
			accountGeneration: 4,
			serverTime: NOW,
			providers: {
				youtube: { used: 1, limit: 100 },
				crunchyroll: { used: 1, limit: 200 },
				netflix: { used: 1, limit: 200 },
				primevideo: { used: 1, limit: 200 },
			},
		}).success,
	).toBe(true);
});

it("binds Prime references in browse match payloads to their declared provider", () => {
	const details = {
		detail: page(),
		matches: [
			{
				episodeKey,
				lastWatchedAt: NOW,
				matchingSessionCount: 0,
				sessionsComplete: true,
			},
		],
		groups: [],
	};
	expect(
		WatchHistoryBrowseTitleEpisodesResponseSchema.safeParse(details).success,
	).toBe(true);
	expect(
		WatchHistoryBrowseTitleEpisodesResponseSchema.safeParse({
			...details,
			matches: [{ ...details.matches[0], episodeKey: "netflix:episode:123" }],
		}).success,
	).toBe(false);
	const response = {
		history: {
			meta,
			generatedAt: NOW,
			totalTitleCount: 0,
			items: [],
			nextCursor: null,
		},
		matches: [
			{
				provider: "primevideo",
				titleKey,
				lastWatchedAt: NOW,
				matchingEpisodeCount: 1,
				matchingSessionCount: 0,
			},
		],
	};
	expect(WatchHistoryBrowseResponseSchema.safeParse(response).success).toBe(
		true,
	);
	for (const patch of [
		{ provider: "youtube" },
		{ titleKey: "netflix:series:123" },
		{ titleKey: "legacy-key" },
	])
		expect(
			WatchHistoryBrowseResponseSchema.safeParse({
				...response,
				matches: [{ ...response.matches[0], ...patch }],
			}).success,
		).toBe(false);
});

it("guards legacy account-library Prime sources without inventing a seasonId mapping", () => {
	const legacy = {
		provider: "youtube",
		itemKey: "abcdefghijk",
		itemKind: "movie",
		itemTitle: "Video",
		sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
		artworkUrl: null,
		active: true,
		lastWatchedAt: NOW,
		episodes: [],
	};
	expect(WatchLibraryItemSchema.safeParse(legacy).success).toBe(true);
	for (const url of [
		sourceUrl,
		`http://user:pass@www.primevideo.com:444/detail/${EPISODE}`,
		"https://www.primevideo.com./browse",
	])
		expect(
			WatchLibraryItemSchema.safeParse({ ...legacy, sourceUrl: url }).success,
		).toBe(false);
	const prime = {
		...legacy,
		provider: "primevideo",
		itemKey: movieKey,
		sourceUrl: movieUrl,
	};
	expect(WatchLibraryItemSchema.safeParse(prime).success).toBe(true);
	expect(
		WatchLibraryItemSchema.safeParse({
			...prime,
			sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
		}).success,
	).toBe(false);
});

it("binds legacy Prime library item/episode keys and source IDs while retaining seasonId compatibility", () => {
	const episode = {
		episodeKey,
		episodeTitle: "Episode",
		seasonId: "legacy-season-row-id",
		seasonTitle: "Season 2",
		seasonNumber: 2,
		sourceUrl,
		currentTime: 600,
		duration: 1200,
		progress: 0.5,
		lastWatchedAt: NOW,
		sessions: [],
	};
	const series = {
		provider: "primevideo",
		itemKey: titleKey,
		itemKind: "series",
		itemTitle: "Series",
		sourceUrl,
		artworkUrl: null,
		active: true,
		lastWatchedAt: NOW,
		episodes: [episode],
	};
	expect(WatchLibraryItemSchema.safeParse(series).success).toBe(true);
	for (const patch of [
		{ itemKey: "youtube:video:abcdefghijk" },
		{ itemKey: movieKey },
		{ itemKey: "bare-key" },
		{ episodes: [{ ...episode, episodeKey: "youtube:video:abcdefghijk" }] },
		{ episodes: [{ ...episode, episodeKey: movieKey, sourceUrl: movieUrl }] },
		{ episodes: [{ ...episode, sourceUrl: movieUrl }] },
	])
		expect(
			WatchLibraryItemSchema.safeParse({ ...series, ...patch }).success,
		).toBe(false);
	const movie = {
		...series,
		itemKind: "movie",
		itemKey: movieKey,
		sourceUrl: movieUrl,
		episodes: [
			{
				...episode,
				episodeKey: movieKey,
				sourceUrl: movieUrl,
				seasonId: null,
				seasonTitle: null,
				seasonNumber: null,
			},
		],
	};
	expect(WatchLibraryItemSchema.safeParse(movie).success).toBe(true);
	for (const patch of [
		{ itemKey: "youtube:video:abcdefghijk" },
		{ itemKey: titleKey },
		{ sourceUrl },
		{ episodes: [episode] },
		{
			episodes: [
				{
					...movie.episodes[0],
					episodeKey: `primevideo:movie:${EPISODE}`,
					sourceUrl,
				},
			],
		},
	])
		expect(
			WatchLibraryItemSchema.safeParse({ ...movie, ...patch }).success,
		).toBe(false);
});

it.each([
	"youtube",
	"crunchyroll",
	"netflix",
	"amazon",
])("rejects qualified Prime library keys under %s with otherwise legacy-compatible URLs", (provider) => {
	const legacyUrl = "https://www.youtube.com/watch?v=abcdefghijk";
	const episode = {
		episodeKey: "bare-episode",
		episodeTitle: "Episode",
		seasonId: "legacy-season-row-id",
		seasonTitle: "Season",
		seasonNumber: 1,
		sourceUrl: legacyUrl,
		currentTime: 600,
		duration: 1200,
		progress: 0.5,
		lastWatchedAt: NOW,
		sessions: [],
	};
	const legacy = {
		provider,
		itemKey: "bare-title",
		itemKind: "series",
		itemTitle: "Series",
		sourceUrl: legacyUrl,
		artworkUrl: null,
		active: true,
		lastWatchedAt: NOW,
		episodes: [episode],
	};
	expect(WatchLibraryItemSchema.safeParse(legacy).success).toBe(true);
	expect(
		WatchLibraryItemSchema.safeParse({ ...legacy, itemKey: movieKey }).success,
	).toBe(false);
	expect(
		WatchLibraryItemSchema.safeParse({
			...legacy,
			episodes: [{ ...episode, episodeKey }],
		}).success,
	).toBe(false);
});

it("does not admit Prime identity under valid legacy progress identities", () => {
	const youtube = {
		...progress(),
		provider: "youtube",
		titleKey: "youtube:video:abcdefghijk",
		episodeKey: "youtube:video:abcdefghijk",
		youtubeVideoId: "abcdefghijk",
		primevideoIdentity: undefined,
		seasonKey: null,
		sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
	};
	expect(WatchProgressEventSchema.safeParse(youtube).success).toBe(true);
	expect(
		WatchProgressEventSchema.safeParse({
			...youtube,
			primevideoIdentity: identity,
		}).success,
	).toBe(false);
	const crunchyroll = {
		...progress(),
		provider: "crunchyroll",
		primevideoIdentity: undefined,
		titleKey: "crunchyroll:series:S",
		episodeKey: "crunchyroll:episode:E",
		seasonKey: "crunchyroll:season:S1",
		sourceUrl: "https://www.crunchyroll.com/watch/E",
		crunchyrollIdentity: {
			providerSeriesId: "S",
			providerSeasonIdentifier: "S1",
			providerEpisodeIdentifier: "E",
			providerContentId: "E",
			audioLocale: null,
		},
	};
	expect(WatchProgressEventSchema.safeParse(crunchyroll).success).toBe(true);
	expect(
		WatchProgressEventSchema.safeParse({
			...crunchyroll,
			primevideoIdentity: identity,
		}).success,
	).toBe(false);
});
