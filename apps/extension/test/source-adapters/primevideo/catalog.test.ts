import { afterEach, expect, it, vi } from "vitest";
import { catalogFixture } from "./catalog-fixture";
import { bridgeTransport, ids } from "./fixture";
import { startPrimeBridge } from "../../../src/source-adapters/primevideo/main-bridge";
import { readPrimeBinding } from "../../../src/source-adapters/primevideo/contract";
import { runPrimeCommand } from "../../../src/source-adapters/primevideo/bridge-client";
import { object } from "../../../src/source-adapters/primevideo/metadata";
import {
	PRIME_CATALOG_MAIN_TIMEOUT,
	PRIME_CATALOG_CLIENT_TIMEOUT,
} from "../../../src/source-adapters/primevideo/catalog";
import {
	PRIME_NAVIGATING,
	boundedMessage,
	PrimeResultSchema,
} from "../../../src/source-adapters/primevideo/contract";

const stops: (() => void)[] = [];
afterEach(() => {
	stops.splice(0).forEach((stop) => stop());
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	vi.useRealTimers();
	document.body.innerHTML = "";
});
function setup() {
	const f = catalogFixture();
	bridgeTransport();
	const fetcher = vi.fn(async (url: string, options: RequestInit) => {
		const index = f.pages.findIndex(
			(page) => url === `${location.origin}/detail/${page.season.compact}`,
		);
		expect(options).toMatchObject({
			method: "GET",
			credentials: "same-origin",
			redirect: "error",
		});
		if (index < 0) throw new Error("Unexpected request");
		const response = new Response(f.html(index), {
			headers: { "content-type": "text/html; charset=utf-8" },
		});
		Object.defineProperty(response, "url", { value: url });
		return response;
	});
	vi.stubGlobal("fetch", fetcher);
	stops.push(startPrimeBridge());
	const collect = (signal?: AbortSignal) =>
		runPrimeCommand(
			{
				action: "catalog",
				contentId: ids.first,
				generation: readPrimeBinding(f.video)!.generation,
			},
			signal,
		);
	return { ...f, fetcher, collect };
}
function state(f: ReturnType<typeof setup>, index: number, plane = "btf") {
	return object(
		object(object(f.pages[index]!.data.init.preparations.body)[plane]).state,
	);
}
function response(
	html: string | ReadableStream<Uint8Array>,
	url: string,
	status = 200,
	headers: Record<string, string> = {},
) {
	const value = new Response(html, {
		status,
		headers: { "content-type": "text/html", ...headers },
	});
	Object.defineProperty(value, "url", { value: url });
	return value;
}
it("returns every unplayed season through the actual MAIN/client bridge using typed PLAY despite disabled SSR DOM", async () => {
	const f = setup();
	const result = await f.collect();
	expect(result?.catalog?.completeness).toBe("complete");
	expect(
		result?.catalog?.seasons.map((season) => season.episodes.length),
	).toEqual([2, 1, 1, 2]);
	expect(
		result?.catalog?.seasons.flatMap((season) =>
			season.episodes.map((episode) => episode.providerEpisodeIdentifier),
		),
	).toEqual([
		"0EPISODE000000000000000000",
		"0EPISODE010000000000000000",
		"0EPISODE100000000000000000",
		"0EPISODE200000000000000000",
		ids.first,
		ids.second,
	]);
	expect(f.fetcher).toHaveBeenCalledTimes(4);
	expect(JSON.stringify(result)).not.toMatch(
		/playbackID|preparations|primaryActions|entitlementType|autoplay/,
	);
	for (const season of result!.catalog!.seasons)
		for (const episode of season.episodes) {
			expect(episode.available).toBe(true);
			expect(episode.watchVariants[0]?.sourceUrl).toBe(
				`https://www.primevideo.com/detail/${episode.providerEpisodeIdentifier}`,
			);
		}
});

it.each([
	"absent",
	"empty",
	"empty-actions",
	"explicit-empty-pages",
])("accepts %s non-episode ATF collection while requiring full BTF proof", async (mode) => {
	const f = setup();
	for (let index = 0; index < f.pages.length; index++) {
		const atf = state(f, index, "atf");
		if (mode === "absent") delete atf.episodeList;
		if (mode === "empty") atf.episodeList = {};
		if (mode === "empty-actions") atf.episodeList = { actions: {} };
		if (mode === "explicit-empty-pages")
			atf.episodeList = { actions: { pagination: [], episodePages: [] } };
	}
	document.getElementById("dv-web-page-hydration-data")!.textContent =
		JSON.stringify(f.pages[3]!.data);
	const result = await f.collect();
	expect(result?.catalog?.completeness).toBe("complete");
	expect(
		result?.catalog?.seasons.map((season) => season.episodes.length),
	).toEqual([2, 1, 1, 2]);
	expect(f.fetcher).toHaveBeenCalledTimes(4);
});

it.each([
	"invalid-list",
	"invalid-actions",
	"invalid-pagination",
	"invalid-pages",
	"orphan-count",
	"orphan-pagination",
	"orphan-page",
	"member-without-count",
	"member-without-pagination",
	"conflicting-members",
])("rejects malformed or contradictory ATF list evidence: %s", async (mode) => {
	const f = setup(),
		atf = state(f, 1, "atf");
	const btfList = object(state(f, 1).episodeList);
	if (mode === "invalid-list") atf.episodeList = [];
	if (mode === "invalid-actions") atf.episodeList = { actions: null };
	if (mode === "invalid-pagination")
		atf.episodeList = { actions: { pagination: {} } };
	if (mode === "invalid-pages")
		atf.episodeList = { actions: { episodePages: {} } };
	if (mode === "orphan-count") atf.episodeList = { totalCardSize: 1 };
	if (mode === "orphan-pagination")
		atf.episodeList = { actions: { pagination: [{ next: true }] } };
	if (mode === "orphan-page")
		atf.episodeList = { actions: { episodePages: [{ isSelected: true }] } };
	if (mode === "member-without-count") {
		atf.episodeList = structuredClone(btfList);
		delete object(atf.episodeList).totalCardSize;
	}
	if (mode === "member-without-pagination") {
		atf.episodeList = structuredClone(btfList);
		delete object(object(atf.episodeList).actions).pagination;
	}
	if (mode === "conflicting-members")
		atf.episodeList = {
			...structuredClone(btfList),
			cardTitleIds: [f.pages[0]!.members[0]!.full],
		};
	expect((await f.collect())?.catalog?.completeness).toBe("partial");
});

it("keeps translated titles separate from stable series/season/episode identity", async () => {
	const f = setup();
	for (let index = 0; index < 3; index++) {
		const atf = state(f, index, "atf");
		const detail = object(object(atf.detail).headerDetail);
		Object.assign(object(detail[f.pages[index]!.season.full]), {
			title: "Une saison traduite",
			parentTitle: "Une autre traduction",
		});
		for (const value of Object.values(
			object(object(state(f, index).detail).detail),
		))
			object(value).title = "Titre traduit";
	}
	const result = await f.collect();
	expect(result?.catalog).toMatchObject({
		completeness: "complete",
		providerSeriesId: ids.anchor,
	});
	expect(result?.catalog?.seasons[0]?.title).toBe("Une saison traduite");
});

it.each([
	"missing-season",
	"count",
	"pagination",
	"extra-page",
	"duplicate-member",
	"conflicting-compact",
	"conflicting-detail",
	"wrong-anchor",
	"different-map",
	"wrong-selected",
	"wrong-page-id",
	"unlaunched",
	"missing-play",
	"wrong-play-id",
	"trailer",
	"wrong-play-link",
	"external-play-link",
	"unknown-entitlement",
	"wrong-type",
	"conflicting-play",
])("falls back to honest partial for %s", async (mode) => {
	const f = setup(),
		index = 1,
		btf = state(f, index),
		atf = state(f, index, "atf");
	const member = f.pages[index]!.members[0]!;
	const list = object(btf.episodeList),
		actions = object(list.actions);
	const action = object(object(object(btf.action).btf)[member.full]);
	const plays = action.primaryActions as Record<string, unknown>[];
	const payload = object(plays[0]!.payload),
		playback = object(payload.playback);
	if (mode === "missing-season")
		f.fetcher.mockImplementation(async (url) => {
			if (url.endsWith(f.pages[index]!.season.compact))
				throw new Error("unavailable");
			return response(
				f.html(f.pages.findIndex((page) => url.endsWith(page.season.compact))),
				url,
			);
		});
	if (mode === "count") list.totalCardSize = 2;
	if (mode === "pagination") actions.pagination = [{ nextPage: "unobserved" }];
	if (mode === "extra-page")
		actions.episodePages = [{ isSelected: true }, { isSelected: false }];
	if (mode === "duplicate-member") {
		(list.cardTitleIds as string[]).push(member.full);
		list.totalCardSize = 2;
	}
	if (mode === "conflicting-compact")
		object(object(btf.self)[member.full]).compactGTI = ids.first;
	if (mode === "conflicting-detail")
		object(object(atf.detail).detail)[member.full] = {
			title: "wrong",
			titleType: "episode",
			episodeNumber: 1,
		};
	const rows = object(atf.seasons)[f.pages[index]!.season.full] as Record<
		string,
		unknown
	>[];
	if (mode === "wrong-anchor") rows[0]!.seasonLink = `/detail/${ids.movie}`;
	if (mode === "different-map") rows.pop();
	if (mode === "wrong-selected") {
		rows[1]!.isSelected = false;
		rows[0]!.isSelected = true;
	}
	if (mode === "wrong-page-id") btf.pageTitleId = f.pages[0]!.season.full;
	if (mode === "unlaunched")
		object(object(btf.self)[member.full]).isLaunched = false;
	if (mode === "missing-play") action.primaryActions = [];
	if (mode === "wrong-play-id")
		playback.playbackID = f.pages[0]!.members[0]!.full;
	if (mode === "trailer") playback.isTrailer = true;
	if (mode === "wrong-play-link")
		playback.playbackURL = `/detail/${ids.first}?autoplay=1`;
	if (mode === "external-play-link")
		playback.playbackURL = `https://evil.example/detail/${member.compact}?autoplay=1`;
	if (mode === "unknown-entitlement")
		object(action.messages).entitlementType = "Unknown";
	if (mode === "wrong-type") payload.payloadType = "UNKNOWN";
	if (mode === "conflicting-play") plays.push(structuredClone(plays[0]!));
	const result = await f.collect();
	expect(result?.catalog?.completeness).toBe("partial");
	expect(result?.catalog?.seasons).toHaveLength(1);
	expect(
		result?.catalog?.seasons[0]?.episodes.map(
			(episode) => episode.providerEpisodeIdentifier,
		),
	).toEqual([ids.first]);
});

it.each([
	"external",
	"other-route",
	"encoded-route",
	"http",
])("does not request an unsafe observed season URL: %s", async (mode) => {
	const f = setup();
	const selected = f.pages[3]!,
		atf = state(f, 3, "atf");
	const rows = object(atf.seasons)[selected.season.full] as Record<
		string,
		unknown
	>[];
	rows[1]!.seasonLink =
		mode === "external"
			? `https://evil.example/detail/${ids.movie}`
			: mode === "other-route"
				? `/storefront/${ids.movie}`
				: mode === "encoded-route"
					? `/detail%2f${ids.movie}`
					: mode === "http"
						? `http://www.primevideo.com/detail/${ids.movie}`
						: `/detail/${ids.movie}#autoplay`;
	document.getElementById("dv-web-page-hydration-data")!.textContent =
		JSON.stringify(selected.data);
	expect((await f.collect())?.catalog?.completeness).toBe("partial");
	expect(f.fetcher).not.toHaveBeenCalled();
});

it.each([
	"redirect",
	"different-url",
	"non-html",
	"oversize-header",
	"oversize-stream",
	"http-error",
	"locale",
])("rejects unsafe/incomplete fetched responses: %s", async (mode) => {
	const f = setup();
	let canceled = false;
	f.fetcher.mockImplementation(async (url) => {
		if (mode === "oversize-stream")
			return response(
				new ReadableStream({
					start(controller) {
						controller.enqueue(new Uint8Array(8_000_001));
					},
					cancel() {
						canceled = true;
					},
				}),
				url,
			);
		const value = response(
			f.html(0, mode === "locale" ? "fr-fr" : "en-us"),
			mode === "different-url" ? `${location.origin}/detail/${ids.movie}` : url,
			mode === "http-error" ? 403 : 200,
			mode === "oversize-header"
				? { "content-length": "8000001" }
				: mode === "non-html"
					? { "content-type": "application/json" }
					: {},
		);
		if (mode === "redirect")
			Object.defineProperty(value, "redirected", { value: true });
		return value;
	});
	expect((await f.collect())?.catalog?.completeness).toBe("partial");
	if (mode === "oversize-stream") expect(canceled).toBe(true);
	expect(f.fetcher).toHaveBeenCalledTimes(1);
});

it("deduplicates inflight and repeated untrusted catalog messages without another provider traversal", async () => {
	const f = setup();
	const results = await Promise.all([f.collect(), f.collect(), f.collect()]);
	expect(results.map((result) => result?.catalog?.completeness)).toEqual([
		"complete",
		"complete",
		"complete",
	]);
	await f.collect();
	expect(f.fetcher).toHaveBeenCalledTimes(4);
});

it("bounds total response bytes across the full traversal", async () => {
	const f = setup();
	// Add a fifth observed season so five individually legal responses exceed
	// the overall 32 MB budget. No generated title ID is used by production.
	const extra = structuredClone(f.pages[2]!);
	const oldSeason = extra.season.full;
	extra.season = {
		full: "amzn1.dv.gti.season-six",
		compact: "0SEASONSIX0000000000000000",
		number: 6,
	};
	const body = extra.data.init.preparations.body;
	for (const plane of [body.atf, body.btf]) {
		const value = object(plane.state);
		value.pageTitleId = extra.season.full;
		const self = object(value.self);
		if (self[oldSeason]) {
			self[extra.season.full] = {
				...object(self[oldSeason]),
				gti: extra.season.full,
				compactGTI: extra.season.compact,
				sequenceNumber: 6,
				link: `/detail/${extra.season.compact}`,
			};
			delete self[oldSeason];
		}
		const headers = object(object(value.detail).headerDetail);
		if (headers[oldSeason]) {
			headers[extra.season.full] = {
				...object(headers[oldSeason]),
				seasonNumber: 6,
			};
			delete headers[oldSeason];
		}
		const lists = object(value.seasons);
		if (lists[oldSeason]) {
			lists[extra.season.full] = lists[oldSeason];
			delete lists[oldSeason];
		}
	}
	f.pages.push(extra);
	for (let index = 0; index < f.pages.length; index++) {
		const page = f.pages[index]!,
			lists = object(state(f, index, "atf").seasons);
		lists[page.season.full] = f.pages.map((row) => ({
			seasonId: row.season.full,
			seasonLink: `/detail/${row.season.compact}`,
			sequenceNumber: row.season.number,
			isSelected: row.season.full === page.season.full,
		}));
	}
	document.getElementById("dv-web-page-hydration-data")!.textContent =
		JSON.stringify(f.pages[3]!.data);
	let bytes = 0;
	f.fetcher.mockImplementation(async (url) => {
		const index = f.pages.findIndex((page) =>
			url.endsWith(page.season.compact),
		);
		const html = f.html(index) + " ".repeat(6_500_000);
		bytes += new TextEncoder().encode(html).byteLength;
		return response(html, url);
	});
	expect((await f.collect())?.catalog?.completeness).toBe("partial");
	expect(bytes).toBeGreaterThan(32_000_000);
	expect(f.fetcher).toHaveBeenCalledTimes(5);
});

it.each([
	"cancel",
	"next",
	"region",
	"locale",
	"dispose",
	"navigate",
	"eligibility",
])("aborts actual body reading and fences stale catalog on %s", async (mode) => {
	vi.useFakeTimers();
	const f = setup(),
		abort = new AbortController();
	const observed: { signal?: AbortSignal } = {};
	let canceled = false;
	f.fetcher.mockImplementation(async (url, options) => {
		observed.signal = options.signal as AbortSignal;
		return response(
			new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode("<html>"));
				},
				cancel() {
					canceled = true;
				},
			}),
			url,
		);
	});
	const pending = f.collect(abort.signal);
	await vi.advanceTimersByTimeAsync(1);
	if (mode === "cancel") abort.abort();
	if (mode === "next") f.next();
	if (mode === "region") f.context.playerInfo.info.territory = "CA";
	if (mode === "locale") f.context.webLocale = "fr_FR";
	if (mode === "dispose") stops[0]!();
	if (mode === "navigate") document.dispatchEvent(new Event(PRIME_NAVIGATING));
	if (mode === "eligibility") {
		const actions = object(object(state(f, 3).action).btf);
		object(
			object(actions[f.pages[3]!.members[0]!.full]).messages,
		).entitlementType = "Unknown";
		document.getElementById("dv-web-page-hydration-data")!.textContent =
			JSON.stringify(f.pages[3]!.data);
	}
	await vi.advanceTimersByTimeAsync(300);
	expect(observed.signal?.aborted).toBe(true);
	expect(canceled).toBe(true);
	await vi.advanceTimersByTimeAsync(PRIME_CATALOG_CLIENT_TIMEOUT);
	expect((await pending)?.catalog?.completeness).not.toBe("complete");
	expect(f.fetcher).toHaveBeenCalledTimes(1);
});

it("does not reuse a complete cached result after provider eligibility metadata changes", async () => {
	const f = setup();
	expect((await f.collect())?.catalog?.completeness).toBe("complete");
	const action = object(
		object(object(state(f, 3).action).btf)[f.pages[3]!.members[0]!.full],
	);
	object(action.messages).entitlementType = "Unknown";
	document.getElementById("dv-web-page-hydration-data")!.textContent =
		JSON.stringify(f.pages[3]!.data);
	expect((await f.collect())?.catalog?.completeness).not.toBe("complete");
	expect(f.fetcher).toHaveBeenCalledTimes(4);
});

it("admits the shared 2000-episode normalized catalog within bounded transport limits", async () => {
	const f = setup(),
		result = (await f.collect())!;
	const catalog = result.catalog!,
		season = catalog.seasons[3]!,
		episode = season.episodes[0]!;
	const episodes = [
		episode,
		...Array.from({ length: 1999 }, (_, index) => {
			const id = String(index + 1).padStart(26, "0");
			return {
				...episode,
				episodeKey: `primevideo:episode:${id}`,
				providerEpisodeIdentifier: id,
				title: "E",
				episodeNumber: index + 2,
				order: index + 1,
				watchVariants: [
					{
						...episode.watchVariants[0]!,
						providerContentId: id,
						sourceUrl: `https://www.primevideo.com/detail/${id}`,
					},
				],
			};
		}),
	];
	const full = {
		...result,
		catalog: { ...catalog, seasons: [{ ...season, episodes }] },
	};
	expect(PrimeResultSchema.safeParse(full).success).toBe(true);
	expect(boundedMessage(full)).toBe(true);
	stops[0]!();
	const pending = runPrimeCommand({
		action: "catalog",
		contentId: ids.first,
		generation: result.snapshot!.generation,
	});
	const calls = vi.mocked(window.postMessage).mock.calls;
	const request = calls.at(-1)![0];
	window.postMessage({ ...full, id: request.id }, location.origin);
	expect((await pending)?.catalog?.seasons[0]?.episodes).toHaveLength(2000);
});

it("uses a catalog-only deadline, aborts hung fetch at MAIN deadline, and preserves honest partial", async () => {
	vi.useFakeTimers();
	const f = setup();
	const observed: { signal?: AbortSignal } = {};
	f.fetcher.mockImplementation(
		(_url, options) =>
			new Promise((_resolve, reject) => {
				const signal = options.signal as AbortSignal;
				observed.signal = signal;
				signal.addEventListener("abort", () => reject(new Error("aborted")), {
					once: true,
				});
			}),
	);
	const pending = f.collect();
	await vi.advanceTimersByTimeAsync(4000);
	expect(observed.signal?.aborted).toBe(false);
	await vi.advanceTimersByTimeAsync(PRIME_CATALOG_MAIN_TIMEOUT);
	expect(observed.signal?.aborted).toBe(true);
	expect((await pending)?.catalog?.completeness).toBe("partial");
});

it("cancels the transport at its separate catalog deadline when MAIN is absent", async () => {
	vi.useFakeTimers();
	const f = setup();
	stops[0]!();
	const pending = runPrimeCommand({
		action: "catalog",
		contentId: ids.first,
		generation: "old",
	});
	await vi.advanceTimersByTimeAsync(4000);
	expect(
		vi
			.mocked(window.postMessage)
			.mock.calls.some(([message]) => message.action === "cancel"),
	).toBe(false);
	await vi.advanceTimersByTimeAsync(PRIME_CATALOG_CLIENT_TIMEOUT);
	expect(await pending).toBeNull();
	expect(
		vi
			.mocked(window.postMessage)
			.mock.calls.some(([message]) => message.action === "cancel"),
	).toBe(true);
});

it("fetches observed regional season paths while publishing canonical episode URLs", async () => {
	const f = setup();
	for (const page of f.pages) {
		const transformed = JSON.parse(
			JSON.stringify(page.data).replaceAll("/detail/", "/region/na/detail/"),
		);
		Object.assign(page.data, transformed);
	}
	document.getElementById("dv-web-page-hydration-data")!.textContent =
		JSON.stringify(f.pages[3]!.data);
	Object.defineProperty(window, "location", {
		configurable: true,
		value: new URL(`https://www.primevideo.com/region/na/detail/${ids.season}`),
	});
	f.fetcher.mockImplementation(async (url) => {
		const index = f.pages.findIndex(
			(page) =>
				url === `${location.origin}/region/na/detail/${page.season.compact}`,
		);
		if (index < 0) throw new Error("unobserved path");
		return response(f.html(index), url);
	});
	const result = await f.collect();
	expect(result?.catalog?.completeness).toBe("complete");
	expect(f.fetcher.mock.calls.map((call) => call[0])).toEqual(
		f.pages.map(
			(page) => `${location.origin}/region/na/detail/${page.season.compact}`,
		),
	);
	expect(
		result?.catalog?.seasons[0]?.episodes[0]?.watchVariants[0]?.sourceUrl,
	).toMatch(/^https:\/\/www.primevideo.com\/detail\/[A-Z0-9]{26}$/);
});

it("uses only observed marketplace ASIN season URLs and full-GTI membership", async () => {
	const f = setup();
	const alias = new Map<string, string>();
	for (const page of f.pages) {
		alias.set(page.season.compact, `B${String(alias.size).padStart(9, "0")}`);
		for (const member of page.members)
			alias.set(member.compact, `B${String(alias.size).padStart(9, "0")}`);
	}
	for (const page of f.pages) {
		for (const ref of f.pages)
			Object.assign(page.data.init.preparations.body.atf.state.self, {
				[ref.season.full]: {
					gti: ref.season.full,
					compactGTI: ref.season.compact,
					link: `/detail/${ref.season.compact}`,
					titleType: "season",
					sequenceNumber: ref.season.number,
					isLaunched: true,
				},
			});
		let raw = JSON.stringify(page.data);
		for (const [compact, asin] of alias)
			raw = raw.replaceAll(`/detail/${compact}`, `/gp/video/detail/${asin}`);
		const data = JSON.parse(raw);
		// Official Amazon collections are keyed by ASIN; gti/compact remain explicit.
		for (const plane of ["atf", "btf"]) {
			const state = data.init.preparations.body[plane].state;
			for (const [key, row] of Object.entries(state.self) as [
				string,
				{ compactGTI: string },
			][]) {
				delete state.self[key];
				state.self[alias.get(row.compactGTI)!] = row;
			}
		}
		Object.assign(page.data, data);
	}
	document.getElementById("dv-web-page-hydration-data")!.textContent =
		JSON.stringify(f.pages[3]!.data);
	Object.defineProperty(window, "location", {
		configurable: true,
		value: new URL(
			`https://www.amazon.com/gp/video/detail/${alias.get(ids.season)}`,
		),
	});
	f.fetcher.mockImplementation(async (url) => {
		const index = f.pages.findIndex(
			(page) =>
				url ===
				`https://www.amazon.com/gp/video/detail/${alias.get(page.season.compact)}`,
		);
		if (index < 0) throw Error("unobserved");
		return response(f.html(index), url);
	});
	const result = await f.collect();
	expect(result?.catalog?.completeness).toBe("complete");
	expect(
		f.fetcher.mock.calls.every(([url]) =>
			url.startsWith("https://www.amazon.com/gp/video/detail/B"),
		),
	).toBe(true);
	expect(
		result?.catalog?.seasons[0]?.episodes[0]?.watchVariants[0]?.sourceUrl,
	).toMatch(/^https:\/\/www.primevideo.com\/detail\//);
});
