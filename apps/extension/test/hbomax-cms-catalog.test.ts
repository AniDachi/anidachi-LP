import { describe, expect, it } from "vitest";
import {
	buildHboCmsCatalog, HboCmsEpisodeSchema, HboCmsPlaybackSchema, HboCmsShowSchema,
	parseHboCmsPlayback, parseHboCmsSeason, parseHboCmsShow,
} from "../src/source-adapters/hbomax/cms-catalog";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const series = id(1), first = id(11), second = id(12), finale = id(21);
const collectionId = "142189386688050926656560871756848058860";
const ref = (type: string, id: string) => ({ type, id });
const relation = (type: string, id: string) => ({ data: ref(type, id) });
function season(number: number, count: number) {
	return { ...ref("season", id(100 + number)), attributes: { name: "War", displayName: String(number),
		seasonNumber: number, videoCountByType: { EPISODE: count } } };
}
const show = { ...ref("show", series), attributes: { name: "War", extra: "not exported" },
	relationships: { seasons: { data: [ref("season", id(102)), ref("season", id(101))] } } };
function video(idValue: string, group: number, number: number) {
	return { ...ref("video", idValue), attributes: { videoType: "EPISODE", name: `S${group} E${number}`, seasonNumber: group, episodeNumber: number },
		relationships: { show: relation("show", series), season: relation("season", id(100 + group)) } };
}
function rail(ids: string[]) {
	return { ...ref("collection", collectionId), attributes: { alias: "generic-show-page-rail-episodes-tabbed-content",
		component: { mandatoryParams: "pf[show.id]=" + series, filters: [{ id: "seasonNumber", options: [1, 2].map(n =>
			({ id: String(n), value: String(n), parameter: "pf[seasonNumber]=" + n })) }] } },
		relationships: { items: { data: ids.map((_, i) => ref("collectionItem", "c:" + i)) } },
		meta: { itemsCurrentPage: 1, itemsPageSize: 100, itemsTotalPages: 1 } };
}
function collectionPage(videos: ReturnType<typeof video>[]) {
	return { data: rail(videos.map(row => row.id)), included: [
		...videos.map((row, i) => ({ ...ref("collectionItem", "c:" + i), relationships: { video: relation("video", row.id) } })), ...videos,
	] };
}
function route(path: string) {
	return { ...ref("route", "r"), attributes: { canonical: true, url: path }, relationships: { target: relation("page", "page") } };
}
const season1 = collectionPage([video(first, 1, 1), video(second, 1, 2)]);
const season2 = collectionPage([video(finale, 2, 1)]);
const showPage = { data: route("/show/" + series), included: [show, season(1, 2), season(2, 1), season1.data, ...season1.included] };
const watchPage = { data: route("/video/watch/" + first), included: [video(first, 1, 1), show, season(1, 2)] };
const context = { region: "VN", requestedLocale: "vi", subtitleLocales: [], audioLocale: null, observedAt: "2026-11-21T00:00:00.000Z" };

describe("HBO Max catalog resources", () => {
	it("binds direct playback to the exact watch route and linked show, rejecting ambiguous resources and trailers", () => {
		const metadata = parseHboCmsPlayback(watchPage, first);
		expect(metadata).toMatchObject({ identity: { kind: "episode", providerSeriesId: series, providerEpisodeIdentifier: first },
			title: "War", episodeNumber: 1, seasonNumber: 1, episodeTitle: "S1 E1" });
		expect(parseHboCmsPlayback({ ...watchPage, data: route("/video/watch/" + second) }, first)).toBeNull();
		expect(parseHboCmsPlayback({ ...watchPage, included: [show, season(1, 2), video(second, 1, 2)] }, first)).toBeNull();
		expect(parseHboCmsPlayback({ ...watchPage, included: [...watchPage.included, video(first, 2, 1)] }, first)).toBeNull();
		const trailer = video(first, 1, 1);
		trailer.attributes.videoType = "TRAILER";
		expect(parseHboCmsPlayback({ ...watchPage, included: [show, trailer] }, first)).toBeNull();
		expect(HboCmsPlaybackSchema.safeParse({ ...metadata, region: "VN" }).success).toBe(false);
	});
	it("requires the show's own list of seasons, unique numbers and a matching episode rail", () => {
		const plan = parseHboCmsShow(showPage, series);
		expect(plan).toEqual({ collectionId, seriesId: series, title: "War", seasons: [
			{ id: id(101), number: 1, title: "1", episodeCount: 2 }, { id: id(102), number: 2, title: "2", episodeCount: 1 },
		] });
		expect(parseHboCmsShow({ ...showPage, data: route("/show/" + id(3)) }, series)).toBeNull();
		expect(parseHboCmsShow({ ...showPage, included: [show, season(1, 2), season1.data] }, series)).toBeNull();
		expect(parseHboCmsShow({ ...showPage, included: [show, season(1, 2), { ...season(1, 1), id: id(102) }, season1.data] }, series)).toBeNull();
		const wrong = rail([]);
		wrong.attributes.component.mandatoryParams = "pf[show.id]=" + id(3);
		expect(parseHboCmsShow({ ...showPage, included: [show, season(1, 2), season(2, 1), wrong] }, series)).toBeNull();
		expect(HboCmsShowSchema.safeParse({ ...plan, unrelated: true }).success).toBe(false);
	});
	it("traverses item links on show and collection pages and excludes unrelated shows, seasons and included videos", () => {
		const plan = parseHboCmsShow(showPage, series)!;
		expect(parseHboCmsSeason(showPage, plan, 1)).toEqual(parseHboCmsSeason(season1, plan, 1));
		const other = video(id(99), 2, 2);
		other.relationships.show = relation("show", id(3));
		const mixed = collectionPage([video(finale, 2, 1), other, video(first, 1, 1)]);
		mixed.included.push(video(id(98), 2, 3));
		const episodes = parseHboCmsSeason(mixed, plan, 2);
		expect(episodes).toEqual([{ id: finale, seasonNumber: 2, number: 1, title: "S2 E1" }]);
		expect(parseHboCmsSeason({ ...mixed, data: { ...mixed.data, id: "43" } }, plan, 2)).toBeNull();
		expect(HboCmsEpisodeSchema.safeParse({ ...episodes![0], links: [] }).success).toBe(false);
	});
	it("uses the cold player route's own show, season totals and episode rail before any collection refresh", () => {
		const rail = structuredClone(season2.data);
		rail.attributes.alias = "generic-video-player-show-episodes-ipd";
		const cold = { data: route("/video/watch/" + finale), included: [show, season(1, 2), season(2, 1), rail, ...season2.included] };
		const plan = parseHboCmsShow(cold, series)!;
		expect(plan?.seasons.map(s => s.episodeCount)).toEqual([2, 1]);
		const currentSeason = parseHboCmsSeason(cold, plan, 2)!;
		expect(currentSeason.map(row => row.id)).toEqual([finale]);
		expect(buildHboCmsCatalog(plan, currentSeason, finale, context)).toMatchObject({
			completeness: "partial", seasons: [{ seasonNumber: 2, episodes: [{ providerEpisodeIdentifier: finale }] }],
		});
		expect(parseHboCmsShow({ ...cold, data: route("/video/watch/" + first) }, series)).toBeNull();
		expect(parseHboCmsSeason({ ...cold, data: route("/video/watch/" + first) }, plan, 2)).toBeNull();
	});
	it("matches the playing episode and publishes exact totals only when the inventory matches every independent season count and territory", () => {
		const plan = parseHboCmsShow(showPage, series)!;
		const firstPage = parseHboCmsSeason(showPage, plan, 1)!;
		const lastPage = parseHboCmsSeason(season2, plan, 2)!;
		const episodes = [...lastPage, ...firstPage, ...firstPage];
		const snapshot = buildHboCmsCatalog(plan, episodes, first, context);
		const visible = buildHboCmsCatalog(plan, episodes, first, { ...context, region: null }, new Set(firstPage.map(row => row.id)));
		expect(visible?.seasons[1]?.episodes[0]).toMatchObject({ providerEpisodeIdentifier: finale, available: false });
		expect(visible?.seasons[0]?.episodes[0]?.available).toBe(true);
		expect(snapshot?.completeness).toBe("complete");
		expect(snapshot?.seasons.map(s => s.episodes.map(e => e.providerEpisodeIdentifier))).toEqual([[first, second], [finale]]);
		expect(buildHboCmsCatalog(plan, episodes, id(99), context)).toBeNull();
		expect(buildHboCmsCatalog(plan, firstPage, first, context)?.completeness).toBe("partial");
		expect(buildHboCmsCatalog(plan, episodes, first, { ...context, region: null })?.completeness).toBe("partial");
		expect(buildHboCmsCatalog({ ...plan, seasons: plan.seasons.map(s => ({ ...s, episodeCount: null })) }, episodes, first, context)?.completeness).toBe("partial");
		expect(buildHboCmsCatalog(plan, [...episodes, { ...firstPage[0]!, seasonNumber: 2 }], first, context)).toBeNull();
		expect(buildHboCmsCatalog(plan, [...episodes, { ...firstPage[0]!, id: id(99) }], first, context)).toBeNull();
	});
});
