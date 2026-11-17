import { afterEach, describe, expect, it, vi } from "vitest";
import { PRIME_VIDEO_DOMAIN_ROOTS } from "@anidachi/protocol";
import { fixture, gtis, ids } from "./fixture";
import { inspectPrimeSdk } from "../../../src/source-adapters/primevideo/sdk";
import { startPrimeBridge } from "../../../src/source-adapters/primevideo/main-bridge";
import { readPrimeBinding } from "../../../src/source-adapters/primevideo/contract";

// Observed Rings of Power S3 E2: the address is the episode compactGTI,
// while the same page's canonical URL points to its selected season.
function episodeWithSeasonCanonical(host = "primevideo.com") {
	const f = fixture();
	const prefix =
		host === "primevideo.com" ? "/region/na/detail/" : "/-/de/gp/video/detail/";
	window.location.href = `https://www.${host}${prefix}${ids.first}?autoplay=1`;
	const body = f.data.init.preparations.body;
	for (const state of [body.atf.state, body.btf.state])
		for (const row of Object.values(state.self))
			row.link = `${prefix}${row.compactGTI}`;
	for (const row of body.atf.state.seasons[gtis.season]!)
		row.seasonLink = `${prefix}${row.isSelected ? ids.season : ids.anchor}`;
	f.write();
	const canonical = document.createElement("link");
	canonical.rel = "canonical";
	canonical.href = `https://www.${host}${prefix}${ids.season}`;
	document.head.append(canonical);
	return { ...f, canonical, prefix };
}

afterEach(() => {
	document.head.innerHTML = "";
	document.body.innerHTML = "";
	vi.restoreAllMocks();
});

describe("Prime episode pages with a parent-season canonical", () => {
	it.each(
		PRIME_VIDEO_DOMAIN_ROOTS,
	)("binds the exact episode immediately on %s", (host) => {
		const f = episodeWithSeasonCanonical(host);
		const stop = startPrimeBridge();
		try {
			expect(readPrimeBinding(f.video)?.contentId).toBe(ids.first);
			expect(inspectPrimeSdk()?.snapshot.metadata.episodeNumber).toBe(1);
			f.next();
			f.video.dispatchEvent(new Event("timeupdate"));
			expect(readPrimeBinding(f.video)?.contentId).toBe(ids.second);
		} finally {
			stop();
		}
	});
	it("also accepts the committed live page with the same initial season canonical", () => {
		const f = episodeWithSeasonCanonical();
		const body = f.data.init.preparations.body;
		for (const state of [body.atf.state, body.btf.state])
			Object.assign(state, { pageTitleId: gtis.season });
		f.write();
		const root = document.createElement("div");
		root.id = "dv-web-page-hydration-root";
		document.body.append(root);
		Reflect.set(root, "__reactContainer$observed", {
			stateNode: { current: { child: { memoizedProps: { value: body } } } },
		});
		vi.spyOn(window.performance, "getEntriesByType").mockReturnValue([
			{ name: location.href } as PerformanceEntry,
		]);
		expect(inspectPrimeSdk()?.snapshot.contentId).toBe(ids.first);
	});
	it.each([
		"other-season",
		"other-episode",
		"missing-membership",
		"wrong-ordinal",
		"cross-origin",
	])("rejects %s instead of borrowing a season canonical", (mode) => {
		const f = episodeWithSeasonCanonical();
		const body = f.data.init.preparations.body;
		if (mode === "other-season") {
			body.atf.state.self[gtis.anchor] = {
				...body.atf.state.self[gtis.season]!,
				gti: gtis.anchor,
				compactGTI: ids.anchor,
				link: `${f.prefix}${ids.anchor}`,
				sequenceNumber: 1,
			};
			f.canonical.href = `https://www.primevideo.com${f.prefix}${ids.anchor}`;
		}
		if (mode === "other-episode")
			f.canonical.href = `https://www.primevideo.com${f.prefix}${ids.second}`;
		if (mode === "missing-membership")
			body.btf.state.episodeList.cardTitleIds = [gtis.second];
		if (mode === "wrong-ordinal") f.titleInfo.seasonNumber = 99;
		if (mode === "cross-origin")
			f.canonical.href = `https://www.amazon.com/gp/video/detail/${ids.season}`;
		f.write();
		expect(inspectPrimeSdk()).toBeNull();
	});
});
