import { afterEach, describe, expect, it, vi } from "vitest";
import { loadHboPublicEpisodes } from "../src/source-adapters/hbomax/public-seasons";
import type { HboCmsEpisode, HboCmsShow } from "../src/source-adapters/hbomax/cms-catalog";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const origin = "https://www.hbomax.com", series = id(1), base = origin + "/show/" + series;
const season = (n: number) => ({ id: id(100 + n), number: n, title: String(n), episodeCount: 1 });
const show: HboCmsShow = { collectionId: "42", seriesId: series, title: "War", seasons: [season(1), season(2), season(3)] };
const episode = (n: number): HboCmsEpisode => ({ id: id(10 + n), seasonNumber: n, number: 1, title: "Episode " + n });
const watch = origin + "/video/watch/" + episode(2).id;
const known = [episode(2)];
const signal = new AbortController().signal;
const row = (n: number) => ({ seriesId: null as string | null, seasonNumber: null as number | null, episodeNumber: 1,
	episodeUrl: "/show/" + series + "/s" + n + "/e1-pilot/" + episode(n).id, title: { full: "Episode " + n, short: "E" + n } });
function group(selected: number, source = show) {
	return { hbomaxId: series, seriesId: series, seasons: source.seasons.map(s => ({
		seasonId: s.id, seasonNumber: s.number, seasonNumberSlug: s.number === 1 ? "" : "s" + s.number,
		numberOfEpisodes: s.number === selected ? 1 : 0, episodes: s.number === selected ? [row(s.number)] : [],
	})) };
}
const markup = (url: string, data: ReturnType<typeof group>, lang = "en-US") =>
	`<html lang="${lang}"><head><link href="${url}" rel="canonical"></head><body>
	<script>{"fake":"<link href='https://foreign.example' rel='canonical'>"}</script>
	<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { mappedData: { unrelated: {}, arbitraryKey: data } } } })}</script>
	<img src="https://foreign.example/unrelated-image"></body></html>`;
function response(url: string, body: string, status = 200, extraHeaders?: Record<string, string>) {
	const reply = new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", ...extraHeaders } });
	Object.defineProperty(reply, "url", { value: url }); return reply;
}
afterEach(() => vi.unstubAllGlobals());

describe("HBO Max public season pages", () => {
	it.each([true, false])("reads every advertised season without native totals (public totals present: %s)", async publicTotals => {
		const source = { ...show, seasons: show.seasons.map(s => ({ ...s, episodeCount: null })) };
		const transport = vi.fn(async (url: string) => {
			const n = Number(/\/s([0-9]+)$/u.exec(url)?.[1] ?? 1);
			const data = group(n, source);
			if (!publicTotals) for (const season of data.seasons) Reflect.deleteProperty(season, "numberOfEpisodes");
			return response(url, markup(url, data));
		});
		vi.stubGlobal("fetch", transport);
		const doc = document.implementation.createHTMLDocument();
		for (let i = 0; i < 2; i++) {
			const result = await loadHboPublicEpisodes(source, known, watch, "en", signal, doc);
			expect(result.map(e => e.id).sort()).toEqual([1, 2, 3].map(n => episode(n).id));
		}
		expect(transport.mock.calls.map(([url]) => url)).toEqual([base, base + "/s2", base + "/s3"]);
	});

	it.each(["network", "503"])("retries the interrupted season only and keeps later seasons after %s", async failure => {
		const source = { ...show, seasons: [1, 2, 3, 4, 5].map(season) };
		let down = true;
		const transport = vi.fn(async (url: string) => {
			const n = Number(/\/s([0-9]+)$/u.exec(url)?.[1] ?? 1);
			if (down && n === 3) {
				if (failure === "network") throw new TypeError("connection interrupted");
				return response(url, "", 503);
			}
			return response(url, markup(url, group(n, source)));
		});
		vi.stubGlobal("fetch", transport);
		const doc = document.implementation.createHTMLDocument();
		const collect = async () => (await loadHboPublicEpisodes(source, known, watch, "en", signal, doc)).map(e => e.seasonNumber).sort();
		expect(await collect()).toEqual([1, 2, 4, 5]);
		expect(transport.mock.calls.filter(([url]) => url.endsWith("/s3"))).toHaveLength(2);
		down = false;
		transport.mockClear();
		expect(await collect()).toEqual([1, 2, 3, 4, 5]);
		expect(transport.mock.calls.map(([url]) => url)).toEqual([base + "/s3"]);
	});

	it.each(["same-season", "cycle", "foreign", "wrong-season"])("follows only a verified, advancing season continuation: %s", async variant => {
		const source = { ...show, seasons: [ { ...season(1), episodeCount: 2 }, season(2) ] };
		const second = base + "?page=2";
		const transport = vi.fn(async (url: string) => {
			const data = group(1, source);
			const selected = data.seasons[0]!;
			selected.numberOfEpisodes = 2;
			if (url === second) {
				selected.episodes[0] = { ...row(1), episodeNumber: 2, episodeUrl: "/show/" + series + "/s1/e2-test/" + id(80) };
			}
			const next = variant === "foreign" ? "https://foreign.example/?page=2" :
				variant === "wrong-season" ? base + "/s2?page=2" : second;
			const link = url === base || variant === "cycle" ? '<link rel="next" href="' + next + '">' : "";
			return response(url, markup(base, data).replace("</head>", link + "</head>"));
		});
		vi.stubGlobal("fetch", transport);
		const result = await loadHboPublicEpisodes(source, known, watch, "en", signal);
		expect(result.map(e => e.id)).toEqual(variant === "same-season" ? [known[0]!.id, episode(1).id, id(80)] : [known[0]!.id]);
		expect(transport.mock.calls.map(([url]) => url)).toEqual(["foreign", "wrong-season"].includes(variant) ? [base] : [base, second]);
	});

	it.each([
		{ country: "VN", locale: "en-US", market: "vn", language: "en", status: 404 },
		{ country: "GP", locale: "pl", market: "fr", language: "fr", status: 200 },
	])("uses the site's advertised $market storefront on a countryless player ($status on the default site)", async ({ country, locale, market, language, status }) => {
		const get = vi.fn().mockResolvedValue({ value: country });
		const doc = { defaultView: { cookieStore: { get } } } as unknown as Document;
		const geo = { brand: { territory: { fr: ["gp"] }, defaultLang: { fr: "fr" } },
			pageLocales: { pathname: "/show/" + series, availableLocales: ["us/en", "vn/vi", "vn/en", "fr/fr"] } };
		const regional = origin + "/" + market + "/" + language + "/show/" + series;
		const transport = vi.fn(async (url: string) => {
			if (url === base) {
				const html = status === 404 ? "<html><head></head></html>" : markup(url, group(1));
				return response(url, html.replace("</head>", '<script id="__DOTCOM_GEO__" type="application/json">' + JSON.stringify(geo) + "</script></head>"), status);
			}
			return response(url, markup(url, group(url.endsWith("/s3") ? 3 : 1)));
		});
		vi.stubGlobal("fetch", transport);
		expect(await loadHboPublicEpisodes(show, known, watch, locale, signal, doc)).toEqual([...known, episode(1), episode(3)]);
		expect(get).toHaveBeenCalledWith("countryCode");
		expect(transport.mock.calls.map(([url]) => url)).toEqual([base, regional, regional + "/s3"]);
		const languageOnlyWatch = watch.replace("/video/watch/", "/en/video/watch/");
		expect(await loadHboPublicEpisodes(show, known, languageOnlyWatch, locale, signal, doc)).toHaveLength(3);
		expect(transport).toHaveBeenCalledTimes(3);
	});

	it("does not collect another market when the current market is absent or changes during a read", async () => {
		const geo = { pageLocales: { pathname: "/show/" + series, availableLocales: ["us/en", "vn/en"] } };
		const html = markup(base, group(1)).replace("</head>", '<script id="__DOTCOM_GEO__" type="application/json">' + JSON.stringify(geo) + "</script></head>");
		const transport = vi.fn(async (url: string) => response(url, url === base ? html : markup(url, group(url.endsWith("/s3") ? 3 : 1))));
		vi.stubGlobal("fetch", transport);
		const get = vi.fn().mockResolvedValue({ value: "DE" });
		const doc = { defaultView: { cookieStore: { get } } } as unknown as Document;
		expect(await loadHboPublicEpisodes(show, known, watch, "en", signal, doc)).toEqual(known);
		expect(transport).toHaveBeenCalledOnce();
		get.mockResolvedValueOnce({ value: "VN" });
		expect(await loadHboPublicEpisodes(show, known, watch, "en", signal, doc)).toEqual(known);
	});

	it("only uses a missing page for storefront selection, never for episode data", async () => {
		const doc = { defaultView: { cookieStore: { get: async () => ({ value: "US" }) } } } as unknown as Document;
		const geo = { pageLocales: { pathname: "/show/" + series, availableLocales: ["us/en"] } };
		const html = markup(base, group(1)).replace("</head>", '<script id="__DOTCOM_GEO__" type="application/json">' + JSON.stringify(geo) + "</script></head>");
		const transport = vi.fn(async () => response(base, html, 404));
		vi.stubGlobal("fetch", transport);
		expect(await loadHboPublicEpisodes(show, known, watch, "en-US", signal, doc)).toEqual(known);
		expect(transport).toHaveBeenCalledOnce();
	});

	it("fills missing seasons through the current HBO origin using only verified season slugs and preserves native titles", async () => {
		const localized = origin + "/us/en/show/" + series, href = origin + "/us/en/video/watch/" + known[0]!.id;
		const transport = vi.fn(async (url: string) => {
			const n = url === localized ? 1 : 3;
			return response(url, markup(url, group(n)));
		});
		vi.stubGlobal("fetch", transport);
		const native = [{ ...known[0]!, title: "Native player title" }];
		const result = await loadHboPublicEpisodes(show, native, href, "en-US", signal);
		expect(result).toEqual([native[0], episode(1), episode(3)]);
		expect(transport.mock.calls.map(call => call[0])).toEqual([localized, localized + "/s3"]);
		for (const args of transport.mock.calls) expect(args).toEqual([expect.any(String), expect.objectContaining({
			credentials: "omit", redirect: "error", mode: "same-origin", referrerPolicy: "no-referrer", signal: expect.anything(),
		})]);
	});

	it.each(["foreign-canonical", "foreign-series", "foreign-season", "wrong-count", "wrong-coordinate", "unsafe-slug",
		"nested-series", "nested-season", "nested-path", "oversize", "forbidden", "redirect"])("keeps native entries on %s", async kind => {
		const page = group(1), first = page.seasons[0]!, e = first.episodes[0]!;
		if (kind === "foreign-series") page.seriesId = id(99);
		if (kind === "foreign-season") first.seasonId = id(99);
		if (kind === "wrong-count") first.numberOfEpisodes = 2;
		if (kind === "wrong-coordinate") e.episodeNumber = 2;
		if (kind === "unsafe-slug") page.seasons[2]!.seasonNumberSlug = "../foreign";
		if (kind === "nested-series") e.seriesId = id(99);
		if (kind === "nested-season") e.seasonNumber = 3;
		if (kind === "nested-path") e.episodeUrl = e.episodeUrl.replace(series, id(99));
		const transport = vi.fn(async () => response(kind === "redirect" ? base + "/s2" : base,
			markup(kind === "foreign-canonical" ? origin + "/show/" + id(99) : base, page),
			kind === "forbidden" ? 403 : 200, kind === "oversize" ? { "content-length": "100000000" } : {}));
		vi.stubGlobal("fetch", transport);
		expect(await loadHboPublicEpisodes(show, known, watch, "en-US", signal)).toEqual(known);
		expect(transport).toHaveBeenCalledOnce();
	});

	it("keeps localized native titles and verified season counts when the unprefixed public pages use English", async () => {
		const transport = vi.fn(async (url: string) => {
			const n = url === base ? 1 : 3;
			const foreign = '<link rel="alternate" hreflang="de" href="' + origin + '/de/de/show/' + series + '">';
			return response(url, markup(url, group(n)).replace("</head>", foreign + "</head>"));
		});
		vi.stubGlobal("fetch", transport);
		const localized = [{ ...episode(2), title: "Die Rückkehr" }];
		const result = await loadHboPublicEpisodes(show, localized, watch, "de-DE", signal);
		expect(result).toEqual([localized[0], episode(1), episode(3)]);
		expect(transport.mock.calls.map(([url]) => url)).toEqual([base, base + "/s3"]);
	});

	it("uses an advertised language alternative within the same explicit market", async () => {
		const initial = origin + "/br/pt/show/" + series, english = origin + "/br/en/show/" + series;
		const transport = vi.fn(async (url: string) => {
			const n = url.endsWith("/s3") ? 3 : 1;
			const alternate = '<link rel="alternate" hreflang="en" href="' + english + '">';
			const foreign = '<link rel="alternate" hreflang="en" href="' + origin + '/us/en/show/' + series + '">';
			const page = markup(url, group(n), url === initial ? "pt-BR" : "en").replace("</head>", alternate + foreign + "</head>");
			return response(url, page);
		});
		vi.stubGlobal("fetch", transport);
		const result = await loadHboPublicEpisodes(show, known, origin + "/br/pt/video/watch/" + known[0]!.id, "en-US", signal);
		expect(result).toEqual([...known, episode(1), episode(3)]);
		expect(transport.mock.calls.map(([url]) => url)).toEqual([initial, english, english + "/s3"]);
	});

	it("does not fetch without a current native episode or when the native roster is full", async () => {
		const transport = vi.fn(); vi.stubGlobal("fetch", transport);
		for (const href of ["https://example.com/video/watch/" + known[0]!.id, origin + "/video/watch/" + id(99)]) {
			expect(await loadHboPublicEpisodes(show, known, href, "en", signal)).toBe(known);
		}
		const full = [episode(1), ...known, episode(3)];
		expect(await loadHboPublicEpisodes(show, full, watch, "en", signal)).toBe(full);
		expect(transport).not.toHaveBeenCalled();
	});

	it("continues to later advertised seasons when one season page returns 404", async () => {
		const long = { ...show, seasons: [1, 2, 3, 4, 5, 6].map(season) };
		const transport = vi.fn(async (url: string) => {
			const n = Number(/\/s([0-9]+)$/u.exec(url)?.[1] ?? 1);
			return n === 3 ? response(url, "", 404) : response(url, markup(url, group(n, long)));
		});
		vi.stubGlobal("fetch", transport);
		const result = await loadHboPublicEpisodes(long, known, watch, "en", signal);
		expect(result.map(e => e.seasonNumber).sort()).toEqual([1, 2, 4, 5, 6]);
		expect(transport.mock.calls.map(([url]) => url)).toEqual([base, base + "/s3", base + "/s4", base + "/s5", base + "/s6"]);
	});

	it.each([401, 403, 429, "wrong-market", "wrong-series"])("stops both workers after a season returns %s", async kind => {
		const long = { ...show, seasons: [1, 2, 3, 4, 5, 6].map(season) };
		let concurrent: AbortSignal | undefined;
		const transport = vi.fn(async (url: string, init: RequestInit) => {
			if (url === base + "/s4") {
				concurrent = init.signal!;
				await new Promise<void>(resolve => concurrent!.addEventListener("abort", () => resolve(), { once: true }));
				return response(url, markup(url, group(4, long)));
			}
			if (url === base) return response(url, markup(url, group(1, long)));
			const page = group(3, long);
			if (kind === "wrong-series") page.seriesId = id(99);
			const canonical = kind === "wrong-market" ? origin + "/gb/en/show/" + series + "/s3" : url;
			return response(url, markup(canonical, page), typeof kind === "number" ? kind : 200);
		});
		vi.stubGlobal("fetch", transport);
		const result = await loadHboPublicEpisodes(long, known, watch, "en-US", signal);
		expect(concurrent?.aborted).toBe(true);
		expect(result).toEqual([...known, episode(1)]);
		expect(transport.mock.calls.map(([url]) => url)).toEqual([base, base + "/s3", base + "/s4"]);
	});

	it("loads at most two missing seasons at once and enforces the response body cap without a declared length", async () => {
		const long = { ...show, seasons: [season(1), season(2), season(3), season(4), season(5)] };
		let active = 0, peak = 0;
		const transport = vi.fn(async (url: string) => {
			active++;
			peak = Math.max(peak, active);
			await new Promise(resolve => setTimeout(resolve, 5));
			active--;
			const n = Number(/\/s([0-9]+)$/u.exec(url)?.[1] ?? 1);
			return response(url, markup(url, group(n, long)));
		});
		vi.stubGlobal("fetch", transport);
		expect(await loadHboPublicEpisodes(long, known, watch, "en-US", signal)).toHaveLength(5);
		expect(peak).toBe(2);

		const oversized = vi.fn(async () => response(base, " ".repeat(6_000_001) + markup(base, group(1))));
		vi.stubGlobal("fetch", oversized);
		expect(await loadHboPublicEpisodes(show, known, watch, "en", signal)).toEqual(known);
		expect(oversized).toHaveBeenCalledOnce();
	});

	it("uses the native number of seasons to budget a series exceeding 32 MB across ordinary pages", async () => {
		const long = { ...show, seasons: Array.from({ length: 9 }, (_, i) => season(i + 1)) };
		const padding = " ".repeat(4_100_000);
		vi.stubGlobal("fetch", vi.fn(async (url: string) => {
			const n = Number(/\/s([0-9]+)$/u.exec(url)?.[1] ?? 1);
			return response(url, padding + markup(url, group(n, long)));
		}));
		expect(await loadHboPublicEpisodes(long, known, watch, "en", signal)).toHaveLength(9);
	});

	it("reuses only successful anonymous pages for the same document, catalog roster and locale, without extending their lifetime", async () => {
		const doc = document.implementation.createHTMLDocument();
		let time = 1_000;
		const clock = vi.spyOn(Date, "now").mockImplementation(() => time);
		let unavailable = true;
		const transport = vi.fn(async (url: string) => {
			const n = url === base ? 1 : 3;
			return n === 3 && unavailable ? response(url, "", 404) : response(url, markup(url, group(n)));
		});
		vi.stubGlobal("fetch", transport);
		try {
			expect(await loadHboPublicEpisodes(show, known, watch, "en", signal, doc)).toEqual([...known, episode(1)]);
			unavailable = false;
			time += 100_000;
			expect(await loadHboPublicEpisodes(show, known, watch, "en", signal, doc)).toHaveLength(3);
			expect(transport.mock.calls.map(([url]) => url)).toEqual([base, base + "/s3", base + "/s3"]);
			time += 100_000;
			const altWatch = origin + "/video/watch/" + episode(3).id;
			expect(await loadHboPublicEpisodes(show, [episode(2), episode(3)], altWatch, "en", signal, doc)).toHaveLength(3);
			expect(transport).toHaveBeenCalledTimes(3);
			time += 110_000;
			await loadHboPublicEpisodes(show, known, watch, "en", signal, doc);
			expect(transport.mock.calls.slice(3)).toEqual([[base, expect.anything()]]);
			await loadHboPublicEpisodes(show, known, watch, "de", signal, doc);
			expect(transport.mock.calls.slice(4).map(([url]) => url)).toEqual([base, base + "/s3"]);
			const changed = { ...show, seasons: show.seasons.map(s => ({ ...s, id: id(200 + s.number) })) };
			expect(await loadHboPublicEpisodes(changed, known, watch, "de", signal, doc)).toEqual(known);
			expect(transport).toHaveBeenCalledTimes(7);
		} finally { clock.mockRestore(); }
	});

	it("discards results when the owner or source signal aborts during download", async () => {
		const abort = new AbortController();
		const transport = vi.fn(async (url: string) => {
			abort.abort();
			return response(url, markup(url, group(1)));
		});
		vi.stubGlobal("fetch", transport);
		expect(await loadHboPublicEpisodes(show, known, watch, "en-US", abort.signal)).toEqual(known);
		expect(transport).toHaveBeenCalledOnce();
	});
});
