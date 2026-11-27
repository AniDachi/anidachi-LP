// @vitest-environment node
import { expect, it, vi } from "vitest";
import { hboCatalogRoute, startHboNativeCatalog } from "../src/source-adapters/hbomax/native-catalog";
import { hboMaxSourceUrl } from "@anidachi/protocol";

const id = "bf44a7dc-e340-4207-ae67-3736179c47c6";
const series = "1fbc488d-c7b5-4d38-aad4-f60dcbd85d23";
const season = "30635da6-4593-4b9f-ae2e-f9642d5f2209";
const path = "/video/watch/" + id;
const cms = "https://default.any-apac.prd.api.hbomax.com/cms/routes" + path;
const origin = "https://www.hbomax.com";
const body = { data: { type: "route", id: "route", attributes: { url: path } }, included: [
	{ type: "show", id: series, attributes: { name: "Big Little Lies" } },
	{ type: "season", id: season, attributes: { seasonNumber: 1 } },
	{ type: "video", id, attributes: { videoType: "EPISODE", seasonNumber: 1, episodeNumber: 2, name: "Serious Mothering" },
		relationships: { season: { data: { type: "season", id: season } }, show: { data: { type: "show", id: series } } } },
] };

it("observes only HBO catalog routes", () => {
	expect(hboCatalogRoute(cms)).toBe(hboMaxSourceUrl(id));
	for (const address of [cms.replace("prd.api.hbomax.com", "prd.api.hbomax.com.invalid"), cms.replace("https:", "http:"),
		cms.replace("/cms/routes", "/license"), cms.replace(path, "/home"), cms.replace(path, "/show/not-an-id")])
		expect(hboCatalogRoute(address)).toBeNull();
});

it("leaves the native response intact and replays the exact episode to a late content script", async () => {
	const document = Object.assign(new EventTarget(), { location: new URL(origin + path), documentElement: { lang: "en" } });
	const response = new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
	Object.defineProperty(response, "url", { value: cms });
	const original = vi.fn<typeof fetch>().mockResolvedValue(response);
	const window = Object.assign(new EventTarget(), { document, fetch: original as typeof fetch });
	const stop = startHboNativeCatalog(window as unknown as Window);
	const packets: Array<{ playbackId: string; metadata: { episodeTitle: string } }> = [];
	const receive = (e: Event) => packets.push(JSON.parse((e as CustomEvent<string>).detail));
	document.addEventListener("anidachi:hbo-cms", receive);
	try {
		expect(await (await window.fetch(cms)).json()).toEqual(body);
		await vi.waitFor(() => expect(packets).toHaveLength(1));
		document.documentElement.lang = "en-US";
		document.dispatchEvent(new Event("anidachi:hbo-cms-read"));
		expect(packets[1]).toMatchObject({ playbackId: id, locale: "en-US", metadata: { episodeTitle: "Serious Mothering" } });
		for (const language of ["en-GB", "es-MX"]) {
			document.documentElement.lang = language;
			document.dispatchEvent(new Event("anidachi:hbo-cms-read"));
			expect(packets).toHaveLength(2);
		}
		document.documentElement.lang = "en-US";
		document.location = new URL(origin + "/video/watch/" + season);
		document.dispatchEvent(new Event("anidachi:hbo-cms-read"));
		expect(packets).toHaveLength(2);
		expect(original).toHaveBeenCalledTimes(1);
	} finally {
		stop();
		document.removeEventListener("anidachi:hbo-cms", receive);
	}
});
