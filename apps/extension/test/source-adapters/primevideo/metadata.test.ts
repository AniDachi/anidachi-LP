import { afterEach, describe, expect, it, vi } from "vitest";
import { fixture, gtis, ids, bridgeTransport } from "./fixture";
import { readPrimePage } from "../../../src/source-adapters/primevideo/metadata";
import { inspectPrimeSdk } from "../../../src/source-adapters/primevideo/sdk";
import { primeVideoDefinition } from "../../../src/source-adapters/primevideo/definition";
import { startPrimeBridge } from "../../../src/source-adapters/primevideo/main-bridge";
import {
	PRIME_BINDING,
	primeVideoId,
} from "../../../src/source-adapters/primevideo/contract";
const stops: (() => void)[] = [];
afterEach(() => {
	stops.splice(0).forEach((stop) => stop());
	vi.restoreAllMocks();
	document.body.innerHTML = "";
});
describe("Prime exact public metadata admission", () => {
	it.each([
		"http://www.primevideo.com",
		"https://primevideo.com",
		"https://www.primevideo.com:443",
		"https://www.primevideo.com.evil",
		"https://u@www.primevideo.com",
	])("rejects unsafe host/transport %s", (host) => {
		expect(primeVideoId(`${host}/detail/${ids.first}`)).toBeNull();
	});
	it("accepts direct episode route with season page identity and exact observed membership", () => {
		const f = fixture();
		Object.defineProperty(window, "location", {
			configurable: true,
			value: new URL(
				`https://www.primevideo.com/detail/${ids.first}?autoplay=1`,
			),
		});
		expect(inspectPrimeSdk()?.page.contentId).toBe(ids.first);
		f.next();
		expect(inspectPrimeSdk()?.page.contentId).toBe(ids.second);
		f.data.init.preparations.body.btf.state.episodeList.cardTitleIds = [
			gtis.second,
		];
		f.write();
		expect(inspectPrimeSdk()).toBeNull();
	});
	it.each([
		"wrong-full-id",
		"wrong-compact-link",
		"wrong-ordinal",
		"wrong-title",
		"missing-membership",
		"duplicate-selected",
	])("fails closed for %s", (mode) => {
		const f = fixture(),
			atf = f.data.init.preparations.body.atf.state,
			btf = f.data.init.preparations.body.btf.state;
		if (mode === "wrong-full-id") f.titleInfo.titleId = gtis.movie;
		if (mode === "wrong-compact-link")
			btf.self[gtis.first]!.link = `/detail/${ids.second}`;
		if (mode === "wrong-ordinal") f.titleInfo.episodeNumber = 2;
		if (mode === "wrong-title") f.titleInfo.title = "Other episode";
		if (mode === "missing-membership") btf.episodeList.cardTitleIds = [];
		if (mode === "duplicate-selected")
			atf.seasons[gtis.season]![0]!.isSelected = true;
		f.write();
		expect(inspectPrimeSdk()).toBeNull();
	});
	it("does not infer compactGTI or a country from locale, and suspends ambiguous anchor history only", () => {
		const f = fixture();
		const seasons =
			f.data.init.preparations.body.atf.state.seasons[gtis.season]!;
		seasons.push({ ...seasons[0]! });
		f.write();
		expect(inspectPrimeSdk()?.page.metadata.identity).toBeNull();
		expect(inspectPrimeSdk()?.page.contentId).toBe(ids.first);
		f.context.playerInfo.info.territory = "";
		expect(inspectPrimeSdk()?.page.metadata.context).toBeNull();
		f.data.init.preparations.body.btf.state.self[gtis.second]!.compactGTI = "";
		f.next();
		f.write();
		expect(inspectPrimeSdk()).toBeNull();
	});
	it("maps movie identity only through observed full/compact GTI record", () => {
		const f = fixture();
		Object.defineProperty(window, "location", {
			configurable: true,
			value: new URL(`https://www.primevideo.com/detail/${ids.movie}`),
		});
		const data = {
			init: {
				preparations: {
					body: {
						atf: {
							state: {
								self: {
									[gtis.movie]: {
										gti: gtis.movie,
										compactGTI: ids.movie,
										link: `/detail/${ids.movie}`,
										titleType: "movie",
									},
								},
								detail: {
									headerDetail: {
										[gtis.movie]: {
											title: "Hunting Season",
											titleType: "movie",
										},
									},
								},
							},
						},
					},
				},
			},
		};
		document.getElementById("dv-web-page-hydration-data")!.textContent =
			JSON.stringify(data);
		const page = readPrimePage(
			document,
			{ type: "MOVIE", titleId: gtis.movie, title: "Hunting Season" },
			"US",
			"en_US",
		);
		expect(page?.metadata.identity).toEqual({
			kind: "movie",
			providerMovieId: ids.movie,
		});
		expect(page?.catalog).toBeNull();
		f.context.webPlayer.isPlayerOpen = false;
		expect(inspectPrimeSdk()).toBeNull();
	});
	it("navigates by verified playing source, preserving room hash and autoplay decoration", async () => {
		const f = fixture();
		bridgeTransport();
		stops.push(startPrimeBridge());
		const assign = vi.fn();
		Object.defineProperty(window, "location", {
			configurable: true,
			value: {
				href: `https://www.primevideo.com/detail/${ids.first}`,
				hostname: "www.primevideo.com",
				origin: "https://www.primevideo.com",
				assign,
			},
		});
		const url = `https://www.primevideo.com/detail/${ids.first}`;
		const source = {
			title: "Episode",
			provider: "primevideo" as const,
			sourceUrl: url,
			canonicalUrl: url,
			videoFingerprint: `primevideo|detail/${ids.first}`,
		};
		const context = {
			roomProvider: "primevideo" as const,
			roomId: "room",
			signal: new AbortController().signal,
		};
		expect(await primeVideoDefinition.ensureSource(source, context)).toEqual({
			status: "already-current",
		});
		f.next();
		f.video.dispatchEvent(new Event("timeupdate"));
		expect(
			(await primeVideoDefinition.ensureSource(source, context)).status,
		).toBe("navigation-started");
		expect(assign).toHaveBeenCalledWith(`${url}?autoplay=1#anidachiRoom=room`);
		expect(f.video.hasAttribute(PRIME_BINDING)).toBe(false);
		const abort = new AbortController();
		abort.abort();
		expect(
			(
				await primeVideoDefinition.ensureSource(source, {
					...context,
					signal: abort.signal,
				})
			).status,
		).toBe("failed");
	});
});

it("admits unplayed episodes only with launched record and enabled exact Play action; deduplicates responsive links", () => {
	const f = fixture();
	const episodes = () => inspectPrimeSdk()?.page.catalog?.seasons[0]?.episodes;
	expect(episodes()).toHaveLength(2);
	for (const action of document.querySelectorAll(
		'a[data-testid="episodes-playbutton"]',
	))
		if (action.getAttribute("href")?.includes(ids.second))
			action.setAttribute("aria-disabled", "true");
	expect(episodes()).toHaveLength(1);
	for (const action of document.querySelectorAll(
		'a[data-testid="episodes-playbutton"]',
	))
		action.removeAttribute("aria-disabled");
	f.data.init.preparations.body.btf.state.self[gtis.second]!.isLaunched = false;
	f.write();
	expect(episodes()).toHaveLength(1);
	f.data.init.preparations.body.btf.state.self[gtis.second]!.isLaunched = true;
	f.write();
	for (const action of document.querySelectorAll(
		'a[data-testid="episodes-playbutton"]',
	))
		if (action.getAttribute("href")?.includes(ids.second))
			action.setAttribute(
				"href",
				`https://evil.example/detail/${ids.second}?autoplay=1`,
			);
	expect(episodes()).toHaveLength(1);
});

it.each([
	"different-link",
	"different-full-id",
	"missing-anchor",
	"self-conflict",
	"self-type-conflict",
	"duplicate-self-conflict",
	"reverse-self-conflict",
])("suspends history but preserves verified playback for %s season1 evidence", (mode) => {
	const f = fixture(),
		body = f.data.init.preparations.body;
	const secondList = structuredClone(body.atf.state.seasons);
	const anchor = secondList[gtis.season]![0]!;
	if (mode === "different-link") anchor.seasonLink = `/detail/${ids.movie}`;
	if (mode === "different-full-id") anchor.seasonId = gtis.movie;
	if (mode === "missing-anchor") secondList[gtis.season]!.splice(0, 1);
	if (mode === "duplicate-self-conflict")
		Object.assign(body.atf.state.self, {
			[gtis.anchor]: {
				gti: gtis.anchor,
				compactGTI: ids.anchor,
				link: `/detail/${ids.anchor}`,
				titleType: "season",
				sequenceNumber: 1,
				isLaunched: true,
			},
		});
	if (mode === "reverse-self-conflict")
		Object.assign(body.btf.state.self, {
			[gtis.movie]: {
				gti: gtis.movie,
				compactGTI: ids.anchor,
				link: `/detail/${ids.anchor}`,
				titleType: "season",
				sequenceNumber: 1,
				isLaunched: true,
			},
		});
	if (mode.startsWith("self-") || mode === "duplicate-self-conflict")
		Object.assign(body.btf.state.self, {
			[gtis.anchor]: {
				gti: gtis.anchor,
				compactGTI: ids.movie,
				link: `/detail/${ids.movie}`,
				titleType: mode === "self-type-conflict" ? "episode" : "season",
				sequenceNumber: 1,
				isLaunched: true,
			},
		});
	Object.assign(body.btf.state, { seasons: secondList });
	f.write();
	const sdk = inspectPrimeSdk();
	expect(sdk?.page.contentId).toBe(ids.first);
	expect(sdk?.snapshot.phase).toBe("content");
	expect(sdk?.page.metadata.identity).toBeNull();
	expect(sdk?.page.catalog).toBeNull();
});
it("accepts agreeing ATF/BTF season1 evidence and matching known self identity", () => {
	const f = fixture(),
		body = f.data.init.preparations.body;
	Object.assign(body.btf.state, {
		seasons: structuredClone(body.atf.state.seasons),
	});
	Object.assign(body.btf.state.self, {
		[gtis.anchor]: {
			gti: gtis.anchor,
			compactGTI: ids.anchor,
			link: `/detail/${ids.anchor}`,
			titleType: "season",
			sequenceNumber: 1,
			isLaunched: true,
		},
	});
	f.write();
	expect(inspectPrimeSdk()?.page.metadata.identity).toMatchObject({
		seriesAnchorSeasonId: ids.anchor,
	});
	expect(inspectPrimeSdk()?.page.catalog?.providerSeriesId).toBe(ids.anchor);
});

it("admits regional metadata through SDK, binding and provider definition across native episode replacement", () => {
	const f = fixture();
	const raw = JSON.stringify(f.data).replaceAll(
		"/detail/",
		"/region/na/detail/",
	);
	document.getElementById("dv-web-page-hydration-data")!.textContent = raw;
	Object.defineProperty(window, "location", {
		configurable: true,
		value: new URL(
			`https://www.primevideo.com/region/na/detail/${ids.season}?ref_=x`,
		),
	});
	stops.push(startPrimeBridge());
	expect(inspectPrimeSdk()?.page.contentId).toBe(ids.first);
	expect(primeVideoDefinition.detect(f.video)?.provider).toBe("primevideo");
	f.next();
	document.getElementById("dv-web-page-hydration-data")!.textContent =
		JSON.stringify(f.data).replaceAll("/detail/", "/region/na/detail/");
	expect(inspectPrimeSdk()?.page.contentId).toBe(ids.second);
});
