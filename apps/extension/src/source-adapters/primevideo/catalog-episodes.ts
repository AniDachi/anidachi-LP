import {
	primeVideoSourceUrl,
	WATCH_CATALOG_MAX_EPISODES,
	type WatchCatalogSnapshotInput,
} from "@anidachi/protocol";
import {
	object,
	ordinal,
	primeObservedNavigation,
	primePublicRecord,
	text,
	type PublicRecord,
} from "./metadata";
import { parsePrimePageUrl, primeObservedLink, primeRouteMatches } from "./url";

type CatalogEpisode =
	WatchCatalogSnapshotInput["seasons"][number]["episodes"][number];
export type EpisodeRange = {
	selected: number;
	tokens: string[];
	total: number;
};

export function readEpisodeRange(
	actionsValue: unknown,
	count: unknown,
	listed: number,
): EpisodeRange | null {
	const { episodePages, pagination } = object(actionsValue);
	if (
		typeof count !== "number" ||
		!Number.isSafeInteger(count) ||
		count < listed ||
		count > WATCH_CATALOG_MAX_EPISODES ||
		listed < 1 ||
		!Array.isArray(pagination) ||
		!Array.isArray(episodePages) ||
		!episodePages.length ||
		episodePages.length > count
	)
		return null;
	const selected = episodePages.findIndex(
		(row) => object(row).isSelected === true,
	);
	if (
		selected < 0 ||
		episodePages.some((row, i) => object(row).isSelected !== (i === selected))
	)
		return null;
	if (episodePages.length === 1)
		return count === listed && pagination.length === 0
			? { selected, total: count, tokens: [] }
			: null;
	if (listed >= count) return null;
	const tokens: string[] = [];
	for (const row of episodePages) {
		const token = object(row).token;
		if (
			typeof token !== "string" ||
			!token.length ||
			token.length > 4096 ||
			tokens.includes(token)
		)
			return null;
		tokens.push(token);
	}
	return { selected, total: count, tokens };
}

export function readCatalogEpisode(
	record: PublicRecord,
	title: string | null,
	number: number | null,
	actionValue: unknown,
	order: number,
	origin: string,
	resolves: (value: unknown) => boolean,
): CatalogEpisode | null {
	if (
		!record.launched ||
		record.type !== "episode" ||
		!title ||
		!number ||
		record.sequence !== number
	)
		return null;
	const action = object(actionValue),
		primary = action.primaryActions;
	if (!Array.isArray(primary) || !primary.length || primary.length > 32)
		return null;
	const entitlement = object(action.messages).entitlementType;
	const only = object(primary[0]),
		notice = object(only.payload);
	// Prime supplies a message-only primary action for this account when a listed episode cannot play.
	const noticeText = object(object(notice.message).message).string;
	const unavailable =
		entitlement == null &&
		primary.length === 1 &&
		only.actionType === "MESSAGE" &&
		notice.payloadType === "Message" &&
		typeof noticeText === "string" &&
		!!noticeText.trim();
	if (!unavailable) {
		const plays = primary
			.map(object)
			.filter((item) => item.actionType === "PLAY");
		if (entitlement !== "Entitled" || plays.length !== 1) return null;
		const payload = object(plays[0]!.payload),
			playback = object(payload.playback);
		const link = primeObservedLink(playback.playbackURL, origin);
		const route = link && parsePrimePageUrl(link);
		if (
			payload.payloadType !== "PLAYBACK" ||
			!resolves(playback.playbackID) ||
			playback.isTrailer !== false ||
			playback.videoMaterialType !== "Feature" ||
			!route ||
			!primeRouteMatches(route.token, record)
		)
			return null;
		const autoplay = new URL(
			playback.playbackURL as string,
			origin,
		).searchParams.getAll("autoplay");
		if (autoplay.length !== 1 || autoplay[0] !== "1") return null;
	}
	return {
		episodeKey: `primevideo:episode:${record.compact}`,
		providerEpisodeIdentifier: record.compact,
		title,
		episodeNumber: number,
		order,
		releasedAt: null,
		available: !unavailable,
		watchVariants: [
			{
				providerContentId: record.compact,
				audioLocale: null,
				original: true,
				order: 0,
				sourceUrl: primeVideoSourceUrl(record.compact),
				primeNavigation: primeObservedNavigation(
					record.compact,
					record.linkUrl,
				),
			},
		],
	};
}

export function episodeWidgetUrl(
	seasonUrl: string,
	titleId: string,
	token: string,
): string {
	const url = new URL(seasonUrl);
	const region = url.pathname.match(/^\/region\/[a-z0-9-]+(?=\/)/)?.[0] ?? "";
	const retail = !(
		url.hostname === "primevideo.com" ||
		url.hostname.endsWith(".primevideo.com")
	);
	url.pathname = region + (retail ? "/gp/video" : "") + "/api/getDetailWidgets";
	url.search = new URLSearchParams({
		titleID: titleId,
		isTvodOnRow: "",
		widgets: JSON.stringify([
			{ widgetType: "EpisodeList", widgetToken: encodeURIComponent(token) },
		]),
	}).toString();
	return url.href;
}

export function readEpisodeWidget(
	raw: string,
	titleId: string,
	range: EpisodeRange,
	index: number,
	origin: string,
) {
	const response = object(JSON.parse(raw)),
		widgets = object(response.widgets),
		list = object(widgets.episodeList);
	if (
		object(widgets.pageContext).pageTitleId !== titleId ||
		!Array.isArray(list.episodes) ||
		list.episodeCount !== range.total
	)
		return null;
	const part = readEpisodeRange(
		list.actions,
		list.episodeCount,
		list.episodes.length,
	);
	if (part?.selected !== index || part.tokens.length !== range.tokens.length)
		return null;
	const episodes: CatalogEpisode[] = [],
		ids: string[] = [];
	for (const item of list.episodes.map(object)) {
		if (typeof item.titleID !== "string") return null;
		const record = primePublicRecord(item.self, item.titleID, origin),
			detail = object(item.detail);
		if (!record || detail.titleType !== "episode") return null;
		const episode = readCatalogEpisode(
			record,
			text(detail.title),
			ordinal(detail.episodeNumber),
			item.action,
			episodes.length,
			origin,
			(value) => typeof value === "string" && primeRouteMatches(value, record),
		);
		if (!episode) return null;
		episodes.push(episode);
		ids.push(record.id);
	}
	return { episodes, ids };
}
