import { describe, expect, it, vi } from "vitest";
import { disneyPlusEntityId, disneyPlusPlaybackId, disneyPlusSourceUrl } from "@anidachi/protocol";
import type { DisneyPlusDetails } from "../src/source-adapters/disneyplus/metadata";
import { parseDisneyTitle } from "../src/source-adapters/disneyplus/published-title";
import { loadPublishedDisneyCatalog } from "../src/source-adapters/disneyplus/published-catalog";
import { readDisneyPlusPlaybackMetadata } from "../src/source-adapters/disneyplus/metadata";
import { startDisneyPlusCatalogCapture, resolveDisneyPlusCatalog } from "../src/source-adapters/disneyplus/catalog";

const id = (n: number) => "00000000-0000-4000-9000-" + String(n).padStart(12,"0");
const entity = id(1), episode = id(34);
const browse = new URL("https://www.disneyplus.com/zh-tw/browse/entity-" + entity);
const play = new URL(disneyPlusSourceUrl(episode));
function markup(selected: number, card: string, label: string, template: string, seasonLabel: string, language = "zh", extras = false) {
	const mainContent = [{ _type: "Episodes", seriesTitle: "Example", selectedSeasonId: id(selected),
		seasons: [2,3,4].map(n => ({ id: id(n), name: (extras && n === 4) ? "Exclusives" : seasonLabel.replace("#",String(n-1)) })),
		episodes: [{ _id:card, title:label }], seoSeasons: selected === 2 ? [{ seasonId: id(3), episodes: [{ _id:id(33), title:"第 2 季第 3 集：其他" }] }] : [] }];
	return '<script type="application/json" id="__NEXT_DATA__">' + JSON.stringify({props:{pageProps:{
		pageId:"entity-"+entity, language, region:"tw", dictionary:{application:{next_episode_episode_subtitle:template}}, stitchDocument:{mainContent},
	}}}) + '</script>';
}
const template = "第 {season_number} 季第 {episode_number} 集：{episode_title}";
function page(selected: number) {
	const html = markup(selected, selected === 2 ? id(31) : episode, selected === 2 ? "第 1 季第 1 集：月光" : "第 3 季第 4 集：海洋",template,"第 # 季");
	return { page: parseDisneyTitle(html,entity)!, url:browse };
}
describe("Disney+ public episode catalog, including Hulu on Disney+", () => {
	it("uses Disney's localized format and the actual episode ordinals even with reordered or sparse seasons", () => {
		const html = markup(4,episode,"T3:E12 Uma história de 1999","T{season_number}:E{episode_number}{episode_title}","Temporada #","pt");
		expect(parseDisneyTitle(html,entity)?.seasons[2]).toMatchObject({number:3,episodes:[{number:12,title:"Uma história de 1999",playbackId:episode}]});
		expect(parseDisneyTitle(html,id(999))).toBeNull();
		const ar = markup(4,episode,"م٣:ح١٢ عنوان ١٩٩٩","م{season_number}:ح{episode_number} {episode_title}","الموسم #","ar");
		expect(parseDisneyTitle(ar,entity)?.seasons[2]?.episodes?.[0]).toMatchObject({number:12,title:"عنوان ١٩٩٩"});
	});
	it("preserves the provider UUID for a named shelf and does not relabel it season one", () => {
		const html = markup(4,episode,"Exclusives: E2 A Special","S{season_number}:E{episode_number} {episode_title}","Season #","en",true);
		expect(parseDisneyTitle(html,entity)?.seasons[2]).toMatchObject({id:id(4),number:null,episodes:[{number:2,playbackId:episode}]});
	});
	it("recovers unseen direct plays, fetches only the missing season, and publishes no stale navigation", async () => {
		const read = vi.fn(async (url: URL) => page(url.searchParams.has("season") ? 4 : 2));
		const snapshots: DisneyPlusDetails[] = [];
		await loadPublishedDisneyCatalog(play,episode,null,new AbortController().signal,d=>snapshots.push(d),read);
		expect(read.mock.calls.map(([url])=>url.search)).toEqual(["","?season="+id(4)]);
		expect(snapshots.at(-1)?.seasons.size).toBe(3);
		const ac = new AbortController();
		const stale = vi.fn();
		await loadPublishedDisneyCatalog(play,episode,null,ac.signal,stale,async url=>{
			if(url.searchParams.has("season")) ac.abort();
			return page(url.searchParams.has("season")?4:2);
		});
		expect(stale).not.toHaveBeenCalled();
		const wrong = vi.fn();
		await loadPublishedDisneyCatalog(play,episode,id(77),new AbortController().signal,wrong,read);
		expect(wrong).not.toHaveBeenCalled();
	});
	it("binds a regional Hulu edition after the native player mounts, keeping the actual playable and requiring both ordinals", async () => {
		const url = "https://www.disneyplus.com/play/" + episode;
		(window as unknown as {happyDOM:{setURL(url:string):void}}).happyDOM.setURL(url);
		const publishedId = id(993);
		const html = markup(2, publishedId, "S1:E5 This Is Me Trying", "S{season_number}:E{episode_number} {episode_title}", "Season #", "en");
		const read = vi.fn(async () => ({ page: parseDisneyTitle(html, entity)!, url: browse }));
		const stop = startDisneyPlusCatalogCapture(document, async () => null, read);
		try {
			await resolveDisneyPlusCatalog(document, entity, episode);
			const portal = document.createElement("disney-web-player-ui");
			document.body.append(portal);
			const shadow = portal.attachShadow({mode:"open"});
			shadow.innerHTML = '<div class="title-bug-container"><button class="title-btn"><span class="title-field">Example</span><span class="subtitle-field">S2:E5 This is Me Trying</span></button></div>';
			expect(readDisneyPlusPlaybackMetadata(document, episode)).toBeNull();
			shadow.querySelector(".subtitle-field")!.textContent = "S1:E5 This is Me Trying";
			expect(readDisneyPlusPlaybackMetadata(document, episode)).toMatchObject({ identity: { providerEpisodeIdentifier: episode }, seasonNumber: 1, episodeNumber: 5 });
			const catalog = await resolveDisneyPlusCatalog(document, entity, episode);
			expect(catalog?.seasons[0]?.episodes.map(e => e.providerEpisodeIdentifier)).toEqual([episode]);
			portal.remove();
		} finally { stop(); }
	});
	it("waits for a catalog refresh before fetching other seasons when the first page already identifies playback", async () => {
		const read = vi.fn(async (url: URL) => page(url.searchParams.has("season") ? 4 : 2));
		let resume!: () => void;
		const permission = new Promise<void>(resolve => { resume = resolve; });
		const publish = vi.fn();
		const job = loadPublishedDisneyCatalog(play, id(31), null, new AbortController().signal, publish, read, { expand: () => permission });
		await vi.waitFor(() => expect(publish).toHaveBeenCalled());
		expect(read).toHaveBeenCalledTimes(1);
		resume();
		expect(await job).toBe(true);
		expect(read).toHaveBeenCalledTimes(2);
	});
	it("resolves the first-view identity and the full history snapshot through the content entry on a script-locale URL", async () => {
		const url="https://www.disneyplus.com/zh-hant-tw/play/"+episode;
		expect(disneyPlusPlaybackId(url)).toBe(episode);
		expect(disneyPlusEntityId(browse.href)).toBe(entity);
		(window as unknown as {happyDOM:{setURL(url:string):void}}).happyDOM.setURL(url);
		const stop=startDisneyPlusCatalogCapture(document,async()=>null,async u=>page(u.searchParams.has("season")?4:2));
		try {
			const result=await resolveDisneyPlusCatalog(document,entity,episode);
			expect(readDisneyPlusPlaybackMetadata(document,episode)).toMatchObject({identity:{providerSeriesId:entity,providerEpisodeIdentifier:episode},seasonNumber:3,episodeNumber:4,episodeTitle:"海洋"});
			expect(result?.seasons.map(s=>s.seasonNumber)).toEqual([1,2,3]);
		} finally {stop();}
	});
});
