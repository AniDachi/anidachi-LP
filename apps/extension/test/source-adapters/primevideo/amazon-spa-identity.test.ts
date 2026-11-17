import { afterEach, expect, it, vi } from "vitest";
import evidence from "./amazon-series-public.json";
import movie from "./amazon-movie-public.json";
import { fixture } from "./fixture";
import { inspectPrimeSdk } from "../../../src/source-adapters/primevideo/sdk";
import { readPrimeBinding } from "../../../src/source-adapters/primevideo/contract";
import { startPrimeBridge } from "../../../src/source-adapters/primevideo/main-bridge";
import { primeDocumentRouteId } from "../../../src/source-adapters/primevideo/metadata";
import { readPrimeCatalogPage } from "../../../src/source-adapters/primevideo/catalog-page";
import { loadPrimeCatalog } from "../../../src/source-adapters/primevideo/catalog";
import { createPrimeLaunchCapture } from "../../../src/prime-launch-capture";
import type { VideoAdapter } from "../../../src/source-adapters/core/types";

function observedPage() {
	const f = fixture();
	const body = structuredClone(evidence.body);
	document.documentElement.lang = evidence.locale.replace("_", "-");
	Object.defineProperty(window, "location", {
		configurable: true,
		value: new URL(evidence.url),
	});
	vi.spyOn(performance, "getEntriesByType").mockReturnValue([
		{ name: evidence.initialUrl } as PerformanceEntry,
	]);
	document.head.innerHTML = `<link rel="canonical" href="${evidence.canonical}">`;
	document.getElementById("dv-web-page-hydration-data")!.textContent = "{}";
	const page = document.createElement("div");
	page.id = "dv-web-page-hydration-root";
	document.body.append(page);
	Reflect.set(page, "__reactContainer$observed", {
		stateNode: { current: { child: { memoizedProps: { value: body } } } },
	});
	Object.assign(f.titleInfo, evidence.titleInfo);
	f.context.webPlayer.currentTitleId = evidence.titleInfo.titleId;
	return { ...f, body, page };
}
afterEach(() => {
	document.body.innerHTML = "";
	document.head.innerHTML = "";
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it("binds the observed Amazon SPA episode despite an unmapped marketing ASIN and stale storefront canonical", () => {
	const f = observedPage();
	const stop = startPrimeBridge();
	try {
		expect(readPrimeBinding(f.video)?.contentId).toBe(
			"0GZG3MEMW58HH47GE4QV0Z1OOR",
		);
		expect(inspectPrimeSdk()?.page.metadata).toMatchObject({
			title: "Love in Disguise",
			seasonNumber: 1,
			episodeNumber: 1,
		});
		expect(
			inspectPrimeSdk()?.page.catalog?.seasons[0]?.episodes[0]
				?.providerEpisodeIdentifier,
		).toBe("0GZG3MEMW58HH47GE4QV0Z1OOR");
		// Playback evidence must not manufacture URL alias proof for launches.
		expect(primeDocumentRouteId(document, evidence.url)).toBeNull();
	} finally {
		stop();
	}
});

it("tracks native next episode on the same Amazon address independently of localized labels", () => {
	const f = observedPage();
	f.titleInfo.title = "첫 번째 에피소드";
	expect(inspectPrimeSdk()?.snapshot.contentId).toBe(
		"0GZG3MEMW58HH47GE4QV0Z1OOR",
	);
	Object.assign(f.titleInfo, {
		titleId: "amzn1.dv.gti.6ebb1a85-d6fc-41db-b23f-f13400a7270a",
		episodeNumber: 2,
		title: "Folge 2",
	});
	f.context.webPlayer.currentTitleId = f.titleInfo.titleId;
	expect(inspectPrimeSdk()?.snapshot.contentId).toBe(
		"0LPLWZPJJ1XGWTTF4BRK893BPM",
	);
});

it.each([
	"missing-page",
	"different-page",
	"missing-member",
	"sdk-ordinal",
	"unknown-compact",
	"static-only",
])("does not use the live ASIN fallback for %s", (mode) => {
	const f = observedPage();
	if (mode === "missing-page") f.body.atf.state.pageTitleId = "";
	if (mode === "different-page") f.body.atf.state.pageTitleId = "B0HLGGRD8Y";
	if (mode === "missing-member") f.body.btf.state.episodeList.cardTitleIds = [];
	if (mode === "sdk-ordinal") f.titleInfo.episodeNumber = 9;
	if (mode === "unknown-compact")
		window.location.pathname = "/gp/video/detail/0AAAAAAAAAAAAAAAAAAAAAAAAA";
	if (mode === "static-only") {
		f.page.remove();
		document.getElementById("dv-web-page-hydration-data")!.textContent =
			JSON.stringify({ init: { preparations: { body: f.body } } });
	}
	expect(inspectPrimeSdk()).toBeNull();
});

it("still admits a direct reload through Amazon's same-origin season canonical", () => {
	const f = observedPage();
	vi.spyOn(performance, "getEntriesByType").mockReturnValue([
		{ name: evidence.url } as PerformanceEntry,
	]);
	document
		.querySelector("link")!
		.setAttribute("href", "https://www.amazon.com/gp/video/detail/B0HL3HTYVG");
	document.getElementById("dv-web-page-hydration-data")!.textContent =
		JSON.stringify({ init: { preparations: { body: f.body } } });
	expect(inspectPrimeSdk()?.snapshot.contentId).toBe(
		"0GZG3MEMW58HH47GE4QV0Z1OOR",
	);
});

it("reads all ten episodes of the observed single-season Amazon catalog without a season switcher", () => {
	observedPage();
	const catalog = readPrimeCatalogPage(document, location.origin);
	expect(catalog?.anchor).toBe("0INEYNSINLQC82ZUIFLK7VNV09");
	expect(catalog?.season.episodes).toHaveLength(10);
});

it("preserves the proven ten episodes as a partial series when Amazon omits its season roster", async () => {
	const f = observedPage();
	vi.stubGlobal("fetch", vi.fn(async (url: string) => {
		const response = new Response(`<html lang="en-US"><script id="dv-web-page-hydration-data">${JSON.stringify({init:{preparations:{body:f.body}}})}</script></html>`, {headers:{"content-type":"text/html"}});
		Object.defineProperty(response, "url", {value:url});
		return response;
	}));
	const snapshot = {...inspectPrimeSdk()!.snapshot, generation: "current"};
	const catalog = await loadPrimeCatalog(snapshot, new AbortController().signal, () => true);
	expect(catalog?.seasons[0]?.episodes).toHaveLength(10);
	expect(catalog?.completeness).toBe("partial");
});

it("never hands a new SPA ASIN invitation the initial movie's canonical identity", () => {
 const f = observedPage();
 const body = structuredClone(movie.hydration.init.preparations.body);
 Reflect.set(f.page, "__reactContainer$observed", {stateNode:{current:{child:{memoizedProps:{value:body}}}}});
 vi.spyOn(performance, "getEntriesByType").mockReturnValue([{name:movie.url} as PerformanceEntry]);
 document.querySelector("link")!.setAttribute("href", movie.canonical);
 document.getElementById("dv-web-page-hydration-data")!.textContent = JSON.stringify(movie.hydration);
 Object.assign(f.titleInfo, {type:"MOVIE",titleId:"amzn1.dv.gti.3e561ae5-0185-4a0d-a821-0163dadcf753",title:"Hunting Season"});
 f.context.webPlayer.currentTitleId = f.titleInfo.titleId;
 window.location.hash = "anidachiRoom=stale-canonical-room";
 const href = window.location.href;
 expect(inspectPrimeSdk()?.snapshot.contentId).toBe("0IUGS56V361WRU60PCC5XH5D8Z");
 const capture = createPrimeLaunchCapture(href);
 expect(capture.handoff({provider:"primevideo",getFingerprint:()=>"primevideo|detail/0IUGS56V361WRU60PCC5XH5D8Z"} as VideoAdapter, href)).toBeNull();
 expect(primeDocumentRouteId(document, href)).toBeNull();
 // Genuine direct-load canonical evidence continues to resolve an alias.
 vi.spyOn(performance, "getEntriesByType").mockReturnValue([{name:href} as PerformanceEntry]);
 expect(primeDocumentRouteId(document, href)).toBe("0IUGS56V361WRU60PCC5XH5D8Z");
});
