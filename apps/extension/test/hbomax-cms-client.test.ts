import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hboMaxFingerprint, hboMaxSourceUrl } from "@anidachi/protocol";
import { loadHboMaxCatalog, readHboMaxCatalog, readHboMaxCatalogContext, startHboMaxCatalogCapture } from "../src/source-adapters/hbomax/catalog";
import { observeHboMaxRoomSource, readHboMaxPlaybackMetadata } from "../src/source-adapters/hbomax/metadata";
import { loadHboPublicEpisodes } from "../src/source-adapters/hbomax/public-seasons";

vi.mock("../src/source-adapters/hbomax/public-seasons", () => ({ loadHboPublicEpisodes: vi.fn() }));
const publicEpisodes = vi.mocked(loadHboPublicEpisodes);
const seriesId = "c0000000-0000-4000-8000-000000000001";
const playbackId = "c0000000-0000-4000-8000-000000000002";
const nextId = "c0000000-0000-4000-8000-000000000003";
const seasonId = "c0000000-0000-4000-8000-000000000004";
const first = { id: playbackId, title: "First", number: 1, seasonNumber: 1 };
const second = { id: nextId, title: "Second", number: 2, seasonNumber: 1 };
const metadata = {
	identity: { kind: "episode", providerSeriesId: seriesId, providerEpisodeIdentifier: playbackId },
	title: "Una serie", displayTitle: "Una serie — Primero", episodeTitle: "Primero", episodeNumber: 1,
	seasonTitle: "Temporada uno", seasonNumber: 1, artworkUrl: null,
};
const packet = {
	playbackId, locale: "en", metadata, episodes: [first], show: {
		seriesId, title: "Show", collectionId: "88", seasons: [{ id: seasonId, number: 1, title: "Season 1", episodeCount: 2 }],
	},
};
function emit(value: unknown) {
	document.dispatchEvent(new CustomEvent("anidachi:hbo-cms", { detail: JSON.stringify(value) }));
}
function route(id: string) {
	(window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL("https://play.hbomax.com/video/watch/" + id);
	window.dispatchEvent(new Event("popstate"));
}
let stop: (() => void) | undefined;
beforeEach(() => {
	document.documentElement.lang = "en-US";
	route(playbackId);
	document.body.innerHTML = `<div data-testid="playerContainer"><video data-testid="VideoElement" src="blob:episode"></video>
		<div data-testid="content-metadata"><span data-testid="player-ux-asset-title">Una serie</span>
		<span data-testid="player-ux-asset-subtitle">Primero</span><span data-testid="player-ux-season-episode">S1 E1</span></div></div>`;
	vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 200, 60));
	const video = document.querySelector("video")!;
	Object.defineProperties(video, { readyState: { configurable: true, value: 4 }, duration: { configurable: true, value: 500 } });
	publicEpisodes.mockReset();
});
afterEach(() => { stop?.(); stop = undefined; document.body.innerHTML = ""; document.title = ""; vi.restoreAllMocks(); });

describe("HBO catalog data in the content script", () => {
	it("uses a canonical title poster only after corroborating the playing title", () => {
		stop = startHboMaxCatalogCapture(document);
		const url = "https://images.cdn.prd.api.discomax.com/group/poster.jpeg";
		emit({ ...packet, poster: { titleId: nextId, url } });
		expect(readHboMaxPlaybackMetadata(document, playbackId)?.artworkUrl).toBeNull();
		emit({ ...packet, poster: { titleId: seriesId, url } });
		expect(readHboMaxPlaybackMetadata(document, playbackId)?.artworkUrl).toBe(url);
		route(nextId);
		expect(readHboMaxPlaybackMetadata(document, nextId)?.artworkUrl).toBeUndefined();
	});
	it("recovers the native response on late mount and admits an exact playing episode without a previously opened season", async () => {
		document.addEventListener("anidachi:hbo-cms-read", () => emit(packet), { once: true });
		stop = startHboMaxCatalogCapture(document);
		expect(readHboMaxPlaybackMetadata(document, playbackId)).toMatchObject(metadata);
		expect(readHboMaxCatalogContext(document, seriesId, playbackId)).toMatchObject({ requestedLocale: "en-US", region: null });
		expect(readHboMaxCatalog(document, seriesId, playbackId)?.seasons[0]?.episodes.map(row => row.title)).toEqual(["First"]);
		expect(publicEpisodes).not.toHaveBeenCalled();
		publicEpisodes.mockResolvedValue([first, second]);
		const catalog = await loadHboMaxCatalog(document, seriesId, playbackId, new AbortController().signal);
		expect(catalog?.seasons[0]?.episodes.map(row => row.providerEpisodeIdentifier)).toEqual([playbackId, nextId]);
		expect(catalog?.completeness).toBe("partial");
	});

	it("rejects packets for another watch or series, mismatched episode coordinates and unknown fields", () => {
		stop = startHboMaxCatalogCapture(document);
		for (const value of [
			{ ...packet, playbackId: nextId },
			{ ...packet, metadata: { ...metadata, identity: { ...metadata.identity, providerEpisodeIdentifier: nextId } } },
			{ ...packet, show: { ...packet.show, seriesId: nextId } },
			{ ...packet, extra: "unrecognized" },
		]) {
			emit(value);
			expect(readHboMaxCatalogContext(document, seriesId, playbackId)).toBeNull();
		}
		emit({ ...packet, episodes: [{ ...first, number: 2 }] });
		expect(readHboMaxCatalog(document, seriesId, playbackId)).toBeNull();
	});

	it("retains the native episode on a public request failure and skips work for an aborted request", async () => {
		stop = startHboMaxCatalogCapture(document);
		emit(packet);
		const abort = new AbortController();
		abort.abort();
		expect(await loadHboMaxCatalog(document, seriesId, playbackId, abort.signal)).toBeNull();
		expect(publicEpisodes).not.toHaveBeenCalled();
		publicEpisodes.mockRejectedValue(new Error("Page unavailable"));
		const result = await loadHboMaxCatalog(document, seriesId, playbackId, new AbortController().signal);
		expect(result?.seasons[0]?.episodes).toHaveLength(1);
	});

	it("checks the mounted episode and title and accepts an unfamiliar ordinal label with matching names", () => {
		stop = startHboMaxCatalogCapture(document);
		emit(packet);
		document.body.innerHTML = `<div data-testid="playerContainer"><div data-testid="content-metadata">
			<span data-testid="player-ux-asset-title">Otra serie</span><span data-testid="player-ux-asset-subtitle">Primero</span>
			<span data-testid="player-ux-season-episode">S1 E1</span></div></div>`;
		expect(readHboMaxPlaybackMetadata(document, playbackId)).toBeNull();
		document.querySelector('[data-testid="player-ux-asset-title"]')!.textContent = metadata.title;
		document.querySelector('[data-testid="player-ux-season-episode"]')!.textContent = "S1 E2";
		expect(readHboMaxPlaybackMetadata(document, playbackId)).toBeNull();
		document.querySelector('[data-testid="player-ux-season-episode"]')!.textContent = "Название раздела";
		expect(readHboMaxPlaybackMetadata(document, playbackId)?.identity).toEqual(metadata.identity);
	});

	it("requires independent identity and visible playable content after the mounted episode labels disappear", async () => {
		stop = startHboMaxCatalogCapture(document);
		emit(packet);
		const info = document.querySelector<HTMLElement>('[data-testid="content-metadata"]')!;
		info.hidden = true;
		expect(readHboMaxCatalogContext(document, seriesId, playbackId)).toBeNull();
		expect(await loadHboMaxCatalog(document, seriesId, playbackId, new AbortController().signal)).toBeNull();
		expect(publicEpisodes).not.toHaveBeenCalled();
		info.hidden = false;
		expect(readHboMaxPlaybackMetadata(document, playbackId)?.identity).toEqual(metadata.identity);
		info.hidden = true;
		expect(readHboMaxPlaybackMetadata(document, playbackId)?.identity).toEqual(metadata.identity);
		const video = document.querySelector("video")!;
		video.hidden = true;
		expect(readHboMaxPlaybackMetadata(document, playbackId)).toBeNull();
		video.hidden = false;
		video.parentElement!.insertAdjacentHTML("beforeend", '<div data-testid="ad"></div>');
		expect(readHboMaxPlaybackMetadata(document, playbackId)).toBeNull();
		route(nextId);
		route(playbackId);
		video.parentElement!.querySelector('[data-testid="ad"]')!.remove();
		emit(packet);
		expect(readHboMaxPlaybackMetadata(document, playbackId)).toBeNull();
	});

	it("identifies a fresh direct watch with idle native controls and an independently named playing episode", () => {
		const player = document.querySelector('[data-testid="playerContainer"]')!;
		const main = document.createElement("main");
		main.setAttribute("aria-label", metadata.episodeTitle);
		document.body.append(main);
		main.append(player);
		document.title = metadata.episodeTitle + " • HBO Max";
		player.querySelector('[data-testid="content-metadata"]')!.setAttribute("aria-hidden", "true");
		stop = startHboMaxCatalogCapture(document);
		emit(packet);
		expect(readHboMaxPlaybackMetadata(document, playbackId)).toMatchObject(metadata);
		document.title = "Anterior • HBO Max";
		expect(readHboMaxCatalogContext(document, seriesId, playbackId)).toBeNull();
	});

	it.each(["room", "saved"] as const)("rejects an exact %s identity for a different series", async authority => {
		const conflicting = { ...metadata, identity: { kind: "episode" as const, providerSeriesId: nextId, providerEpisodeIdentifier: playbackId } };
		stop = startHboMaxCatalogCapture(document, authority === "saved" ? async () => conflicting : undefined);
		if (authority === "room") observeHboMaxRoomSource(document, {
			provider: "hbomax", sourceUrl: hboMaxSourceUrl(playbackId), canonicalUrl: hboMaxSourceUrl(playbackId),
			videoFingerprint: hboMaxFingerprint(playbackId), title: metadata.title, hbomaxIdentity: conflicting.identity,
		});
		await Promise.resolve();
		emit(packet);
		expect(readHboMaxCatalogContext(document, seriesId, playbackId)).toBeNull();
	});

	it("includes the exact player video when the native show rail opens on another season", async () => {
		stop = startHboMaxCatalogCapture(document);
		document.querySelector('[data-testid="player-ux-season-episode"]')!.textContent = "S2 E1";
		emit({ ...packet, metadata: { ...metadata, seasonNumber: 2 }, episodes: [second], show: {
			...packet.show, seasons: [...packet.show.seasons, { id: nextId, number: 2, title: "S2", episodeCount: 1 }],
		} });
		publicEpisodes.mockImplementation(async (_show, known) => known);
		const result = await loadHboMaxCatalog(document, seriesId, playbackId, new AbortController().signal);
		expect(result?.seasons.map(row => [row.seasonNumber, row.episodes[0]?.providerEpisodeIdentifier])).toEqual([[1, nextId], [2, playbackId]]);
	});

	it("waits for the native episode rail when current playback is known first", async () => {
		stop = startHboMaxCatalogCapture(document);
		emit({ ...packet, show: null, episodes: [] });
		publicEpisodes.mockResolvedValue([first, second]);
		const request = loadHboMaxCatalog(document, seriesId, playbackId, new AbortController().signal);
		expect(publicEpisodes).not.toHaveBeenCalled();
		emit(packet);
		expect((await request)?.seasons[0]?.episodes).toHaveLength(2);
	});

	it("discards an older inventory when the player's route supplies newer native rows", async () => {
		stop = startHboMaxCatalogCapture(document);
		emit(packet);
		publicEpisodes.mockImplementationOnce(async () => {
			emit({ ...packet, episodes: [first, second] });
			return [{ ...first, title: "Stale" }];
		}).mockImplementationOnce(async (_show, known) => known);
		const result = await loadHboMaxCatalog(document, seriesId, playbackId, new AbortController().signal);
		expect(result?.seasons[0]?.episodes.map(row => row.title)).toEqual(["First", "Second"]);
	});

	it("cancels collection across navigation, even when returning to the same episode", async () => {
		stop = startHboMaxCatalogCapture(document);
		emit(packet);
		let finish!: () => void;
		publicEpisodes.mockImplementation(async () => {
			await new Promise<void>(resolve => { finish = resolve; });
			return [first, second];
		});
		const request = loadHboMaxCatalog(document, seriesId, playbackId, new AbortController().signal);
		route(nextId);
		route(playbackId);
		emit(packet);
		expect(publicEpisodes.mock.calls[0]?.[4].aborted).toBe(true);
		finish();
		expect(await request).toBeNull();
	});
});
