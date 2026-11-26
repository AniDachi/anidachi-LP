import { DisneyPlusProviderIdSchema, isDisneyPlusArtworkUrl, WATCH_CATALOG_MAX_EPISODES } from "@anidachi/protocol";
import { z } from "zod";
import type { DisneyPlusEpisode } from "./metadata";

const id = DisneyPlusProviderIdSchema;
const label = z.string().trim().min(1).max(300);
const card = z.object({ _id: id, title: label });
const cards = z.array(card).max(WATCH_CATALOG_MAX_EPISODES);
const shelf = z.object({
	_type: z.literal("Episodes"), seriesTitle: label, seasons: z.array(z.object({ id, name: label })).min(1).max(100),
	selectedSeasonId: id, episodes: cards,
	seoSeasons: z.array(z.object({ seasonId: id, episodes: cards })).max(100).optional(),
});
const hero = z.object({ _type: z.literal("DetailEntityHero"), backgroundImage: z.object({
	alt: label, defaultImage: z.object({ source: z.string() }),
}) });
const data = z.object({
	pageId: z.string(), language: z.string().min(2).max(35), region: z.string().max(3),
	dictionary: z.object({ application: z.object({ next_episode_episode_subtitle: z.string().max(250).optional() }) }),
	stitchDocument: z.object({ mainContent: z.array(z.unknown()).max(150) }),
});
export type PublishedSeason = {
	id: string; name: string; number: number | null; episodes?: DisneyPlusEpisode[];
};
export type PublishedTitle = {
	entityId: string; title: string; artworkUrl: string | null; locale: string; region: string;
	seasons: PublishedSeason[]; selectedSeasonId: string | null;
};

export function decimalDigits(text: string) {
	return text.replace(/\p{Nd}/gu, digit => {
		if (digit >= "0" && digit <= "9") return digit;
		const code = digit.codePointAt(0)!;
		let start = code;
		while (start > 0 && /\p{Nd}/u.test(String.fromCodePoint(start - 1))) start--;
		return String((code - start) % 10);
	});
}

function ordinal(text: string | undefined) {
	const n = text ? Number(decimalDigits(text)) : NaN;
	return Number.isInteger(n) && n > 0 && n <= 1000 ? n : null;
}

function labelPattern(template: string | undefined) {
	if (!template || !["season_number", "episode_number", "episode_title"].every(k => template.split("{" + k + "}").length === 2)) return null;
	const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
	const parts = template.split(/(\{(?:season_number|episode_number|episode_title)\})/);
	return new RegExp("^" + parts.map(p => p === "{episode_title}" ? "(?<title>.+?)" : p === "{season_number}" ?
		"(?<season>\\p{Nd}+)" : p === "{episode_number}" ? "(?<episode>\\p{Nd}+)" : esc(p)).join("") + "$", "u");
}

/** Only the public, inert title document. Playback, account and advertising data are never inputs. */
export function parseDisneyTitle(html: string, entityId: string): PublishedTitle | null {
	const tag = /<script\b[^>]{0,1024}\bid=["']__NEXT_DATA__["'][^>]{0,1024}>/i.exec(html);
	if (!tag) return null;
	const start = tag.index + tag[0].length, end = html.indexOf("</script>", start);
	if (end < 0) return null;
	try {
		const root = data.safeParse(JSON.parse(html.slice(start, end))?.props?.pageProps);
		if (!root.success || root.data.pageId !== "entity-" + entityId) return null;
		const { stitchDocument, language, region, dictionary } = root.data;
		const locale = Intl.getCanonicalLocales(language)[0]!;
		const blocks = stitchDocument.mainContent;
		const image = blocks.map(b => hero.safeParse(b)).find(r => r.success)?.data.backgroundImage;
		const artworkUrl = image?.defaultImage.source;
		const common = { entityId, locale, region, artworkUrl: artworkUrl && isDisneyPlusArtworkUrl(artworkUrl) ? artworkUrl : null };
		const rawShelf = blocks.find(b => (b as { _type?: string } | null)?._type === "Episodes");
		if (!rawShelf) {
			const movie = blocks.some(b => (b as { _type?: string; ldJSON?: { "@graph"?: { "@type": string }[] } } | null)?.ldJSON?.["@graph"]?.some(v => v["@type"] === "Movie"));
			return movie && image ? { ...common, title: image.alt, selectedSeasonId: null, seasons: [] } : null;
		}
		const parsed = shelf.safeParse(rawShelf);
		if (!parsed.success) return null;
		const s = parsed.data, pattern = labelPattern(dictionary.application.next_episode_episode_subtitle);
		const lists = new Map(s.seoSeasons?.map(item => [item.seasonId, item.episodes]));
		lists.set(s.selectedSeasonId, s.episodes);
		const seasons: PublishedSeason[] = [];
		if (!s.seasons.some(v => v.id === s.selectedSeasonId) || new Set(s.seasons.map(v => v.id)).size !== s.seasons.length) return null;
		for (const def of s.seasons) {
			const nums = decimalDigits(def.name).match(/\d+/g);
			let number = nums?.length === 1 ? ordinal(nums[0]) : null;
			const rows = lists.get(def.id);
			const episodes = rows?.map(row => {
				const normalized = decimalDigits(row.title);
				const fields = pattern?.exec(row.title)?.groups;
				const group = ordinal(fields?.season);
				if (group && number !== null && group !== number) return null;
				number ??= group;
				// Named shelves use their own caption and the episode ordinal.
				const remaining = normalized.startsWith(decimalDigits(def.name)) ? normalized.slice(decimalDigits(def.name).length) : normalized;
				const ordinals = /^\D*([0-9]{1,4})\D+([0-9]{1,4})(?:\D|$)/u.exec(remaining);
				const named = number === null ? /^\D*([0-9]{1,4})(?:\D|$)/u.exec(remaining) : null;
				const ep = ordinal(fields?.episode) ?? ordinal(named?.[1]) ?? ordinal(ordinals?.[2]);
				if (ordinals?.[1] && !fields && number !== null && Number(ordinals[1]) !== number) return null;
				if (!ep) return null;
				return { playbackId: row._id, number: ep, title: fields?.title?.trim() || row.title };
			}).filter((row): row is DisneyPlusEpisode => row !== null);
			if (episodes && new Set(episodes.map(e => e.number)).size !== episodes.length) continue;
			seasons.push({ ...def, number, episodes });
		}
		return { ...common, title: s.seriesTitle, seasons, selectedSeasonId: s.selectedSeasonId };
	} catch { return null; }
}
