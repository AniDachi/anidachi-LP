import { expect, it, vi } from "vitest";
import {
	catalogRoomProvider,
	catalogPlayerProvider,
	isCatalogRoomSender,
	catalogWatchDestination,
	renderedHboMaxWatchUrl,
} from "../src/catalog-room-routes";
import {
	PrimeHostVisit,
	PrimeBrowsingRoom,
} from "../src/source-adapters/primevideo/browsing-room";

const url = "https://www.netflix.com";
it.each([
	"/browse",
	"/browse?jbv=123",
	"/browse/genre/83",
	"/search?q=test",
	"/latest",
	"/title/123",
	"/watch/123",
])("keeps an admitted Netflix room on %s", (path) => {
	expect(catalogRoomProvider(url + path)).toBe("netflix");
});
it.each([
	"https://www.netflix.com/account",
	"https://www.netflix.com/login",
	"https://www.netflix.com/watch/trailer",
	"https://netflix.com.evil.test/browse",
	"https://www.netflix.com:81/browse",
	"https://me@www.netflix.com/browse",
])("rejects %s", (href) => {
	expect(catalogRoomProvider(href)).toBeNull();
});
it.each([
	"/", "/es-ES", "/de/videos/alphabetical", "/watchlist", "/history", "/de/search?q=anime",
	"/discover", "/ru/discover", "/es-ES/discover/?from=home", "/discovery",
	"/fr/series/GSERIES/title", "/simulcast", "/releasecalendar", "/pt-br/watch/G_EP-2/nome",
])("recognizes a Crunchyroll catalog or player route on %s", path => {
	expect(catalogRoomProvider("https://www.crunchyroll.com" + path)).toBe("crunchyroll");
});
it.each([
	"https://www.crunchyroll.com/account", "https://www.crunchyroll.com/fr/login",
	"https://www.crunchyroll.com/ru/discover-account",
	"https://store.crunchyroll.com/", "https://www.crunchyroll.com.evil.test/watch/ABC",
	"https://user@www.crunchyroll.com/search", "https://www.crunchyroll.com:9999/videos",
	"https://www.crunchyroll.com/fr/watch/EP/unsupported/nested", "http://www.crunchyroll.com/",
])("keeps a Crunchyroll room off unsupported pages such as %s", href => {
	expect(catalogRoomProvider(href)).toBeNull();
});
it.each(["/", "/results?search_query=a", "/feed/subscriptions", "/feed/history", "/playlist?list=WL",
	"/@Music/videos", "/channel/UCabc/playlists", "/c/Example", "/hashtag/music", "/post/Ugkxsample", "/shorts/abcdefghijk",
])("keeps a YouTube room on %s without attaching a catalog preview as a player", path => {
	const href = "https://www.youtube.com" + path;
	expect(catalogRoomProvider(href)).toBe("youtube");
	expect(catalogPlayerProvider(href)).toBeNull();
});
it.each(["https://www.youtube.com", "https://youtube.com", "https://m.youtube.com"])("recognizes watch and catalog on %s", origin => {
	const href = origin + "/watch?list=PLtest&v=a_-23456789&t=93";
	expect(catalogRoomProvider(href)).toBe("youtube");
	expect(catalogPlayerProvider(href)).toBe("youtube");
	expect(catalogRoomProvider(origin + "/")).toBe("youtube");
});
it("keeps the room when a playlist or search recommendation decorates the watch URL", () => {
	const href = "https://www.youtube.com/watch?v=a_-23456789&pp=" + "x".repeat(2400);
	expect(catalogRoomProvider(href)).toBe("youtube");
	expect(catalogPlayerProvider(href)).toBe("youtube");
	expect(catalogPlayerProvider(href + "&v=b_-23456789")).toBeNull();
});
it.each(["https://www.youtube.com/account", "https://www.youtube.com/embed/abcdefghijk",
	"https://www.youtube.com/redirect?q=x", "https://www.youtube.com/watch?v=aaaaaa&v=bbbbbb",
	"https://studio.youtube.com/", "https://music.youtube.com/", "https://www.youtube-nocookie.com/embed/abcdefghijk",
	"https://www.youtube.com:8080/", "https://user@www.youtube.com/", "http://www.youtube.com/",
])("does not admit persistent YouTube media on %s", href => {
	expect(catalogRoomProvider(href)).toBeNull();
	expect(catalogPlayerProvider(href)).toBeNull();
});
it("accepts only the same-origin main document during SPA navigation", () => {
	const tab = { id: 7, url: url + "/browse" } as chrome.tabs.Tab;
	expect(isCatalogRoomSender({ tab, frameId: 0, url: url + "/watch/12" })).toBe(
		true,
	);
	expect(isCatalogRoomSender({ tab, frameId: 2, url: tab.url })).toBe(false);
	expect(
		isCatalogRoomSender({
			tab,
			frameId: 0,
			url: "https://www.primevideo.com/",
		}),
	).toBe(false);
});
it("keeps Disney+ and the Hulu hub in the same room and opens the guest's localized player", () => {
	const origin = "https://www.disneyplus.com";
	const title = "/play/120ae1e6-2240-4924-a4ce-f8de6e28b0b1";
	for (const path of ["/", "/pt-br", "/de/", "/home", "/pt-br/browse/hulu", "/en-gb/search", "/fr/watchlist"]) {
		expect(catalogRoomProvider(origin + path)).toBe("disneyplus");
		expect(catalogPlayerProvider(origin + path)).toBeNull();
	}
	expect(catalogPlayerProvider(origin + "/en-gb" + title)).toBe("disneyplus");
	expect(catalogWatchDestination(origin + title, origin + "/pt-br/browse/hulu")).toBe(origin + "/pt-br" + title);
	for (const path of ["/pt-br/account", "/login", "/profiles", "/play/broken", "/browse/%2faccount"]) {
		expect(catalogRoomProvider(origin + path)).toBeNull();
	}
	expect(catalogRoomProvider("https://www.hulu.com" + title)).toBeNull();
});

it.each(["netflix", "crunchyroll", "disneyplus", "hbomax"] as const)("follows a new %s play once even for the same episode, while ignoring an old heartbeat", provider => {
	const url = "https://www." + provider + ".com";
	const path = provider === "hbomax" ? "/video/watch/4d269596-6871-4419-892a-ca2b801d447d" : provider === "disneyplus" ? "/play/120ae1e6-2240-4924-a4ce-f8de6e28b0b1" : "/watch/123";
	const source = {
		provider,
		sourceUrl: url + path,
		canonicalUrl: url + path,
		title: "Show",
		videoFingerprint: provider + "|" + path.slice(1),
	};
	const host = new PrimeHostVisit(),
		guest = new PrimeBrowsingRoom(),
		launch = vi.fn(async () => true);
	const event = {
		type: "HOST_STATE" as const,
		roomId: "room",
		source,
		state: {
			videoFingerprint: source.videoFingerprint,
			playing: true,
			hostTime: 3,
			updatedAt: Date.now(),
			playbackRate: 1,
		},
	};
	const play = host.playback(event)!;
	expect(play.state.hostSurface).toBe("player");
	guest.setRoom("room");
	guest.receive(play.state, source, launch);
	guest.setBrowsing(true);
	guest.receive(play.state, source, launch);
	expect(launch).not.toHaveBeenCalled();
	const pause = host.close("room")!;
	expect(pause.state.playing).toBe(false);
	expect(pause.state.hostSurface).toBe("catalog");
	guest.receive(pause.state, source, launch);
	const next = host.playback(event)!;
	guest.receive(next.state, source, launch);
	guest.receive(next.state, source, launch);
	expect(launch).toHaveBeenCalledTimes(1);
});

it("follows a new same-title visit after restoring a known episode without a visit ID", () => {
	const source = {
		provider: "netflix" as const,
		canonicalUrl: url + "/watch/123",
		sourceUrl: url + "/watch/123",
		title: "Fixture",
		videoFingerprint: "netflix|watch/123",
	};
	const guest = new PrimeBrowsingRoom();
	guest.setRoom("room");
	guest.setBrowsing(true, { fingerprint: source.videoFingerprint });
	const launch = vi.fn(async () => true);
	const state = {
		videoFingerprint: source.videoFingerprint,
		hostTime: 0,
		playing: true,
		playbackRate: 1,
		updatedAt: 123,
	};
	guest.receive(state, source, launch);
	expect(launch).not.toHaveBeenCalled();
	guest.receive(
		{ ...state, primePlayerVisit: crypto.randomUUID() },
		source,
		launch,
	);
	expect(launch).toHaveBeenCalledOnce();
});

it("waits for verified playback when a new player document reattaches an existing room", () => {
	const host = new PrimeHostVisit(true);
	const source = {
		provider: "netflix" as const,
		sourceUrl: url + "/watch/789",
		canonicalUrl: url + "/watch/789",
		videoFingerprint: "netflix|watch/789",
		title: "Episode",
	};
	const event = {
		type: "HOST_STATE" as const,
		roomId: "room",
		source,
		state: {
			videoFingerprint: source.videoFingerprint,
			hostTime: 0,
			playing: true,
			updatedAt: 1,
			playbackRate: 1,
		},
	};
	expect(host.playback({ ...event, source: undefined })).toBeNull();
	expect(
		host.playback({ ...event, state: { ...event.state, playing: false } }),
	).toBeNull();
	expect(host.playback(event)?.state.primePlayerVisit).toBeDefined();
	expect(host.playback({ ...event, state: { ...event.state, playing: false } })?.state.hostSurface).toBe("player");
	expect(
		host.playback({ ...event, state: { ...event.state, playing: false } })
			?.state.playing,
	).toBe(false);
});

it("keeps an HBO room across the browse menu and attaches a player only on exact watch routes", () => {
  const origin = "https://www.hbomax.com";
  const id = "4d269596-6871-4419-892a-ca2b801d447d";
  for (const path of ["/", "/home", "/movies", "/series", "/categories", "/audio-description", "/genre/action", "/channel/" + id, "/search", "/my-stuff", "/show/" + id, "/movie/" + id]) {
    expect(catalogRoomProvider(origin + path)).toBe("hbomax");
    expect(catalogPlayerProvider(origin + path)).toBeNull();
  }
  expect(catalogPlayerProvider(origin + "/video/watch/" + id)).toBe("hbomax");
  for (const path of ["/account", "/profiles", "/signin", "/video/watch/unknown"]) {
    expect(catalogRoomProvider(origin + path)).toBeNull();
  }
});

it("uses the guest's rendered HBO edition only for the exact episode and origin", () => {
	const current = "https://play.hbomax.com/br/pt/home";
	const id = "bf44a7dc-e340-4207-ae67-3736179c47c6";
	const source = "https://www.hbomax.com/video/watch/" + id;
	const edition = "8f3a759a-7464-438c-956d-a2e65bf3184f";
	const local = "https://play.hbomax.com/video/watch/" + id;
	const card = local + "/" + edition;
	const doc = new DOMParser().parseFromString("<html><body></body></html>", "text/html");
	Object.defineProperty(doc, "location", { value: new URL(current) });
	const add = (href: string) => { const link = doc.createElement("a"); link.href = href; doc.body.append(link); };
	add(source);
	add(local);
	add(card + "?from=home#anidachiRoom=old");
	add(card + "/");
	add(card.replace("/video/watch/", "/br/pt/video/watch/"));
	expect(renderedHboMaxWatchUrl(doc, source)).toBe(card);
	expect(catalogWatchDestination(source, current, card + "#anidachiRoom=old")).toBe(card);
	expect(catalogWatchDestination(source, current, card.replace(id, edition))).toBe(local);
	expect(catalogWatchDestination(source, current, source + "/" + edition)).toBe(local);
	add(local + "/" + id);
	expect(renderedHboMaxWatchUrl(doc, source)).toBe(local);
	expect(catalogWatchDestination(source, current)).toBe(local);
});

it("keeps regional HBO room messages bound to the current top-level origin", () => {
	const tab = { id: 3, url: "https://play.hbomax.com/br/pt/home" } as chrome.tabs.Tab;
	const sender = { tab, frameId: 0, url: tab.url, origin: "https://play.hbomax.com" };
	expect(isCatalogRoomSender(sender)).toBe(true);
	expect(isCatalogRoomSender({ ...sender, frameId: 1 })).toBe(false);
	expect(isCatalogRoomSender({ ...sender, url: "https://www.hbomax.com/br/pt/home" })).toBe(false);
	expect(isCatalogRoomSender({ ...sender, origin: "https://play.max.com" })).toBe(false);
});
