import { ROOM_LOBBY_HOME, type RoomLobbyProvider } from "@anidachi/protocol";
import { afterEach, expect, it, vi } from "vitest";
import { registerPopupRoomLaunch } from "../src/popup-room-launch-background";
import { ROOM_LAUNCH_MESSAGE } from "../src/popup-room-launch";

vi.mock("../src/auth-tokens", () => ({
	getStoredAuthTokens: async () => ({ user: { id: "owner" } }),
}));
afterEach(() => vi.unstubAllGlobals());

it("only the popup can request creation, only its destination can claim it, and a live room is reused", async () => {
	const listeners: Function[] = [];
	const values: Record<string, unknown> = {};
	let live: { tabId: number; roomId: string; provider: string } | null = null;
	const tab = {
		id: 17,
		windowId: 1,
		url: "https://www.disneyplus.com/pt-br/browse/movies",
	};
	const update = vi.fn(async () => tab);
	const create = vi.fn();
	const query = vi.fn(async (_options: chrome.tabs.QueryInfo) => [tab]);
	vi.stubGlobal("chrome", {
		runtime: {
			id: "ext",
			getURL: (path: string) => "chrome-extension://ext/" + path,
			sendMessage: async () => live,
			onMessage: { addListener: (f: Function) => listeners.push(f) },
		},
		storage: {
			session: {
				get: async () => values,
				set: async (v: object) => Object.assign(values, v),
				remove: async (k: string) => {
					delete values[k];
				},
			},
		},
		windows: { update: vi.fn() },
		tabs: {
			query,
			get: async () => tab,
			create,
			update,
			sendMessage: async () => null,
		},
	});
	registerPopupRoomLaunch();
	const popup = { id: "ext", url: "chrome-extension://ext/popup.html" };
	const content = { id: "ext", url: tab.url, tab, frameId: 0 };
	const send = (action: string, sender: object, provider = "disneyplus") =>
		new Promise<any>((resolve) => {
			if (
				!listeners[0](
					{ type: ROOM_LAUNCH_MESSAGE, action, provider, owner: "owner" },
					sender,
					resolve,
				)
			)
				resolve(undefined);
		});
	expect(await send("open", content)).toBeUndefined();
	expect(await send("state", popup)).toEqual({ here: "disneyplus", room: null });
	expect(update).not.toHaveBeenCalled();
	await Promise.all([send("open", popup), send("open", popup)]);
	expect(create).not.toHaveBeenCalled();
	expect(
		await send("claim", { ...content, tab: { ...tab, id: 33 } }),
	).toBeNull();
	expect(await send("claim", { ...content, frameId: 1 })).toBeUndefined();
	expect(await send("claim", content)).toMatchObject({
		owner: "owner",
		id: expect.any(String),
	});
	expect(await send("claim", content)).toBeNull();
	live = { tabId: 19, roomId: "live", provider: "netflix" };
	expect((await send("state", popup)).room).toMatchObject({
		tabId: 19,
		here: false,
		provider: "netflix",
	});
	await send("open", popup);
	expect(update).toHaveBeenLastCalledWith(19, { active: true });
	expect(Object.keys(values)).toHaveLength(0);
	live = null;
	tab.url = "https://www.disneyplus.com/browse";
	expect(await send("state", popup)).toEqual({ here: null, room: null });
	create.mockResolvedValue({ id: 28 });
	await send("open", popup);
	expect(create).toHaveBeenCalledWith({ url: "https://www.disneyplus.com/home", windowId: 1, active: false });
	expect(await send("claim", { ...content, url: tab.url, tab })).toBeUndefined();
	tab.url = "https://www.netflix.com/browse";
	const netflix = { ...content, url: tab.url };
	expect(await send("state", popup)).toEqual({ here: "netflix", room: null });
	await send("open", popup, "netflix");
	expect(update).toHaveBeenLastCalledWith(tab.id, { active: true });
	expect(await send("claim", content)).toBeUndefined();
	expect(await send("claim", netflix)).toMatchObject({ owner: "owner", provider: "netflix" });
	expect(await send("claim", netflix)).toBeNull();
	const invite = { ...netflix, url: tab.url + "#anidachiRoom=abc&anidachiLobby=netflix" };
	await send("remember-profile-invite", invite);
	expect(await send("take-profile-invite", { ...netflix, tab: { ...tab, id: 22 } })).toBeNull();
	expect(await send("take-profile-invite", netflix)).toBe("abc");
	expect(await send("take-profile-invite", netflix)).toBeNull();
	tab.url = "https://www.disneyplus.com/home";
	await send("open", popup, "netflix");
	expect(create).toHaveBeenLastCalledWith({ url: "https://www.netflix.com/browse", windowId: 1, active: false });
});

type TestTab = { id: number; url: string; windowId: number; pendingUrl?: string };

function browser(provider: RoomLobbyProvider, foregroundUrl: string, backgroundUrls: string[]) {
	const tabs = [foregroundUrl, ...backgroundUrls].map((url, id): TestTab => ({ url, id: id + 1, windowId: 8 }));
	let active = tabs[0]!;
	let listener: Function;
	const stored: Record<string, unknown> = {};
	const create = vi.fn(async (options: chrome.tabs.CreateProperties) => {
		const tab = { id: tabs.length + 1, url: options.url!, windowId: options.windowId! };
		tabs.push(tab);
		return tab;
	});
	const query = vi.fn(async (options: chrome.tabs.QueryInfo) => options.active ? [active] : tabs);
	const update = vi.fn(async (id: number, options: chrome.tabs.UpdateProperties) => {
		active = tabs.find(tab => tab.id === id)!;
		if (options.url) active.url = options.url;
		return active;
	});
	vi.stubGlobal("chrome", {
		runtime: {
			id: "ext", getURL: (path: string) => "chrome-extension://ext/" + path,
			sendMessage: async () => null,
			onMessage: { addListener: (fn: Function) => { listener = fn; } },
		},
		tabs: { query, get: async (id: number) => tabs.find(tab => tab.id === id), create, update, sendMessage: vi.fn(async () => null) },
		storage: { session: {
			get: async () => stored,
			set: async (value: object) => Object.assign(stored, value),
			remove: async (key: string) => { delete stored[key]; },
		} },
	});
	registerPopupRoomLaunch();
	function send(action: string, sender: object) {
		return new Promise<unknown>(resolve => {
			const handled = listener({ type: ROOM_LAUNCH_MESSAGE, action, provider, owner: "owner" }, sender, resolve);
			if (!handled) resolve(undefined);
		});
	}
	return {
		tabs, create, update, query, active: () => active, focus: (tab: TestTab) => { active = tab; },
		open: () => send("open", { id: "ext", url: "chrome-extension://ext/popup.html" }),
		claim: (tab: TestTab) => send("claim", { id: "ext", tab, url: tab.url, frameId: 0 }),
	};
}

const titles = {
	disneyplus: "https://www.disneyplus.com/pt-br/play/b39aa967-2703-452d-bf62-d941d9d799fd",
	netflix: "https://www.netflix.com/watch/80025313",
	primevideo: "https://www.amazon.com/gp/video/detail/B0HCJ112J8",
	hbomax: "https://play.max.com/br/pt/video/watch/4d269596-6871-4419-892a-ca2b801d447d",
	crunchyroll: "https://www.crunchyroll.com/fr/watch/G14U4J9MP/example",
	youtube: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
} satisfies Record<RoomLobbyProvider, string>;

it.each(Object.keys(titles) as RoomLobbyProvider[])("creates on a fresh %s home or the foreground platform tab only", async provider => {
	const home = ROOM_LOBBY_HOME[provider];
	const { tabs, create, open, active, claim, focus, query } = browser(provider, "chrome://newtab/", [
		home, titles[provider], "https://www.youtube.com/shorts/abcdefghijk", "https://example.org/",
		provider === "netflix" ? ROOM_LOBBY_HOME.disneyplus : ROOM_LOBBY_HOME.netflix,
	]);
	for (const start of [tabs[0]!, tabs[4]!, tabs[5]!]) {
		focus(start);
		const count = tabs.length;
		expect(await open()).toEqual({ ok: true });
		expect(tabs).toHaveLength(count + 1);
		expect(active()).toMatchObject({ url: home, windowId: start.windowId });
		expect(await claim(tabs[1]!)).toBeNull();
		expect(await claim(active())).toMatchObject({ provider, owner: "owner" });
	}
	for (const target of [tabs[1]!, tabs[2]!]) {
		focus(target);
		await open();
		await open();
		expect(active()).toBe(target);
		expect(await claim(target)).toMatchObject({ provider, owner: "owner" });
		expect(await claim(target)).toBeNull();
	}
	// A previous unclaimed request must not take focus from the current video.
	focus(tabs[1]!);
	await open();
	focus(tabs[2]!);
	await open();
	expect(active()).toBe(tabs[2]);
	expect(await claim(tabs[1]!)).toBeNull();
	expect(await claim(active())).toMatchObject({ provider });
	expect(create).toHaveBeenCalledTimes(3);
	expect(query.mock.calls.every(([options]) => options.active && options.lastFocusedWindow)).toBe(true);
});

it("starts a YouTube lobby in the same tab when invoked on Shorts", async () => {
	const shorts = "https://www.youtube.com/shorts/abcdefghijk";
	const { open, active, create, claim, update } = browser("youtube", shorts, [titles.youtube]);
	await open();
	expect(update).toHaveBeenCalledWith(1, { url: ROOM_LOBBY_HOME.youtube, active: true });
	expect(create).not.toHaveBeenCalled();
	const current = active();
	current.url = shorts;
	current.pendingUrl = ROOM_LOBBY_HOME.youtube;
	expect(await claim(current)).toBeNull();
	current.url = ROOM_LOBBY_HOME.youtube;
	delete current.pendingUrl;
	expect(await claim(current)).toMatchObject({ provider: "youtube" });
});
