import { beforeEach, afterEach, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({
	owner: "owner",
	login: "login",
	generation: 3,
}));
vi.mock("../src/auth-tokens", () => ({
	getStoredAuthTokens: async () => ({
		user: { id: state.owner },
		authSessionId: state.login,
	}),
}));
vi.mock("../src/watch-history-storage", () => ({
	createWatchHistoryStorage: () => ({
		readRoot: async () => ({
			activeGenerations: { [state.owner]: state.generation },
		}),
	}),
}));
vi.mock("../src/constants", () => ({
	WEB_HTTP_BASE: "https://staging.anidachi.app",
}));
import { registerPrimeLaunchBridge } from "../src/prime-launch-background";
const id = "0IUGS56V361WRU60PCC5XH5D8Z",
	ext = "a".repeat(32);
let listeners: Function[],
	external: Function[],
	session: Record<string, unknown>,
	local: Record<string, unknown>,
	navigations: string[];
const sender = { id: ext, url: `chrome-extension://${ext}/popup.html` };
function send(
	message: unknown,
	from: unknown = sender,
	outside = false,
): Promise<any> {
	return new Promise((resolve) => {
		(outside ? external : listeners)[0]!(message, from, resolve);
	});
}
beforeEach(() => {
	state.owner = "owner";
	state.login = "login";
	state.generation = 3;
	listeners = [];
	external = [];
	session = {};
	local = {};
	navigations = [];
	vi.stubGlobal("chrome", {
		runtime: {
			id: ext,
			getURL: (path: string) =>
				`chrome-extension://${ext}/${path.replace(/^\//, "")}`,
			onMessage: { addListener: (f: Function) => listeners.push(f) },
			onMessageExternal: { addListener: (f: Function) => external.push(f) },
		},
		storage: {
			session: {
				get: async (key: string) => ({ [key]: session[key] }),
				set: async (value: object) =>
					Object.assign(session, structuredClone(value)),
				remove: async (key: string) => {
					delete session[key];
				},
			},
			local: {
				get: async (key: string) => ({ [key]: local[key] }),
				set: async (value: object) =>
					Object.assign(local, structuredClone(value)),
			},
		},
		tabs: {
			create: async ({ url }: { url: string }) => {
				expect(url).toBe("about:blank");
				return { id: 7 };
			},
			update: async (tab: number, { url }: { url: string }) => {
				expect(
					(session["anidachi.primePending.v1"] as any)?.[tab],
				).toBeDefined();
				navigations.push(url);
			},
			onRemoved: { addListener: () => {} },
		},
	});
	registerPrimeLaunchBridge();
});
afterEach(() => vi.unstubAllGlobals());
it("registers room intent before new-tab navigation and survives missing fragment with one-use binding", async () => {
	expect(
		await send({
			type: "ANIDACHI_PRIME_LAUNCH",
			action: "start",
			contentId: id,
			roomId: "room",
			newTab: true,
		}),
	).toMatchObject({ status: "ready" });
	expect(navigations[0]).toBe(
		`https://www.primevideo.com/detail/${id}?autoplay=1#anidachiRoom=room`,
	);
	const provider = {
		id: ext,
		tab: { id: 7 },
		frameId: 0,
		url: "https://www.amazon.com/gp/video/detail/B0FX2ZCPFK",
	};
	const message = {
		type: "ANIDACHI_PRIME_LAUNCH",
		action: "take",
		contentId: id,
        intentId:(session["anidachi.primePending.v1"] as any)[7].intentId,
	};
	expect(await send(message, { ...provider, frameId: 1 })).toEqual({
		status: "cancelled",
	});
	expect(await send({...message,action:"recover",intentId:undefined},provider)).toEqual({status:"cancelled"});
 const recovering={type:"ANIDACHI_PRIME_LAUNCH",action:"recover",contentId:id};
 expect(await send(recovering,provider)).toMatchObject({status:"ready"});
 expect(await send(recovering,provider)).toMatchObject({status:"ready"});
 expect(await send(message, provider)).toMatchObject({
		status: "ready",
		pending: { roomId: "room", contentId: id },
	});
	expect(await send(message, provider)).toMatchObject({ status: "blocked" });
});
it("offers exact host and canonical choices for first guest and never guesses preferred foreign route", async () => {
	local["anidachi.primeMarketplace.v1"] = { owner: "amazon.de" };
	await send({
		type: "ANIDACHI_PRIME_LAUNCH",
		action: "start",
		contentId: id,
		roomId: "room",
		newTab: true,
		navigation: {
			contentId: id,
			routes: [
				{
					url: "https://www.amazon.com/gp/video/detail/B0FX2ZCPFK",
					observedAt: "2026-11-16T00:00:00Z",
				},
			],
		},
	});
	expect(navigations).toEqual([`chrome-extension://${ext}/prime-launch.html`]);
	const ui = {
		id: ext,
		tab: { id: 7 },
		frameId: 0,
		url: `chrome-extension://${ext}/prime-launch.html`,
	};
	const read = await send(
		{ type: "ANIDACHI_PRIME_LAUNCH", action: "read" },
		ui,
	);
	expect(read.resolution.status).toBe("regional-route-unknown");
	const choice = {
		type: "ANIDACHI_PRIME_LAUNCH",
		action: "choose",
		intentId: read.pending.intentId,
		marketplace: "amazon.de",
		manual: true,
	};
	expect(await send(choice, ui)).toEqual({ status: "ready" });
	expect(navigations.at(-1)).toBe("https://www.amazon.de/");
	state.generation++;
	expect(
		await send(
			{ type: "ANIDACHI_PRIME_LAUNCH", action: "recover", contentId: id },
			{
				id: ext,
				tab: { id: 7 },
				frameId: 0,
				url: "https://www.amazon.de/gp/video/detail/B0FX2ZCPFK",
			},
		),
	).toMatchObject({ status: "blocked" });
});
it("rejects untrusted external and stale-owner requests without navigation", async () => {
	const request = {
		type: "ANIDACHI_PRIME_LAUNCH",
		action: "start",
		contentId: id,
		roomId: "room",
		expectedOwnerUserId: "other",
	};
	expect(
		await send(
			request,
			{ url: "https://evil.example", tab: { id: 4 }, frameId: 0 },
			true,
		),
	).toEqual({ status: "cancelled" });
	expect(
		await send(
			request,
			{
				url: "https://staging.anidachi.app/room/room/launch",
				tab: { id: 4 },
				frameId: 0,
			},
			true,
		),
	).toEqual({ status: "cancelled" });
	expect(navigations).toEqual([]);
});
it("trusted website preparation never navigates until a matching current intent is committed", async () => {
	const from = {
		url: "https://staging.anidachi.app/room/room/launch",
		tab: { id: 4 },
		frameId: 0,
	};
	const input = {
		type: "ANIDACHI_PRIME_LAUNCH",
		action: "start",
		contentId: id,
		roomId: "room",
		expectedOwnerUserId: "owner",
	};
	const first = await send(input, from, true);
	expect(first.status).toBe("prepared");
	expect(navigations).toEqual([]);
	const second = await send(input, from, true);
	expect(
		await send(
			{
				type: "ANIDACHI_PRIME_LAUNCH",
				action: "commit",
				intentId: first.intentId,
				expectedOwnerUserId: "owner",
			},
			from,
			true,
		),
	).toEqual({ status: "cancelled" });
	expect(
		await send(
			{
				type: "ANIDACHI_PRIME_LAUNCH",
				action: "commit",
				intentId: second.intentId,
				expectedOwnerUserId: "owner",
			},
			from,
			true,
		),
	).toMatchObject({ status: "ready" });
});
