import { afterEach, describe, expect, it } from "vitest";
import { fixture, gtis, ids } from "./fixture";
import { inspectPrimeSdk } from "../../../src/source-adapters/primevideo/sdk";
import { readPrimePage } from "../../../src/source-adapters/primevideo/metadata";
import amazon from "./amazon-movie-public.json";

afterEach(() => {
	document.head.innerHTML = "";
	document.body.innerHTML = "";
});

describe("Prime identity is independent of provider display labels", () => {
	it.each([
		["Sadie, Sadie...", "Sadie, Sadie ..."],
		["Pilot", "Пилот"],
		["Episode One", "ตอนที่หนึ่ง"],
		["L'amour", "L’amour"],
	])("accepts the same episode with SDK %s and page %s", (sdkLabel, pageLabel) => {
		const f = fixture();
		f.titleInfo.title = sdkLabel;
		f.data.init.preparations.body.btf.state.detail.detail[gtis.first]!.title =
			pageLabel;
		f.write();
		expect(inspectPrimeSdk()?.snapshot).toMatchObject({
			contentId: ids.first,
			metadata: { episodeTitle: pageLabel, seasonNumber: 5, episodeNumber: 1 },
		});
	});
	it("keeps the current page series label when the SDK uses another language", () => {
		const f = fixture();
		f.titleInfo.seriesTitle = "Пацаны";
		expect(inspectPrimeSdk()?.page.metadata.title).toBe("The Boys");
	});
	it.each([
		"wrong-id",
		"wrong-ordinal",
		"wrong-link",
		"missing-membership",
	])("still rejects %s even when translated labels agree", (mode) => {
		const f = fixture();
		if (mode === "wrong-id") f.titleInfo.titleId = gtis.movie;
		if (mode === "wrong-ordinal") f.titleInfo.episodeNumber = 2;
		if (mode === "wrong-link")
			f.data.init.preparations.body.btf.state.self[gtis.first]!.link =
				`/detail/${ids.second}`;
		if (mode === "missing-membership")
			f.data.init.preparations.body.btf.state.episodeList.cardTitleIds = [];
		f.write();
		expect(inspectPrimeSdk()).toBeNull();
	});
	it("accepts a localized movie label only with the same proven GTI/ASIN mapping", () => {
		Object.defineProperty(window, "location", {
			configurable: true,
			value: new URL(amazon.url),
		});
		document.head.innerHTML = `<link rel="canonical" href="${amazon.canonical}">`;
		document.body.innerHTML =
			'<script id="dv-web-page-hydration-data" type="application/json"></script>';
		document.querySelector("script")!.textContent = JSON.stringify(
			amazon.hydration,
		);
		const sdk = { type: "MOVIE", titleId: gtis.movie, title: "Сезон охоты" };
		expect(readPrimePage(document, sdk, "US", "en_US")?.metadata).toMatchObject(
			{
				identity: { kind: "movie", providerMovieId: ids.movie },
				title: "Hunting Season",
			},
		);
		expect(
			readPrimePage(document, { ...sdk, titleId: gtis.first }, "US", "en_US"),
		).toBeNull();
	});
});
