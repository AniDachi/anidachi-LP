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
		intentId: (session["anidachi.primePending.v1"] as any)[7].intentId,
	};
	expect(await send(message, { ...provider, frameId: 1 })).toEqual({
		status: "cancelled",
	});
	expect(
		await send(
			{ ...message, action: "recover", intentId: undefined },
			provider,
		),
	).toEqual({ status: "cancelled" });
	const recovering = {
		type: "ANIDACHI_PRIME_LAUNCH",
		action: "recover",
		contentId: id,
	};
	expect(await send(recovering, provider)).toMatchObject({ status: "ready" });
	expect(await send(recovering, provider)).toMatchObject({ status: "ready" });
	expect(await send(message, provider)).toMatchObject({
		status: "ready",
		pending: { roomId: "room", contentId: id },
	});
	expect(await send(message, provider)).toMatchObject({ status: "blocked" });
});
const amazonUrl = "https://www.amazon.com/-/de/gp/video/detail/B0FX2ZCPFK";
const navigation = {
	contentId: id,
	routes: [
		{
			url: amazonUrl,
			observedAt: "2026-11-16T00:00:00Z",
		},
	],
};
const legacyUi = {
	id: ext,
	tab: { id: 7 },
	frameId: 0,
	url: `chrome-extension://${ext}/prime-launch.html`,
};
it("opens the supplied episode directly, ignoring the old preference and current provider origin", async () => {
	local["anidachi.primeMarketplace.v1"] = { owner: "amazon.de" };
	const result = await send(
		{
			type: "ANIDACHI_PRIME_LAUNCH",
			action: "start",
			contentId: id,
			roomId: "room",
			navigation,
			currentVerifiedOrigin: "https://www.amazon.de",
		},
		{
			id: ext,
			tab: { id: 7 },
			frameId: 0,
			url: "https://www.amazon.de/gp/video/detail/B0FX2ZCPFK",
		},
	);
	expect(result.status).toBe("ready");
	expect(navigations).toEqual([`${amazonUrl}?autoplay=1#anidachiRoom=room`]);
	expect(local).toEqual({
		"anidachi.primeMarketplace.v1": { owner: "amazon.de" },
	});
	// Amazon can redirect or strip the fragment; SDK content binding still gates recovery.
	const redirected = {
		id: ext,
		tab: { id: 7 },
		frameId: 0,
		url: `https://www.primevideo.com/region/na/detail/${id}`,
	};
	expect(
		await send(
			{ type: "ANIDACHI_PRIME_LAUNCH", action: "recover", contentId: id },
			redirected,
		),
	).toMatchObject({ status: "ready", pending: { roomId: "room" } });
	state.generation++;
	expect(
		await send(
			{ type: "ANIDACHI_PRIME_LAUNCH", action: "recover", contentId: id },
			redirected,
		),
	).toMatchObject({ status: "blocked" });
});
it("automatically resumes an unexpired old launch tab once without accepting a destination choice", async () => {
	await send({
		type: "ANIDACHI_PRIME_LAUNCH",
		action: "start",
		contentId: id,
		roomId: "room",
		navigation,
		newTab: true,
		prepareOnly: true,
	});
	expect(
		await send({ type: "ANIDACHI_PRIME_LAUNCH", action: "read" }, legacyUi),
	).toMatchObject({ status: "ready" });
	expect(navigations).toEqual([`${amazonUrl}?autoplay=1#anidachiRoom=room`]);
	expect(
		await send({ type: "ANIDACHI_PRIME_LAUNCH", action: "read" }, legacyUi),
	).toEqual({ status: "cancelled" });
	expect(
		await send(
			{
				type: "ANIDACHI_PRIME_LAUNCH",
				action: "choose",
				intentId: (session["anidachi.primePending.v1"] as any)[7].intentId,
				marketplace: "amazon.de",
				url: "https://www.amazon.de/",
				manual: true,
			},
			legacyUi,
		),
	).toEqual({ status: "cancelled" });
	expect(navigations).toHaveLength(1);
	expect(local).toEqual({});
});
it.each([
	"expired",
	"owner",
	"login",
	"generation",
])("does not restart a %s legacy launch", async (reason) => {
	await send({
		type: "ANIDACHI_PRIME_LAUNCH",
		action: "start",
		contentId: id,
		roomId: "room",
		navigation,
		newTab: true,
		prepareOnly: true,
	});
	if (reason === "expired")
		(session["anidachi.primePending.v1"] as any)[7].expiresAt = Date.now() - 1;
	else if (reason === "owner") state.owner = "other";
	else if (reason === "login") state.login = "other";
	else state.generation++;
	expect(
		await send({ type: "ANIDACHI_PRIME_LAUNCH", action: "read" }, legacyUi),
	).toEqual({ status: "expired" });
	expect(navigations).toEqual([]);
});
it("preserves personal Resume intent and position through a direct Amazon launch and redirect", async () => {
	const { personalHistoryResumeOwnerBinding, primeVideoSourceUrl } =
		await import("@anidachi/protocol");
	const intentId = crypto.randomUUID();
	const resume = {
		resumeVersion: 1,
		intentId,
		ownerBinding: await personalHistoryResumeOwnerBinding("owner", intentId),
		accountGeneration: 3,
		provider: "primevideo",
		sourceUrl: primeVideoSourceUrl(id),
		currentTime: 126,
		issuedAt: Date.now(),
		expiresAt: Date.now() + 60000,
	};
	const result = await send({
		type: "ANIDACHI_PRIME_LAUNCH",
		action: "start",
		contentId: id,
		resume,
		navigation,
		newTab: true,
		expectedOwnerUserId: "owner",
	});
	expect(result.status).toBe("ready");
	const destination = new URL(navigations[0]!);
	expect(`${destination.origin}${destination.pathname}`).toBe(amazonUrl);
	expect(
		JSON.parse(
			new URLSearchParams(destination.hash.slice(1)).get("anidachiResume")!,
		),
	).toEqual(resume);
	const redirected = {
		id: ext,
		tab: { id: 7 },
		frameId: 0,
		url: `https://www.primevideo.com/detail/${id}`,
	};
	expect(
		await send(
			{
				type: "ANIDACHI_PRIME_LAUNCH",
				action: "take",
				contentId: id,
				intentId,
			},
			redirected,
		),
	).toMatchObject({ status: "ready", pending: { resume } });
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
it("trusted website commits only the current intent directly to its supplied route", async () => {
	local["anidachi.primeMarketplace.v1"] = { owner: "amazon.de" };
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
		navigation,
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
	expect(navigations).toEqual([`${amazonUrl}?autoplay=1#anidachiRoom=room`]);
});
