import { expect, it, vi } from "vitest";
import {
	catalogRoomProvider,
	isCatalogRoomSender,
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
it("follows a new Netflix play once even for the same episode, while ignoring an old heartbeat", () => {
	const source = {
		provider: "netflix" as const,
		sourceUrl: url + "/watch/123",
		canonicalUrl: url + "/watch/123",
		title: "Show",
		videoFingerprint: "netflix|watch/123",
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
	guest.setRoom("room");
	guest.receive(play.state, source, launch);
	guest.setBrowsing(true);
	guest.receive(play.state, source, launch);
	expect(launch).not.toHaveBeenCalled();
	const pause = host.close("room")!;
	expect(pause.state.playing).toBe(false);
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
	expect(
		host.playback({ ...event, state: { ...event.state, playing: false } })
			?.state.playing,
	).toBe(false);
});
