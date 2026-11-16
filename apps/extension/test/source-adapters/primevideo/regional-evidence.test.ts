import { afterEach, expect, it } from "vitest";
import amazon from "./amazon-movie-public.json";
import sor from "./regional-sor-public.json";
import { readPrimePage } from "../../../src/source-adapters/primevideo/metadata";
function page(data: typeof amazon | typeof sor) {
	Object.defineProperty(window, "location", {
		configurable: true,
		value: new URL(data.url),
	});
	document.head.innerHTML = `<link rel="canonical" href="${data.canonical}">`;
	document.body.innerHTML =
		'<script id="dv-web-page-hydration-data" type="application/json"></script>';
	document.getElementById("dv-web-page-hydration-data")!.textContent =
		JSON.stringify(data.hydration);
	for (const item of data.playLinks) {
		const a = document.createElement("a");
		a.setAttribute("href", item.href);
		a.dataset.testid = "episodes-playbutton";
		if (item.role) a.setAttribute("role", item.role);
		if (item.ariaDisabled) a.setAttribute("aria-disabled", item.ariaDisabled);
		if (item.disabled) a.setAttribute("disabled", "");
		document.body.append(a);
	}
}
afterEach(() => {
	document.head.innerHTML = "";
	document.body.innerHTML = "";
});
it("admits the observed SOR regional page and actual SDK title evidence", () => {
	page(sor);
	const result = readPrimePage(
		document,
		sor.titleInfo,
		sor.territory,
		sor.locale,
	);
	expect(result?.contentId).toBe("0T3GCJX165LY69GGRPABT1WJ7S");
	expect(result?.catalog?.completeness).toBe("partial");
	expect(result?.metadata.identity).toEqual({
		kind: "episode",
		seriesAnchorSeasonId: "0GS9E1N0I97ENRMJPEH38ZYO1J",
		providerSeasonIdentifier: "0GS9E1N0I97ENRMJPEH38ZYO1J",
		providerEpisodeIdentifier: "0T3GCJX165LY69GGRPABT1WJ7S",
	});
});
it("maps ASIN-keyed public self only with matching synthetic SDK evidence and same-origin canonical", () => {
	page(amazon);
	expect(
		readPrimePage(document, amazon.titleInfo, amazon.territory, amazon.locale),
	).toBeNull();
	const sdk = {
		titleId: "amzn1.dv.gti.3e561ae5-0185-4a0d-a821-0163dadcf753",
		title: "Hunting Season",
		type: "MOVIE",
	};
	expect(
		readPrimePage(document, sdk, amazon.territory, amazon.locale)?.contentId,
	).toBe("0IUGS56V361WRU60PCC5XH5D8Z");
	document.querySelector("link")!.remove();
	expect(
		readPrimePage(document, sdk, amazon.territory, amazon.locale),
	).toBeNull();
});

it("captures an ASIN room launch before metadata arrives, then hands off the proven SDK fingerprint", async () => {
	const { createPrimeLaunchCapture } = await import(
		"../../../src/prime-launch-capture"
	);
	const href = `${amazon.url}#anidachiRoom=amazon-room`;
	Object.defineProperty(window, "location", {
		configurable: true,
		value: new URL(href),
	});
	const capture = createPrimeLaunchCapture(href);
	page(amazon);
	const adapter = {
		provider: "primevideo",
		getFingerprint: () => `primevideo|detail/0IUGS56V361WRU60PCC5XH5D8Z`,
	} as import("../../../src/source-adapters/core/types").VideoAdapter;
	expect(
		capture
			.handoff(adapter, location.href)
			?.readRoom(location.href, adapter.getFingerprint()),
	).toBe("amazon-room");
});

it("rejects cross-origin canonical, mismatched self GTI and ambiguous movie compact mappings", () => {
	page(amazon);
	const sdk = {
		titleId: "amzn1.dv.gti.3e561ae5-0185-4a0d-a821-0163dadcf753",
		title: "Hunting Season",
		type: "MOVIE",
	};
	document
		.querySelector("link")!
		.setAttribute("href", "https://www.amazon.de/gp/video/detail/B0FX2ZCPFK");
	expect(
		readPrimePage(document, sdk, amazon.territory, amazon.locale),
	).toBeNull();
	page(amazon);
	const data = structuredClone(amazon.hydration);
	const state = data.init.preparations.body.atf.state;
	Object.assign(state.self, {
		B012345678: {
			...state.self.B0FX2ZCPFK,
			gti: "amzn1.dv.gti.another",
			link: "/gp/video/detail/B012345678",
		},
	});
	document.getElementById("dv-web-page-hydration-data")!.textContent =
		JSON.stringify(data);
	expect(
		readPrimePage(document, sdk, amazon.territory, amazon.locale),
	).toBeNull();
});

it("keeps proven ASIN playback already-current for room navigation without leaving marketplace", async () => {
	const { fixture, gtis, ids, bridgeTransport } = await import("./fixture");
	const { startPrimeBridge } = await import(
		"../../../src/source-adapters/primevideo/main-bridge"
	);
	const { primeVideoDefinition } = await import(
		"../../../src/source-adapters/primevideo/definition"
	);
	const f = fixture();
	page(amazon);
	document.body.append(f.root);
	Object.assign(f.titleInfo, {
		type: "MOVIE",
		titleId: gtis.movie,
		title: "Hunting Season",
	});
	f.context.webPlayer.currentTitleId = gtis.movie;
	const transport = bridgeTransport();
	const stop = startPrimeBridge();
	try {
		const sourceUrl = `https://www.primevideo.com/detail/${ids.movie}`;
		const result = await primeVideoDefinition.ensureSource(
			{
				provider: "primevideo",
				title: "Hunting Season",
				sourceUrl,
				canonicalUrl: sourceUrl,
				videoFingerprint: `primevideo|detail/${ids.movie}`,
			},
			{
				roomProvider: "primevideo",
				roomId: "room",
				signal: new AbortController().signal,
			},
		);
		expect(result).toEqual({ status: "already-current" });
		expect(location.href).toBe(amazon.url);
	} finally {
		stop();
		transport.mockRestore();
	}
});

it("invalidates an earlier valid ASIN mapping when another public state contradicts its safe link", () => {
	page(amazon);
	const data = structuredClone(amazon.hydration);
	Object.assign(data.init.preparations.body.btf.state.self, {
		B0FX2ZCPFK: {
			...data.init.preparations.body.atf.state.self.B0FX2ZCPFK,
			link: "https://evil.example/gp/video/detail/B0FX2ZCPFK",
		},
	});
	document.getElementById("dv-web-page-hydration-data")!.textContent =
		JSON.stringify(data);
	const sdk = {
		titleId: "amzn1.dv.gti.3e561ae5-0185-4a0d-a821-0163dadcf753",
		title: "Hunting Season",
		type: "MOVIE",
	};
	expect(
		readPrimePage(document, sdk, amazon.territory, amazon.locale),
	).toBeNull();
});
