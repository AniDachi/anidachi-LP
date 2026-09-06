import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import {
	readWatchHistoryGrid,
	type WatchHistoryGridStore,
} from "./watch-history-grid";
import { createWatchHistoryGridGet } from "./watch-history-grid-routes";

const OWNER = "00000000-0000-4000-8000-000000000001";
const TITLE = "crunchyroll:series:SERIES";
const NOW = "2026-09-06T09:00:00.000Z";
const query = { provider: "crunchyroll", titleKey: TITLE };
function fixture() {
	const context = {
		region: "VN",
		requestedLocale: "en-US",
		audioLocale: "ja-JP",
		subtitleLocales: ["en-US"],
		observedAt: NOW,
	};
	const seasons = [
		{ key: "MAIN", title: "Season 1", count: 61, number: 0 },
		{ key: "SPECIAL", title: "Specials", count: 2, number: null },
	].map((group, order) => ({
		seasonKey: `crunchyroll:season:${group.key}`,
		providerSeasonIdentifier: group.key,
		title: group.title,
		seasonNumber: group.number,
		order,
		episodes: Array.from({ length: group.count }, (_, index) => ({
			episodeKey: `crunchyroll:episode:${group.key}${index}`,
			providerEpisodeIdentifier: `${group.key}${index}`,
			title: `${group.title} title ${index}`,
			episodeNumber: group.key === "SPECIAL" ? (index ? null : 12.5) : index,
			order: index,
			releasedAt: "2026-09-01T00:00:00.000Z",
			available: true,
			watchVariants: ["JA", "EN"].map((lang, order) => ({
				providerContentId: `${group.key}${index}${lang}`,
				audioLocale: lang === "JA" ? "ja-JP" : "en-US",
				original: !order,
				order,
				sourceUrl: `https://www.crunchyroll.com/watch/${group.key}${index}${lang}`,
			})),
		})),
	}));
	const snapshot = {
		schemaVersion: 3,
		provider: "crunchyroll",
		titleKey: TITLE,
		providerSeriesId: "SERIES",
		title: "Series",
		completeness: "complete",
		context,
		seasons,
	};
	const summaries = seasons.map((season) => ({
		seasonKey: season.seasonKey,
		seasonTitle: season.title,
		seasonNumber: season.seasonNumber,
		order: season.order,
		aggregate: {
			completedEpisodes: 1,
			availableEpisodes: season.episodes.length,
			progress: 1 / season.episodes.length,
		},
		nextEpisode: null,
	}));
	const row = {
		user_id: OWNER,
		history_generation: 3,
		title_key: TITLE,
		revision: 8,
		accepted_revision: 8,
		accepted_hash: "hash",
		context,
		accepted_context: context,
		preferred_audio_locale: "en-US",
		snapshot,
		projection: { seasons: summaries },
	};
	const progress = {
		user_id: OWNER,
		history_generation: 3,
		provider: "crunchyroll",
		title_key: TITLE,
		episode_key: seasons[0]!.episodes[0]!.episodeKey,
		episode_title: "Old observed label",
		season_key: seasons[0]!.seasonKey,
		season_title: "Old season label",
		season_number: 0,
		episode_number: 0,
		source_url: "https://www.crunchyroll.com/watch/MAIN0JA",
		current_time_seconds: 1200,
		duration: 1200,
		progress: 1,
		completed_at: NOW,
		observed_at: NOW,
	};
	const calls: string[][] = [];
	const store: WatchHistoryGridStore = {
		settings: async (owner) => {
			assert.equal(owner, OWNER);
			return { history_generation: 3, write_schema_version: 3 };
		},
		catalog: async (owner, generation, title) => {
			assert.deepEqual([owner, generation, title], [OWNER, 3, TITLE]);
			return structuredClone(row);
		},
		progress: async (owner, generation, title, keys) => {
			assert.deepEqual([owner, generation, title], [OWNER, 3, TITLE]);
			calls.push(keys);
			return keys.includes(progress.episode_key) ? [progress] : [];
		},
	};
	return { store, row, progress, calls };
}
const read = (store: WatchHistoryGridStore, input: unknown = query) =>
	readWatchHistoryGrid({ userId: OWNER, store, input, now: new Date(NOW) });

test("catalog pages real episodes, keeps E0 in its season, and separates specials from series totals", async () => {
	const { store, calls } = fixture();
	const first = await read(store);
	assert.equal(first.episodes.length, 50);
	assert.equal(first.episodes[0]!.episodeNumber, 0);
	assert.equal(first.seasons[0]!.kind, "season");
	assert.deepEqual(first.mainAggregate, {
		completedEpisodes: 1,
		availableEpisodes: 61,
		progress: 1 / 61,
	});
	assert.deepEqual(first.specialsAggregate, {
		completedEpisodes: 1,
		availableEpisodes: 2,
		progress: 0.5,
	});
	assert.equal(first.episodes[0]!.history!.completedAt, NOW);
	assert.equal(first.episodes[0]!.history!.episodeTitle, "Season 1 title 0");
	assert.equal(
		first.episodes[0]!.sourceUrl,
		"https://www.crunchyroll.com/watch/MAIN0JA",
	);
	assert.equal(first.episodes[1]!.history, null);
	assert.equal(
		first.episodes[1]!.sourceUrl,
		"https://www.crunchyroll.com/watch/MAIN1EN",
	);
	const second = await read(store, { ...query, cursor: first.nextCursor });
	assert.equal(second.episodes.length, 11);
	assert.equal(second.episodes[0]!.episodeNumber, 50);
	assert.equal(second.nextCursor, null);
	assert.equal(
		new Set(
			[...first.episodes, ...second.episodes].map(
				(episode) => episode.episodeKey,
			),
		).size,
		61,
	);
	assert.deepEqual(
		calls.map((keys) => keys.length),
		[50, 50, 11, 11],
	);
	const specials = await read(store, {
		...query,
		seasonKey: "crunchyroll:season:SPECIAL",
	});
	assert.deepEqual(
		specials.episodes.map((episode) => episode.episodeNumber),
		[12.5, null],
	);
});

test("catalog cursor is bound to owner, generation, title, season and accepted revision", async () => {
	const { store, row } = fixture();
	const first = await read(store);
	assert.ok(first.nextCursor);
	const binding = JSON.parse(
		Buffer.from(first.nextCursor, "base64url").toString("utf8"),
	);
	for (let index = 0; index < binding.length; index++) {
		const changed = [...binding];
		changed[index] = typeof changed[index] === "number" ? -1 : "different";
		await assert.rejects(
			read(store, {
				...query,
				cursor: Buffer.from(JSON.stringify(changed)).toString("base64url"),
			}),
			{ code: "INVALID_CURSOR" },
		);
	}
	row.accepted_revision++;
	await assert.rejects(read(store, { ...query, cursor: first.nextCursor }), {
		code: "INVALID_CURSOR",
	});
});

test("region changes and unavailable catalogs expose no invented roster or exact totals", async () => {
	const { store, row } = fixture();
	row.context = { ...row.context, region: "US" };
	const partial = await read(store);
	assert.equal(partial.state, "partial");
	assert.equal(partial.mainAggregate, null);
	assert.deepEqual(partial.episodes, []);
	assert.deepEqual(partial.seasons, []);
	store.catalog = async () => null;
	assert.equal((await read(store)).state, "unavailable");
});

test("same-region locale refresh retains the accepted roster; unavailable and future episodes cannot launch", async () => {
	const { store, row } = fixture();
	row.context = { ...row.context, requestedLocale: "de-DE" };
	row.snapshot.seasons[0]!.episodes[1]!.available = false;
	row.snapshot.seasons[0]!.episodes[2]!.releasedAt = "2026-12-01T00:00:00.000Z";
	const result = await read(store);
	assert.equal(result.state, "complete");
	assert.equal(result.episodes[1]!.available, false);
	assert.equal(result.episodes[2]!.available, false);
});

test("catalog read rejects reset, deletion, or replacement during the read", async () => {
	for (const change of ["generation", "deletion", "replacement"] as const) {
		const { store, row } = fixture();
		let settingsReads = 0;
		store.settings = async () => ({
			history_generation: change === "generation" && settingsReads++ ? 4 : 3,
			write_schema_version: 3,
		});
		store.catalog = async (_owner, _generation, _title, snapshot) =>
			snapshot
				? row
				: change === "deletion"
					? null
					: change === "replacement"
						? { ...row, revision: 9 }
						: row;
		await assert.rejects(read(store), {
			code: change === "generation" ? "GENERATION_MISMATCH" : "CATALOG_CHANGED",
		});
	}
});

test("foreign, duplicate or out-of-page progress and mismatched projection are rejected", async () => {
	for (const patch of [
		{ user_id: "other" },
		{ history_generation: 4 },
		{ title_key: "other" },
		{ episode_key: "other" },
	]) {
		const { store, progress } = fixture();
		store.progress = async () => [{ ...progress, ...patch }];
		await assert.rejects(read(store), { code: "INVALID_RESPONSE" });
	}
	const { store, progress, row } = fixture();
	store.progress = async () => [progress, progress];
	await assert.rejects(read(store), { code: "INVALID_RESPONSE" });
	row.projection.seasons[0]!.seasonKey = "different";
	await assert.rejects(read(store), { code: "INVALID_RESPONSE" });
});

test("deleting an unfinished episode during a read invalidates the page even when catalog totals stay unchanged", async () => {
	const { store, progress } = fixture();
	const unfinished = {
		...progress,
		completed_at: null,
		progress: 0.1,
		current_time_seconds: 120,
	};
	let reads = 0;
	store.progress = async () => (reads++ ? [] : [unfinished]);
	await assert.rejects(read(store), { code: "HISTORY_CHANGED" });
});

test("catalog rejects unbounded requests and client ownership before store access", async () => {
	const { store } = fixture();
	store.settings = async () => {
		throw new Error("must not read");
	};
	for (const input of [
		{ ...query, limit: 51 },
		{ ...query, limit: 0 },
		{ ...query, userId: OWNER },
		{ ...query, mode: "shared" },
		{ ...query, provider: "youtube" },
	]) {
		await assert.rejects(read(store, input), { code: "INVALID_REQUEST" });
	}
});

test("catalog route authenticates owner, validates query, and returns private no-store responses", async () => {
	const { store } = fixture();
	let calls = 0;
	const handler = createWatchHistoryGridGet({
		getSession: async () => ({
			userId: OWNER,
			email: "owner@example.invalid",
			plan: "plus",
			source: "extension",
		}),
		read: async ({ userId, input }) => {
			calls++;
			assert.equal(userId, OWNER);
			return read(store, input);
		},
	});
	const url = `http://localhost/api/watch-history/v3/browse/catalog?provider=crunchyroll&titleKey=${TITLE}`;
	const result = await handler(new NextRequest(url));
	assert.equal(result.status, 200);
	assert.equal(result.headers.get("cache-control"), "private, no-store");
	for (const suffix of ["&titleKey=other", "&limit=51", "&ownerUserId=other"]) {
		assert.equal((await handler(new NextRequest(url + suffix))).status, 400);
	}
	assert.equal(calls, 1);
	const denied = createWatchHistoryGridGet({
		getSession: async () => null,
		read: async () => {
			throw new Error("must not read");
		},
	});
	assert.equal((await denied(new NextRequest(url))).status, 401);
});
