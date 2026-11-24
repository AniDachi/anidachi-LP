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
	expect(create).toHaveBeenCalledWith({ url: "https://www.disneyplus.com/home", active: false });
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
	expect(create).toHaveBeenLastCalledWith({ url: "https://www.netflix.com/browse", active: false });
	tab.url = "https://play.max.com/br/pt/home";
	expect((await send("state", popup)).here).toBe("hbomax");
	const activeElsewhere = { ...tab, id: 42, url: "https://example.test/" };
	query.mockImplementation(async options => options.active ? [activeElsewhere] : [tab]);
	await send("open", popup, "hbomax");
	expect(query).toHaveBeenCalledWith({ currentWindow: true, url: expect.arrayContaining(["https://play.max.com/*", "https://www.hbomax.com/*"]) });
	expect(update).toHaveBeenLastCalledWith(tab.id, { active: true });
	expect(await send("claim", { ...content, url: tab.url })).toMatchObject({ owner: "owner", provider: "hbomax" });
	tab.url = activeElsewhere.url;
	await send("open", popup, "hbomax");
	expect(create).toHaveBeenLastCalledWith({ url: "https://www.hbomax.com/home", active: false });
	tab.url = "https://www.crunchyroll.com/ru/discover";
	await send("open", popup, "crunchyroll");
	expect(query).toHaveBeenCalledWith({ currentWindow: true, url: expect.arrayContaining(["https://www.crunchyroll.com/*", "https://crunchyroll.com/*"]) });
	expect(update).toHaveBeenLastCalledWith(tab.id, { active: true });
	expect(await send("claim", { ...content, url: tab.url })).toMatchObject({ provider: "crunchyroll" });
	tab.url = activeElsewhere.url;
	await send("open", popup, "crunchyroll");
	expect(create).toHaveBeenLastCalledWith({ url: "https://www.crunchyroll.com/discover", active: false });
});
