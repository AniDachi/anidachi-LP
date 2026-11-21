import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WatchCatalogCommitRequestSchema, disneyPlusFingerprint, disneyPlusSourceUrl, type WatchHistoryResponse, type WatchSourceDescriptor } from "@anidachi/protocol";
import { startDisneyPlusCatalogCapture, readDisneyPlusCatalog } from "../src/source-adapters/disneyplus/catalog";
import { captureDisneyPlusDetails, clearDisneyPlusDetails, clearDisneyPlusRoomSource, observeDisneyPlusRoomSource, readDisneyPlusPlaybackMetadata, readDisneyPlusPlayerTitle } from "../src/source-adapters/disneyplus/metadata";
import { disneyPlusHistoryPolicy } from "../src/source-adapters/disneyplus/history";
import { HISTORY_OBSERVATION_SUSPENDED } from "../src/source-adapters/core/history-policy";
import type { VideoAdapter } from "../src/source-adapters/core/types";
import { createWatchHistoryPageResolver } from "../src/watch-history-catalog";
import type { WatchHistoryLocalEvent } from "../src/watch-history-outbox";
import type { WatchHistoryMessage } from "../src/watch-history-client";
import { handleDisneyPlusCatalogHandoff, forgetDisneyPlusCatalogTab, isDisneyPlusProfileBoundary } from "../src/source-adapters/disneyplus/catalog-handoff";
import { disneyPlusMetadataFromHistory } from "../src/source-adapters/disneyplus/history-metadata";
import { getStoredAuthTokens, type ExtensionAuthTokens } from "../src/auth-tokens";
import { historyOwner, paidHistoryLease } from "./watch-history-personal-fixtures";

vi.mock("../src/source-adapters/disneyplus/history-metadata", async importOriginal => ({
	...await importOriginal<typeof import("../src/source-adapters/disneyplus/history-metadata")>(),
	readSavedDisneyPlusMetadata: vi.fn(async () => null),
}));
vi.mock("../src/auth-tokens", () => ({ getStoredAuthTokens: vi.fn() }));
vi.mock("../src/history-recording-choice", () => ({ isHistoryRecordingEnabled: vi.fn(async () => true) }));

const series = "00000000-0000-4000-8000-000000000001";
const first = "00000000-0000-4000-8000-000000000011";
const second = "00000000-0000-4000-8000-000000000012";
const seasonTwo = "00000000-0000-4000-8000-000000000021";
const movie = "120ae1e6-2240-4924-a4ce-f8de6e28b0b1";
const origin = "https://www.disneyplus.com";
const background = "https://disney.images.edge.bamgrid.com/image.jpg";

function route(path: string) {
	(window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(origin + path);
}
function card(id: string, season: number, n: number, title: string) {
	return `<a data-testid="set-item" href="/pt-br/play/${id}"
		aria-label="Hulu Original Series Temporada ${season} Episódio ${n}, ${title} Classificação 16 Selecione para assistir. 3 por cento concluído">
		<div data-testid="standard-regular-list-item-title">${n}. ${title}</div></a>`;
}
function seasonGrid(n: number, rows: string) {
	return `<button data-testid="dropdown-button">Temporada ${n}</button><div data-testid="set-grid">${rows}</div>`;
}
function seriesPage() {
	route(`/pt-br/browse/entity-${series}`);
	document.body.innerHTML = `<span data-testid="details-title-treatment"><img alt="Paradise"></span>
		<img data-testid="details-page-background-image-responsive" src="${background}" />
		<a data-testid="playback-action-button" href="/pt-br/play/${first}">Continuar</a>
		<button role="tab" aria-controls="episodes">Episódios</button>
		<section id="episodes" role="tabpanel">${seasonGrid(1, card(first, 1, 1, "Wildcat Caiu") + card(second, 1, 2, "Sinatra"))}</section>
		<section id="extras">${card(movie, 1, 3, "Trailer")}</section>`;
}
function playback(id = first) {
	route("/pt-br/play/" + id);
	document.body.innerHTML = "<video></video>";
	const adapter = {
		provider: "disneyplus", video: document.querySelector("video"),
		getPlaybackSnapshot: () => ({ phase: "content", contentTime: 62 }),
		getSourceDescriptor: () => ({ provider: "disneyplus", sourceUrl: disneyPlusSourceUrl(id), duration: 620 }),
	} as unknown as VideoAdapter;
	return adapter;
}
beforeEach(seriesPage);
afterEach(() => { clearDisneyPlusDetails(document); document.body.innerHTML = ""; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Disney+ history from rendered catalog and playable content", () => {
	it("groups Hulu episodes by series, carries only observed seasons and preserves the player's own progress", () => {
		const stop = startDisneyPlusCatalogCapture(document);
		const panel = document.querySelector("#episodes")!;
		panel.innerHTML = seasonGrid(2, card(first, 1, 1, "Wildcat Caiu")); // old grid during a season switch
		captureDisneyPlusDetails(document);
		panel.innerHTML = seasonGrid(2, card(seasonTwo, 2, 1, "Graceland"));
		panel.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		const adapter = playback();
		const result = disneyPlusHistoryPolicy.observe({ adapter, preferences: null });
		expect(result).toMatchObject({ titleKey: `disneyplus:series:${series}`, episodeKey: `disneyplus:episode:${first}`,
			seasonKey: `disneyplus:season:${series}:1`, artworkUrl: background, title: "Paradise", episodeTitle: "Wildcat Caiu",
			seasonTitle: "Temporada 1", episodeNumber: 1, currentTime: 62, duration: 620, progress: 0.1 });
		const catalog = readDisneyPlusCatalog(document, series, first);
		expect(catalog).toMatchObject({ completeness: "partial", context: { requestedLocale: "pt-BR", region: null },
			seasons: [{ title: "Temporada 1", episodes: [{ title: "Wildcat Caiu" }, { title: "Sinatra", available: true,
				watchVariants: [{ sourceUrl: disneyPlusSourceUrl(second) }] }] }, { title: "Temporada 2", episodes: [{ title: "Graceland" }] }] });
		expect(catalog?.seasons[0]?.episodes[1]).not.toHaveProperty("progress");
		expect(readDisneyPlusCatalog(document, series, movie)).toBeNull();
		stop();
		expect(readDisneyPlusPlaybackMetadata(document, first)).toBeNull();
	});
	it.each([
		["Temporada 1", "Temporada 1 Episódio 1", "O Livro dos Mórmons?"],
		["Sezonul 1", "Sezonul 1 Episodul 1", "Pilot"],
	])("reads the provider's single-season caption %s and exact playback membership", (caption, accessibleNumber, title) => {
		document.querySelector("img")!.alt = "A Vida Secreta das Esposas Mórmons: Orange County";
		document.querySelector("#episodes")!.innerHTML = `<div><p>${caption}</p></div><div><section data-testid="set-section"><div data-testid="set-grid">${card(first, 1, 1, title).replace("Temporada 1 Episódio 1", accessibleNumber)}</div></section></div>`;
		captureDisneyPlusDetails(document);
		const observation = disneyPlusHistoryPolicy.observe({ adapter: playback(), preferences: null });
		expect(observation).toMatchObject({ title: "A Vida Secreta das Esposas Mórmons: Orange County",
			seasonNumber: 1, seasonTitle: caption, episodeNumber: 1, episodeTitle: title });
		expect(readDisneyPlusCatalog(document, series, first)?.seasons[0]?.title).toBe(caption);
	});
	it("waits for overlapping grids to settle and rejects inconsistent unlabelled season ordinals", () => {
		const panel = document.querySelector("#episodes")!;
		const oldCard = card(first, 1, 1, "O Livro dos Mórmons?");
		const nextCard = card(seasonTwo, 2, 1, "Graceland");
		panel.innerHTML = `<p>Temporada 2</p><div data-testid="set-grid">${oldCard}</div><div data-testid="set-grid">${nextCard}</div>`;
		captureDisneyPlusDetails(document);
		route("/pt-br/play/" + seasonTwo);
		expect(readDisneyPlusPlaybackMetadata(document, seasonTwo)).toBeNull();
		route("/pt-br/browse/entity-" + series);
		panel.innerHTML = `<div data-testid="set-grid">${oldCard}${nextCard}</div>`;
		captureDisneyPlusDetails(document);
		route("/pt-br/play/" + first);
		expect(readDisneyPlusPlaybackMetadata(document, first)).toBeNull();
		route("/pt-br/browse/entity-" + series);
		panel.innerHTML = `<p>Temporada 2</p><div data-testid="set-grid">${nextCard}</div>`;
		captureDisneyPlusDetails(document);
		playback(seasonTwo);
		expect(readDisneyPlusPlaybackMetadata(document, seasonTwo)).toMatchObject({ seasonTitle: "Temporada 2", episodeTitle: "Graceland" });
	});
	it("records films only from their own primary play action with a movie runtime", () => {
		route("/en/browse/entity-" + movie);
		document.body.innerHTML = `<span data-testid="details-title-treatment"><img alt="Deadpool &amp; Wolverine"></span>
			<div data-testid="masthead-metadata">2024 • 2h 11min • Action</div>
			<a data-testid="playback-action-button" href="/en/play/${movie}"></a>
			<a data-testid="trailer-action-button" href="/en/play/${first}"></a><div>${card(second, 1, 1, "Extras")}</div>`;
		captureDisneyPlusDetails(document);
		expect(disneyPlusHistoryPolicy.observe({ adapter: playback(movie), preferences: null })).toMatchObject({
			titleKey: `disneyplus:movie:${movie}`, episodeKey: `disneyplus:movie:${movie}`, title: "Deadpool & Wolverine",
			itemKind: "movie", seasonKey: null, episodeNumber: null,
		});
		expect(disneyPlusHistoryPolicy.observe({ adapter: playback(first), preferences: null })).toBe(HISTORY_OBSERVATION_SUSPENDED);
	});
	it("allows a direct watch title for display and suspends uncertain identity, transitions and wrong-source player clocks", () => {
		let adapter = playback();
		document.title = "Paradise | Disney+";
		expect(readDisneyPlusPlayerTitle(document, first)).toBe("Paradise");
		expect(readDisneyPlusPlaybackMetadata(document, first)).toBeNull();
		expect(disneyPlusHistoryPolicy.observe({ adapter, preferences: null })).toBe(HISTORY_OBSERVATION_SUSPENDED);
		seriesPage(); captureDisneyPlusDetails(document);
		adapter = playback();
		vi.spyOn(adapter, "getPlaybackSnapshot").mockReturnValue({ phase: "interstitial", contentTime: 2, capturedAt: 1, playing: true, playbackRate: 1 });
		expect(disneyPlusHistoryPolicy.observe({ adapter, preferences: null })).toBe(HISTORY_OBSERVATION_SUSPENDED);
		adapter = playback();
		route("/pt-br/play/" + second);
		expect(disneyPlusHistoryPolicy.observe({ adapter, preferences: null })).toBe(HISTORY_OBSERVATION_SUSPENDED);
	});
	it("rejects unrelated play links and stale details while Disney changes entities", () => {
		document.querySelector<HTMLAnchorElement>(`a[href$="${second}"][data-testid="set-item"]`)!.href = "https://example.com/play/" + second;
		captureDisneyPlusDetails(document);
		route("/pt-br/browse/entity-" + movie);
		captureDisneyPlusDetails(document);
		playback();
		expect(readDisneyPlusPlaybackMetadata(document, first)?.identity).toMatchObject({ providerSeriesId: series });
		expect(readDisneyPlusCatalog(document, movie, first)).toBeNull();
		expect(readDisneyPlusCatalog(document, series, first)?.seasons[0]?.episodes).toHaveLength(1);
	});
	it("refuses the previous entity's still-mounted episode grid after Disney replaces the heading", () => {
		captureDisneyPlusDetails(document);
		route("/pt-br/browse/entity-" + movie);
		document.querySelector("img")!.alt = "Another series";
		captureDisneyPlusDetails(document);
		playback();
		expect(readDisneyPlusPlaybackMetadata(document, first)).toBeNull();
	});
	it("commits the observed rows only after authenticated catalog admission with the exact immutable context", async () => {
		captureDisneyPlusDetails(document);
		const observation = disneyPlusHistoryPolicy.observe({ adapter: playback(), preferences: null });
		expect(typeof observation).toBe("object");
		const lease = paidHistoryLease(historyOwner, Date.now() - 1000);
		const event = { ...(observation as object), accountGeneration: 1, clientEventId: "event", clientSessionKey: "session", captureProof: lease } as WatchHistoryLocalEvent;
		const messages: WatchHistoryMessage[] = [];
		const resolver = createWatchHistoryPageResolver({ send: async message => {
			messages.push(message);
			return { ok: true, data: message.command === "bootstrap-cache" ? { accessLease: lease } : {
				meta: { schemaVersion: 3, ownerUserId: historyOwner, accountGeneration: 1, serverTime: new Date().toISOString() },
				schemaVersion: 3, accountGeneration: 1, provider: "disneyplus", titleKey: event.titleKey, revision: 1,
				refreshRequired: true, availabilityChanged: true, effectiveCatalogState: "partial",
				projectionRevision: null, acceptedHash: null, acceptedAt: null,
			} };
		} });
		await resolver.resolve(event, historyOwner, { refreshCatalog: true });
		const commit = messages.find(message => message.command === "catalog-commit");
		if (commit?.command !== "catalog-commit") throw new Error("Expected Disney+ catalog commit");
		const { snapshot } = WatchCatalogCommitRequestSchema.parse(commit.input);
		expect(snapshot.seasons[0]?.episodes).toHaveLength(2);
		expect(messages.map(message => message.command)).toContain("catalog-release");
		resolver.dispose();
	});
});

describe("Disney+ tab-scoped metadata across documents", () => {
	it("recovers a roster only for the same tab, content, AniDachi login and lifetime", async () => {
		const store: Record<string, unknown> = {};
		const origin = "https://www.disneyplus.com";
		const tab = 11;
		const sender = { id: "extension", frameId: 0, url: document.location.href, origin, tab: { id: tab } } as chrome.runtime.MessageSender;
		const send = async (message: Parameters<typeof handleDisneyPlusCatalogHandoff>[0]) => handleDisneyPlusCatalogHandoff(message, sender);
		vi.stubGlobal("chrome", { runtime: { id: "extension" }, tabs: { get: async () => ({ url: document.location.href }) },
			storage: { session: { set: async (value: Record<string, unknown>) => Object.assign(store, value), get: async () => store,
				remove: async (key: string) => { delete store[key]; } } } });
		const auth = (session: string) => ({ user: { id: historyOwner }, authSessionId: session }) as ExtensionAuthTokens;
		vi.mocked(getStoredAuthTokens).mockResolvedValue(auth("first"));
		const firstDocument = startDisneyPlusCatalogCapture(document, send);
		await vi.waitFor(() => expect(Object.keys(store)).toHaveLength(1));
		expect(JSON.stringify(store)).not.toContain("por cento");
		firstDocument();
		playback();
		sender.url = document.location.href;
		const secondDocument = startDisneyPlusCatalogCapture(document, send);
		await vi.waitFor(() => expect(readDisneyPlusPlaybackMetadata(document, first)?.title).toBe("Paradise"));
		secondDocument();
		const read = { type: "ANIDACHI_DISNEYPLUS_CATALOG_HANDOFF", action: "read" };
		expect(await handleDisneyPlusCatalogHandoff(read, { ...sender, frameId: 1 })).toBeNull();
		expect(await handleDisneyPlusCatalogHandoff(read, { ...sender, origin: "https://example.com" })).toBeNull();
		expect(await handleDisneyPlusCatalogHandoff(read, { ...sender, tab: { ...sender.tab!, id: 12 } })).toBeNull();
		vi.mocked(getStoredAuthTokens).mockResolvedValue(auth("second"));
		expect(await send(read)).toBeNull();
		expect(Object.keys(store)).toHaveLength(0);
		seriesPage();
		const current = startDisneyPlusCatalogCapture(document, send);
		await vi.waitFor(() => expect(Object.keys(store)).toHaveLength(1));
		current(); playback();
		const future = Date.now() + 4 * 60 * 60 * 1000;
		vi.spyOn(Date, "now").mockReturnValue(future);
		expect(await send(read)).toBeNull();
		await forgetDisneyPlusCatalogTab(tab);
		expect(Object.keys(store)).toHaveLength(0);
		expect(isDisneyPlusProfileBoundary(origin + "/pt-br/select-profile")).toBe(true);
	});
	it("recovers exact previously saved identity on a fresh Resume without inventing a current catalog", async () => {
		playback();
		const history = { items: [{ provider: "disneyplus", itemKind: "series", titleKey: "disneyplus:series:" + series,
			title: "Paradise", artworkUrl: background, seasons: [{ episodes: [{
				sourceUrl: disneyPlusSourceUrl(first), episodeKey: "disneyplus:episode:" + first,
				seasonKey: "disneyplus:season:" + series + ":1", seasonTitle: "Temporada 1", seasonNumber: 1,
				episodeNumber: 1, episodeTitle: "Wildcat Caiu",
			}] }] }] } as WatchHistoryResponse;
		const metadata = disneyPlusMetadataFromHistory(history, first);
		expect(disneyPlusMetadataFromHistory(history, second)).toBeNull();
		const stop = startDisneyPlusCatalogCapture(document, async () => ({ metadata }));
		await vi.waitFor(() => expect(readDisneyPlusPlaybackMetadata(document, first)?.episodeTitle).toBe("Wildcat Caiu"));
		expect(readDisneyPlusCatalog(document, series, first)).toBeNull();
		stop();
	});
});

it("uses admitted host identity only for its exact first-time guest playback and drops it at room departure", () => {
	const adapter = playback();
	const source: WatchSourceDescriptor = { provider: "disneyplus", sourceUrl: disneyPlusSourceUrl(first), canonicalUrl: disneyPlusSourceUrl(first),
		videoFingerprint: disneyPlusFingerprint(first), title: "Paradise", seriesTitle: "Paradise", episodeTitle: "Wildcat Down",
		seasonNumber: 1, episodeNumber: 1, disneyplusIdentity: { kind: "episode", providerSeriesId: series, providerEpisodeIdentifier: first } };
	observeDisneyPlusRoomSource(document, source);
	expect(disneyPlusHistoryPolicy.observe({ adapter, preferences: null })).toMatchObject({
		episodeKey: "disneyplus:episode:" + first, episodeTitle: "Wildcat Down", currentTime: 62,
	});
	expect(readDisneyPlusCatalog(document, series, first)).toBeNull();
	clearDisneyPlusRoomSource(document);
	expect(readDisneyPlusPlaybackMetadata(document, first)).toBeNull();
	observeDisneyPlusRoomSource(document, { ...source, disneyplusIdentity: { kind: "episode", providerSeriesId: series, providerEpisodeIdentifier: second } });
	expect(readDisneyPlusPlaybackMetadata(document, first)).toBeNull();
	seriesPage(); captureDisneyPlusDetails(document); playback(); observeDisneyPlusRoomSource(document, source);
	expect(readDisneyPlusPlaybackMetadata(document, first)?.episodeTitle).toBe("Wildcat Caiu");
});
