import { afterEach, expect, it, vi } from "vitest";
import {
	createRetailSeasonAnchor,
	readRetailSeasonAnchor,
} from "../../../src/source-adapters/primevideo/retail-season-anchor";
import { inspectPrimeSdk } from "../../../src/source-adapters/primevideo/sdk";
import { fixture, gtis, ids } from "./fixture";

const asin = "B09ML1QV1S";
const path = "/gp/video/detail/" + asin;
const url = "https://www.amazon.com" + path;
const self = {
	gti: gtis.anchor,
	compactGTI: ids.anchor,
	link: path,
	titleType: "season",
	sequenceNumber: 1,
};
function html(record = self, pageTitleId = asin) {
	const state = { pageTitleId, self: { [asin]: record } };
	const body = { atf: { state }, btf: { state: { pageTitleId } } };
	return (
		'<script id="dv-web-page-hydration-data">' +
		JSON.stringify({ init: { preparations: { body } } }) +
		"</script>"
	);
}
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

it("recovers the canonical series for an episode resumed on a retail season page with one first-season read", async () => {
	const f = fixture();
	Object.defineProperty(window, "location", {
		configurable: true,
		value: new URL("https://www.amazon.com/gp/video/detail/" + ids.season),
	});
	const first =
		f.data.init.preparations.body.atf.state.seasons[gtis.season]![0]!;
	first.seasonId = asin;
	first.seasonLink = path;
	f.write();
	const data = document.getElementById("dv-web-page-hydration-data")!;
	data.textContent = data.textContent!.replaceAll(
		'"/detail/',
		'"/gp/video/detail/',
	);
	const response = new Response(html(), {
		headers: { "content-type": "text/html" },
	});
	Object.defineProperty(response, "url", { value: url });
	const fetch = vi.fn(async () => response);
	vi.stubGlobal("fetch", fetch);
	const anchor = createRetailSeasonAnchor();
	try {
		const snapshot = () =>
			inspectPrimeSdk(document, undefined, anchor.read)?.snapshot;
		expect(snapshot()?.metadata.identity).toBeNull();
		expect(snapshot()?.metadata.identity).toBeNull();
		await vi.waitFor(() =>
			expect(snapshot()?.metadata.identity).toEqual({
				kind: "episode",
				seriesAnchorSeasonId: ids.anchor,
				providerSeasonIdentifier: ids.season,
				providerEpisodeIdentifier: ids.first,
			}),
		);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(
			readRetailSeasonAnchor(html({ ...self, titleType: "movie" }), url),
		).toBeNull();
		expect(
			readRetailSeasonAnchor(html({ ...self, sequenceNumber: 2 }), url),
		).toBeNull();
		expect(readRetailSeasonAnchor(html(self, "B012345678"), url)).toBeNull();
	} finally {
		anchor.stop();
	}
});
