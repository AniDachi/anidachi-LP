import { afterEach, describe, expect, it, vi } from "vitest";
import { WatchCatalogCommitRequestSchema, type WatchHistoryResponse, hboMaxFingerprint, hboMaxSourceUrl } from "@anidachi/protocol";
import { readHboMaxCatalog, startHboMaxCatalogCapture } from "../src/source-adapters/hbomax/catalog";
import { observeHboMaxRoomSource, readHboMaxPlaybackMetadata } from "../src/source-adapters/hbomax/metadata";
import { hboMaxHistoryPolicy } from "../src/source-adapters/hbomax/history";
import { HISTORY_OBSERVATION_SUSPENDED } from "../src/source-adapters/core/history-policy";
import { hboMaxMetadataFromHistory } from "../src/source-adapters/hbomax/history-metadata";
import { createWatchHistoryPageResolver } from "../src/watch-history-catalog";
import type { WatchHistoryLocalEvent } from "../src/watch-history-outbox";
import type { WatchHistoryMessage } from "../src/watch-history-client";
import { historyOwner, paidHistoryLease } from "./watch-history-personal-fixtures";
vi.mock("../src/history-recording-choice", () => ({ isHistoryRecordingEnabled: vi.fn(async () => true) }));
import type { VideoAdapter } from "../src/source-adapters/core/types";

const series = "b117b2fd-aed9-43d8-aa30-66f7f10d2cb2", first = "4d269596-6871-4419-892a-ca2b801d447d";
const movie = "e7dc7b3a-a494-4ef1-8107-f4308aa6bbf7", film = "07323549-c382-4363-a3fe-97a365e81331";
const second = "00000000-0000-4000-8000-000000000021";
let stop = () => {};
function route(path: string) {
	(window as unknown as {happyDOM: {setURL(url: string): void}}).happyDOM.setURL("https://www.hbomax.com" + path);
}
function panel(season: number, episode: string, title: string) {
	return `<section role="tabpanel"><h2>Season ${season}</h2><a data-testid="${episode}_tile" href="/video/watch/${episode}"><p><span class="StyledPrimaryTitle">1. ⁨${title}⁩</span></p></a></section>`;
}
function player(id: string, title: string, episode?: string) {
	route("/video/watch/" + id);
	document.body.innerHTML = `<div data-testid="playerContainer"><video></video><div data-testid="content-metadata">
		<h2 data-testid="player-ux-asset-title">${title}</h2>${episode ? `<span data-testid="player-ux-season-episode">S1 E1: &nbsp;</span><span data-testid="player-ux-asset-subtitle">${episode}</span>` : ""}</div></div>`;
}
function observation(id: string, phase = "content") {
	const adapter = { provider: "hbomax", video: document.querySelector("video") ?? document.createElement("video"),
		getPlaybackSnapshot: () => ({ phase, contentTime: 22 }), getSourceDescriptor: () => ({ sourceUrl: hboMaxSourceUrl(id), duration: 88 }) } as unknown as VideoAdapter;
	return hboMaxHistoryPolicy.observe({ adapter, preferences: null });
}
afterEach(() => { stop(); document.body.innerHTML = ""; });

describe("HBO Max public catalog and personal history", () => {
	it("keeps rendered seasons partial and counts only the playing episode", () => {
		route("/show/" + series);
		document.documentElement.lang = "en-US";
		document.body.innerHTML = "<h1>War</h1>" + panel(1, first, "It's Done") + panel(2, second, "Return");
		stop = startHboMaxCatalogCapture(document);
		expect(observation(first)).toBeNull();
		player(first, "War", "It's Done");
		expect(observation(first)).toMatchObject({ currentTime: 22, duration: 88, progress: .25, title: "War", episodeTitle: "It's Done",
			titleKey: "hbomax:series:" + series, episodeKey: "hbomax:episode:" + first, seasonNumber: 1, episodeNumber: 1 });
		expect(readHboMaxCatalog(document, series, first)).toMatchObject({ completeness: "partial", context: {region: null},
			seasons: [{ seasonNumber: 1 }, { seasonNumber: 2 }] });
		expect(observation(first, "ad")).toBe(HISTORY_OBSERVATION_SUSPENDED);
		player(first, "Other", "It's Done");
		expect(readHboMaxPlaybackMetadata(document, first)).toBeNull();
	});
	it.each([["primary", true], ["restart", true], ["trailer", false]])("binds movie detail on %s click", (control, recorded) => {
		route("/movie/" + movie);
		document.body.innerHTML = `<nav><h1 role="presentation"><img alt=""></h1></nav><main aria-label="Dune"><div role="heading" aria-level="1" aria-label="Dune"><img alt=""></div><div data-testid="infoBlockFullContent">
			<div><button id="primary" data-testid="play_button">Resume</button><button id="restart" data-testid="restart_button">Restart</button></div>
			<div><button id="trailer" data-testid="play_button">Trailer</button><button data-testid="myList_button"></button></div></div></main>`;
		stop = startHboMaxCatalogCapture(document);
		document.querySelector<HTMLButtonElement>("#" + control)!.click();
		player(film, "Dune");
		const metadata = readHboMaxPlaybackMetadata(document, film);
		if (recorded) expect(metadata?.identity).toEqual({ kind: "movie", providerMovieId: movie, providerPlaybackId: film });
		else expect(metadata).toBeNull();
	});
	it("requires exact room or saved identity and matching public labels for direct entry", async () => {
		player(first, "War", "It's Done");
		const load = vi.fn(async () => null);
		stop = startHboMaxCatalogCapture(document, load);
		await Promise.resolve();
		expect(load).toHaveBeenCalledOnce();
		expect(readHboMaxPlaybackMetadata(document, first)).toBeNull();
		observeHboMaxRoomSource(document, { provider: "hbomax", sourceUrl: hboMaxSourceUrl(first), canonicalUrl: hboMaxSourceUrl(first),
			videoFingerprint: hboMaxFingerprint(first), title: "War", seriesTitle: "War", episodeTitle: "It's Done", seasonNumber: 1, episodeNumber: 1,
			hbomaxIdentity: { kind: "episode", providerSeriesId: series, providerEpisodeIdentifier: first } });
		expect(readHboMaxPlaybackMetadata(document, first)?.identity.kind).toBe("episode");
		expect(readHboMaxCatalog(document, series, first)).toBeNull();
	});
	it("commits the observed rows only after authenticated catalog admission with the exact immutable context", async () => {
		route("/show/" + series);
		document.documentElement.lang = "en-US";
		document.body.innerHTML = "<h1>War</h1>" + panel(1, first, "It's Done");
		stop = startHboMaxCatalogCapture(document);
		player(first, "War", "It's Done");
		const observed = observation(first);
		expect(typeof observed).toBe("object");
		const lease = paidHistoryLease(historyOwner, Date.now() - 1000);
		const event = { ...(observed as object), accountGeneration: 1, clientEventId: "event", clientSessionKey: "session", captureProof: lease } as WatchHistoryLocalEvent;
		const messages: WatchHistoryMessage[] = [];
		const resolver = createWatchHistoryPageResolver({ send: async message => {
			messages.push(message);
			return { ok: true, data: message.command === "bootstrap-cache" ? { accessLease: lease } : {
				meta: { schemaVersion: 3, ownerUserId: historyOwner, accountGeneration: 1, serverTime: new Date().toISOString() },
				schemaVersion: 3, accountGeneration: 1, provider: "hbomax", titleKey: event.titleKey, revision: 1,
				refreshRequired: true, availabilityChanged: true, effectiveCatalogState: "partial",
				projectionRevision: null, acceptedHash: null, acceptedAt: null,
			} };
		} });
		await resolver.resolve(event, historyOwner, { refreshCatalog: true });
		const commit = messages.find(message => message.command === "catalog-commit");
		if (commit?.command !== "catalog-commit") throw new Error("Expected HBO Max catalog commit");
		const { snapshot } = WatchCatalogCommitRequestSchema.parse(commit.input);
		expect(snapshot.seasons[0]?.episodes).toHaveLength(1);
		expect(messages.map(message => message.command)).toContain("catalog-release");
		resolver.dispose();
	});

	it("recovers the separate detail and playable UUIDs for a saved movie", async () => {
		const history = { items: [{ provider: "hbomax", titleKey: "hbomax:movie:" + movie, itemKind: "movie", title: "Dune",
			sourceUrl: hboMaxSourceUrl(film), latestActivity: {episodeKey: "hbomax:movie:" + film} }] } as WatchHistoryResponse;
		const saved = hboMaxMetadataFromHistory(history, film);
		expect(saved?.identity).toEqual({ kind: "movie", providerMovieId: movie, providerPlaybackId: film });
		expect(hboMaxMetadataFromHistory(history, movie)).toBeNull();
		player(film, "Dune");
		stop = startHboMaxCatalogCapture(document, async () => saved);
		await vi.waitFor(() => expect(readHboMaxPlaybackMetadata(document, film)?.title).toBe("Dune"));
		player(first, "Dune");
		expect(readHboMaxPlaybackMetadata(document, first)).toBeNull();
	});
	it.each([
		["fr", "Saison ２", "Saison ２, Épisode ３", "３. L’été", "S2 E3", "L'été"],
		["ja", "シーズン２", "シーズン２ 第３話", "第３話：旅立ち", "シーズン２ 第３話", "旅立ち"],
	])("uses localized ordinals from the selected menu and public card (%s)", (_locale, season, coordinates, cardTitle, playerLabel, subtitle) => {
		route("/show/" + series);
		document.body.innerHTML = `<h1>War</h1><div role="tabpanel"><button aria-haspopup="true" aria-expanded="false">${season}</button>
			<a data-sonic-type="video" data-sonic-id="${first}" data-testid="${first}_tile" href="/video/watch/${first}" aria-label="⁦⁨${coordinates}: Title⁩⁩. 1 of 10.">
				<p><span class="StyledPrimaryTitle">${cardTitle}</span></p></a></div>`;
		stop = startHboMaxCatalogCapture(document);
		player(first, "War", subtitle);
		document.querySelector('[data-testid="player-ux-season-episode"]')!.textContent = playerLabel;
		expect(readHboMaxPlaybackMetadata(document, first)).toMatchObject({ seasonNumber: 2, episodeNumber: 3 });
		document.querySelector('[data-testid="player-ux-season-episode"]')!.textContent = "E2 S3";
		expect(readHboMaxPlaybackMetadata(document, first)).toBeNull();
	});
	it("rejects stale rows while the provider is loading another season", () => {
		route("/show/" + series);
		document.body.innerHTML = `<h1>War</h1><div role="tabpanel"><button aria-haspopup="true" aria-expanded="false">Season 2</button>
			<a data-testid="${first}_tile" href="/video/watch/${first}" aria-label="⁦⁨Season 1, Episode 1: ⁨It's Done⁩⁩. ⁨1 of 10⁩."><p>1. It's Done</p></a></div>`;
		stop = startHboMaxCatalogCapture(document);
		player(first, "War", "It's Done");
		expect(readHboMaxPlaybackMetadata(document, first)).toBeNull();
		document.querySelector('[data-testid="player-ux-season-episode"]')!.textContent = "S2 E1";
		expect(readHboMaxPlaybackMetadata(document, first)).toBeNull();
	});
	it("accumulates only seasons whose episode rows actually render during a visit", async () => {
		route("/show/" + series);
		document.documentElement.lang = "en-US";
		const rows = (season: number, id: string, title: string) => `<a data-testid="${id}_tile" href="/video/watch/${id}"
			aria-label="Season ${season}, Episode 1: ${title}. 1 of 10."><p>1. ${title}</p></a>`;
		document.body.innerHTML = `<h1>War</h1><div role="tabpanel"><button aria-haspopup="true" aria-expanded="false">Season 1</button>
			<div id="rows">${rows(1, first, "It's Done")}</div></div>`;
		stop = startHboMaxCatalogCapture(document);
		document.querySelector("button")!.textContent = "Season 2";
		document.querySelector("#rows")!.innerHTML = rows(2, second, "Return");
		// Capture the selected season immediately before leaving the catalog.
		document.querySelector("h1")!.dispatchEvent(new Event("click", { bubbles: true }));
		player(second, "War", "Return");
		document.querySelector('[data-testid="player-ux-season-episode"]')!.textContent = "S2 E1:";
		expect(readHboMaxCatalog(document, series, second)?.seasons.map(s => [s.seasonNumber, s.episodes.length])).toEqual([[1, 1], [2, 1]]);
	});
	it("keeps player clock mutations out of public catalog scans", async () => {
		player(first, "War", "It's Done");
		stop = startHboMaxCatalogCapture(document);
		const scan = vi.spyOn(document, "querySelectorAll");
		try {
			const time = document.createElement("span");
			document.body.append(time);
			time.textContent = "00:03";
			await new Promise(resolve => setTimeout(resolve, 100));
			expect(scan).not.toHaveBeenCalled();
		} finally { scan.mockRestore(); }
	});
	it("uses local player labels for an exact guest UUID with matching episode coordinates", () => {
		player(first, "El Pingüino", "Después de horas");
		stop = startHboMaxCatalogCapture(document);
		const source = { provider: "hbomax" as const, sourceUrl: hboMaxSourceUrl(first), canonicalUrl: hboMaxSourceUrl(first),
			videoFingerprint: hboMaxFingerprint(first), title: "The Penguin", seriesTitle: "The Penguin", episodeTitle: "After Hours",
			seasonNumber: 1, episodeNumber: 1, hbomaxIdentity: { kind: "episode" as const, providerSeriesId: series, providerEpisodeIdentifier: first } };
		observeHboMaxRoomSource(document, source);
		expect(readHboMaxPlaybackMetadata(document, first)).toMatchObject({ title: "El Pingüino", episodeTitle: "Después de horas" });
		document.querySelector('[data-testid="player-ux-season-episode"]')!.textContent = "T1 E2";
		expect(readHboMaxPlaybackMetadata(document, first)).toBeNull();
	});
	it("waits for old player labels to change after a movie URL transition", async () => {
		player(first, "War");
		stop = startHboMaxCatalogCapture(document);
		expect(readHboMaxPlaybackMetadata(document, first)).toBeNull();
		route("/video/watch/" + film);
		observeHboMaxRoomSource(document, { provider: "hbomax", sourceUrl: hboMaxSourceUrl(film), canonicalUrl: hboMaxSourceUrl(film),
			videoFingerprint: hboMaxFingerprint(film), title: "Dune", hbomaxIdentity: { kind: "movie", providerMovieId: movie, providerPlaybackId: film } });
		expect(readHboMaxPlaybackMetadata(document, film)).toBeNull();
		document.querySelector('[data-testid="player-ux-asset-title"]')!.textContent = "Duna";
		expect(readHboMaxPlaybackMetadata(document, film)).toMatchObject({ title: "Duna", episodeTitle: "Duna" });
	});
	it.each([false, true])("reads watched War cards alongside empty tile action menus (season selector %s)", multiple => {
		route("/show/" + series);
		document.documentElement.lang = "en";
		document.body.innerHTML = `<h1>War</h1><div role="tabpanel">
			<button data-tile-action-menu="true" data-testid="dropdownToggleButton" aria-haspopup="true" aria-expanded="false"></button>
			${multiple ? '<button aria-haspopup="true" aria-expanded="false"><span>Season 1</span></button>' : '<h2>Season 1</h2>'}
			<a data-testid="${first}_tile" href="/video/watch/${first}" aria-label="⁦⁨Watch ⁨Season 1, Episode 1: ⁨It's Done⁩⁩⁩. 1 of 10."><p>1. ⁨It's Done⁩</p></a></div>`;
		stop = startHboMaxCatalogCapture(document);
		player(first, "War", "It's Done");
		document.querySelector('[data-testid="playerContainer"]')!.insertAdjacentHTML("afterbegin",
			'<div data-testid="content-metadata">Quick Catch-Up<span data-testid="player-ux-asset-title">War</span></div>');
		expect(readHboMaxPlaybackMetadata(document, first)?.episodeTitle).toBe("It's Done");
		expect(readHboMaxCatalog(document, series, first)?.seasons[0]?.episodes[0]?.providerEpisodeIdentifier).toBe(first);
	});
	it.each([
		["War", "It's Done", false], ["Game of Thrones", "Winter Is Coming", true],
	] as const)("reads %s from its labelled main heading beside the navigation logo", (title, episodeTitle, hasMenu) => {
		route("/show/" + series);
		document.documentElement.lang = "en";
		const artwork = "https://images.cdn.prd.api.discomax.com/YJfqK/AZSMHD71Ag5vb-HrQ.jpeg";
		document.body.innerHTML = `<nav><h1 role="presentation"><img alt=""></h1></nav><main aria-label="${title}">
			<div role="heading" aria-level="1" aria-label="${title}"><div aria-hidden="true"><img alt=""></div></div>
			<picture><source srcset="${artwork}?w=450&f=jpeg 450w"><img alt="${title}"></picture>
			<div data-testid="infoBlockFullContent"><button data-testid="play_button"></button><button data-testid="myList_button"></button></div>
			<div role="tabpanel">${hasMenu ? '<button aria-expanded="false" aria-haspopup="true"><span>Season 1</span></button>' : '<h2>Season 1</h2>'}
			<button data-tile-action-menu="true" data-testid="dropdownToggleButton" aria-haspopup="true" aria-expanded="false"></button>
			<a data-sonic-id="${first}" data-sonic-type="video" data-testid="${first}_tile" href="/video/watch/${first}"
				aria-label="⁦⁨Watch ⁨Season 1, Episode 1: ⁨${episodeTitle}⁩⁩⁩. ⁨1 of 10⁩."><p><span class="StyledPrimaryTitle">1. ⁨${episodeTitle}⁩</span></p></a></div></main>`;
		stop = startHboMaxCatalogCapture(document);
		player(first, title, episodeTitle);
		expect(readHboMaxPlaybackMetadata(document, first)).toMatchObject({ title, episodeTitle, artworkUrl: artwork });
		expect(readHboMaxCatalog(document, series, first)?.seasons[0]?.episodes[0]?.title).toBe(episodeTitle);
	});
});
