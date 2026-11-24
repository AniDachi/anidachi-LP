import { describe, expect, it, vi } from "vitest";
import {
	captureHboLobbyInvite,
	lobbyRoomFromUrl,
	getPopupCreate,
	isDisneyRoomSurface,
	popupRoomProvider,
	popupRoomInvite,
} from "../src/popup-room-launch";
import { PrimeBrowsingRoom } from "../src/source-adapters/primevideo/browsing-room";
import { startContentLifecycle } from "../entrypoints/content";
import { disneyLaunchFragment, disneyRedirectKey } from "../src/source-adapters/disneyplus/launch-redirect";

vi.mock("../src/popup-room-launch", async (original) => ({
	...await original<typeof import("../src/popup-room-launch")>(),
	ROOMS_PILOT: true,
}));

describe("popup room before playback", () => {
	it("keeps the HBO invitation when the catalog drops the fragment, until admission consumes it", () => {
		const home = "https://play.max.com/br/pt/home";
		const link = home + "#anidachiRoom=guest-room&anidachiLobby=hbomax";
		for (const entry of [link, home]) {
			const invite = captureHboLobbyInvite(entry, { type: "navigate", name: link });
			expect(invite?.read(home)).toBe("guest-room");
			expect(invite?.read(home)).toBe("guest-room");
			invite?.consume();
			expect(invite?.read(home)).toBeNull();
		}
		for (const next of [home + "#other", home + "#anidachiRoom=other&anidachiLobby=hbomax", home.replace("/home", "/movies")]) {
			const invite = captureHboLobbyInvite(link);
			expect(invite?.read(next)).toBeNull();
			expect(invite?.read(home)).toBeNull();
		}
		for (const type of ["reload", "back_forward"] as const) {
			expect(captureHboLobbyInvite(home, { type, name: link })).toBeNull();
		}
		expect(captureHboLobbyInvite(home, { type: "navigate", name: link.replace("play.max.com", "www.hbomax.com") })).toBeNull();
		expect(captureHboLobbyInvite(link.replace("Lobby=hbomax", "Lobby=netflix"))).toBeNull();
	});
	it.each([["disneyplus", false], ["disneyplus", true], ["netflix", false], ["netflix", true], ["primevideo", false], ["primevideo", true], ["hbomax", false], ["hbomax", true], ["crunchyroll", false], ["crunchyroll", true]] as const)("waits for the signed-in %s catalog (invite %s)", async (provider, invited) => {
		const hash = "anidachiRoom=abc&anidachiLobby=" + provider;
		const home = {
			disneyplus: "https://www.disneyplus.com/home",
			netflix: "https://www.netflix.com/browse",
			primevideo: "https://www.amazon.de/-/en/gp/video/detail/B0HL3NHK3N",
			crunchyroll: "https://www.crunchyroll.com/ru/discover",
			hbomax: "https://play.max.com/br/pt/home",
		}[provider];
		vi.useFakeTimers();
		vi.stubGlobal("location", new URL(home + (invited ? "#" + hash : "")));
		const sendMessage = vi.fn(async (message: { action?: string }) =>
			!invited && message.action === "claim"
				? { owner: "host", id: "creation", provider, expires: Date.now() + 60_000 }
				: null);
		vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });
		const mount = vi.fn(adapter => ({ adapter, dispose: vi.fn(), suspend: vi.fn(), relocate: vi.fn(), replaceAdapter: vi.fn() }));
		document.body.innerHTML = provider === "netflix" ? '<div data-uia="profile-gate-screen"><a href="/browse">Profile</a></div>' : '<main><h1>Page not found</h1><a href="/">Disney+ Home</a></main>';
		const session = startContentLifecycle({
			detect: () => ({ status: "none" }), ensureStyles() {}, lookupPrimeRoom: async () => null,
			installKeyboardGuard: () => () => {}, startProviderStudy: () => null, mount,
		});
		const claims = () => sendMessage.mock.calls.filter(([message]) => message.action === "claim");
		try {
			await vi.advanceTimersByTimeAsync(1800);
			expect(claims()).toHaveLength(0);
			expect(mount).not.toHaveBeenCalled();
			document.body.innerHTML = {
				primevideo: '<div id="dv-web-page-hydration-root"><a href="/gp/video/storefront">Startseite</a></div>',
				netflix: '<div class="main-header"><a href="/browse/genre/83">TV Shows</a></div>',
				disneyplus: '<nav><a href="/pt-br/browse/watchlist">Minha lista</a></nav><main></main>',
				crunchyroll: '<header><div role="button" aria-controls="user-menu-authenticated"></div></header>',
				hbomax: '<nav><div data-testid="navigationMenu"><a data-testid="my-stuff_button" href="/br/pt/my-stuff">Minha lista</a><button data-testid="profile_button">Perfil</button></div></nav>',
			}[provider];
			await vi.advanceTimersByTimeAsync(8000);
			expect(claims()).toHaveLength(1);
			expect(mount).toHaveBeenCalledTimes(1);
			if (!invited) expect(getPopupCreate()).toMatchObject({ id: "creation", path: new URL(home).pathname, provider });
		} finally {
			session.dispose();
			document.body.replaceChildren();
			vi.unstubAllGlobals();
			vi.useRealTimers();
		}
	});
	it("opens only real catalog/player surfaces and never treats a creation URL as an instruction", () => {
		expect(
			isDisneyRoomSurface("https://www.disneyplus.com/pt-br/browse/movies"),
		).toBe(true);
		for (const url of [
			"https://www.disneyplus.com/browse",
			"https://www.disneyplus.com/pt-br/browse/",
			"https://www.disneyplus.com/login",
			"https://www.disneyplus.com.evil.example/browse",
			"https://www.hulu.com/home",
		])
			expect(isDisneyRoomSurface(url)).toBe(false);
		expect(isDisneyRoomSurface("https://www.disneyplus.com/es-419/home")).toBe(true);
		const base = "https://www.disneyplus.com/home#";
		expect(disneyRedirectKey("https://www.disneyplus.com/pt-br/home")).toBe(disneyRedirectKey(base));
		expect(disneyLaunchFragment(base + "anidachiRoom=abc&anidachiLobby=disneyplus")).toBe("anidachiRoom=abc&anidachiLobby=disneyplus");
		expect(popupRoomProvider("https://www.primevideo.com/region/na/storefront")).toBe("primevideo");
		expect(popupRoomProvider("https://www.amazon.com/dp/B0HL3NHK3N")).toBeNull();
		expect(popupRoomProvider("https://www.amazon.de/gp/cart/view.html")).toBeNull();
		expect(popupRoomProvider("https://www.hbomax.com/")).toBe("hbomax");
		expect(popupRoomProvider("https://play.max.com/br/pt/video/watch/e4b915fb-5e6b-42b8-97ac-90ec7d0e3147")).toBe("hbomax");
		expect(popupRoomProvider("https://www.hbomax.com/profile/select")).toBeNull();
		expect(popupRoomProvider("https://hbo.com/home")).toBeNull();
		expect(popupRoomProvider("https://www.crunchyroll.com/pt-br/discover")).toBe("crunchyroll");
		for (const url of ["https://www.crunchyroll.com/login", "https://static.crunchyroll.com/discover", "https://www.crunchyroll.com/account"]) expect(popupRoomProvider(url)).toBeNull();
		const netflix = "https://www.netflix.com/browse#";
		expect(lobbyRoomFromUrl(netflix + "anidachiRoom=abc&anidachiLobby=netflix")).toBe("abc");
		expect(lobbyRoomFromUrl(netflix + "anidachiRoom=abc&anidachiLobby=disneyplus")).toBeNull();
		expect(popupRoomProvider("https://www.netflix.com/watch/80000123")).toBe("netflix");
		expect(popupRoomProvider("https://www.netflix.com/login")).toBeNull();
		expect(popupRoomProvider("https://www.netflix.com/ProfilesGate")).toBeNull();
		expect(new URL(popupRoomInvite("abc", "netflix")).searchParams.get("lobby")).toBe("netflix");
		expect(
			lobbyRoomFromUrl(base + "anidachiRoom=abc&anidachiLobby=disneyplus"),
		).toBe("abc");
		expect(lobbyRoomFromUrl(base + "create=1")).toBeNull();
		expect(
			lobbyRoomFromUrl(
				base + "anidachiRoom=abc&anidachiRoom=def&anidachiLobby=disneyplus",
			),
		).toBeNull();
		expect(new URL(popupRoomInvite("abc", "disneyplus")).pathname).toBe("/room/abc");
		expect(new URL(popupRoomInvite("abc", null)).search).toBe("");
	});
	it("follows the first real play from an empty lobby once, including after restoration", () => {
		const url =
			"https://www.disneyplus.com/play/120ae1e6-2240-4924-a4ce-f8de6e28b0b1";
		const source = {
			provider: "disneyplus" as const,
			sourceUrl: url,
			canonicalUrl: url,
			videoFingerprint: "disneyplus|first",
			title: "First",
		};
		const state = {
			playing: false,
			hostTime: 0,
			updatedAt: 10,
			playbackRate: 1,
			videoFingerprint: source.videoFingerprint,
		};
		const room = new PrimeBrowsingRoom();
		room.setRoom("abc");
		room.setBrowsing(true, { followFirstPlay: true });
		const restored = new PrimeBrowsingRoom();
		restored.setRoom("abc");
		restored.setBrowsing(true, room.getBaseline());
		const launch = vi.fn(async () => true);
		restored.receive(state, source, launch);
		expect(launch).not.toHaveBeenCalled();
		restored.receive({ ...state, playing: true }, source, launch);
		restored.receive({ ...state, playing: true }, source, launch);
		expect(launch).toHaveBeenCalledOnce();
	});
});
