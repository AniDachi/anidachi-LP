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
vi.mock("../src/prime-room-background", () => ({ isAttachedPrimePlayerDocument: vi.fn() }));
import { registerPrimeLaunchBridge } from "../src/prime-launch-background";
import * as sessions from "../src/room-session-storage";
import * as primeTransport from "../src/prime-room-background";
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
it.each([
	["primevideo.com", "/region/na/storefront", "/region/na/detail/0ONGKHWBI6Y2CABWUR56DP08PM"],
	["www.amazon.com", "/Amazon-Video/b", "/gp/video/detail/B0HCJ112J8"],
	["www.amazon.co.uk", "/gp/video/storefront", "/dp/B0HCJ112J8"],
	["video.amazon.de", "/-/de/Amazon-Video/b", "/-/de/gp/video/detail/B0HCJ112J8"],
	["www.amazon.co.jp", "/gp/video/storefront", "/gp/video/detail/B0HCJ112J8"],
	["www.amazon.ca", "/gp/video/storefront", "/gp/video/detail/B0HCJ112J8"],
	["www.amazon.in", "/gp/video/storefront", "/gp/video/detail/B0HCJ112J8"],
	["www.amazon.com.mx", "/gp/video/storefront", "/gp/video/detail/B0HCJ112J8"],
])("uses the current %s tab for admission and the player's episode for recovery", async (host, catalog, detail) => {
	const origin = "https://" + host;
	const provider = { id: ext, origin, frameId: 0, url: origin + catalog, tab: { id: 7, url: origin + detail } };
	const recover = { type: "ANIDACHI_PRIME_LAUNCH", action: "recover", contentId: id };
	expect(await send(recover, provider)).toEqual({ status: "empty" });
	await send({ ...recover, action: "start", roomId: "room", newTab: true });
	const recovered = await send(recover, provider);
	expect(recovered).toMatchObject({ status: "ready", pending: { contentId: id, roomId: "room" } });
	expect(await send({ ...recover, action: "take", intentId: recovered.pending.intentId }, provider)).toMatchObject({ status: "ready" });
});
it("rejects a stale detail after navigation away and mismatched document origins", async () => {
	const origin = "https://www.primevideo.com";
	const detail = origin + "/detail/" + id;
	const sender = { id: ext, url: detail, origin, frameId: 0, tab: { id: 7, url: detail } };
	const recover = { type: "ANIDACHI_PRIME_LAUNCH", action: "recover", contentId: id };
	for (const invalid of [
		{ ...sender, tab: { id: 7, url: origin + "/storefront" } },
		{ ...sender, url: "https://www.amazon.de/gp/video/storefront" },
		{ ...sender, origin: "null" },
		{ ...sender, frameId: 1 },
	]) expect(await send(recover, invalid)).toEqual({ status: "cancelled" });
});
it("follows the exact live guest session without generating an invitation or writing history", async () => {
	const url = "https://www.primevideo.com/region/na/storefront";
	const tab = { id: ext, url, origin: new URL(url).origin, frameId: 0, documentId: "guest-document", tab: { id: 7, url } };
	const visit = crypto.randomUUID();
	const request = { type: "ANIDACHI_PRIME_LAUNCH", action: "follow", contentId: id, roomId: "watch", visit };
	const record = {version:1 as const, revision:1, roomId:"watch", ownerUserId:state.owner, participantSessionId:"mine", cameraEnabled:false, voiceMode:"push-to-talk" as const};
	const sessionForTab = vi.spyOn(sessions, "loadRoomSessionForTab").mockResolvedValue(null);
	const claim = vi.fn().mockResolvedValue(null);
	const update = vi.fn();
	Object.assign(chrome.runtime, {sendMessage: claim});
	Object.assign(chrome.tabs, {get: async () => tab.tab, update});
	try {
		expect(await send(request, tab)).toMatchObject({status:"cancelled"});
		sessionForTab.mockResolvedValue(record);
		expect(await send({...request,roomId:"other"},tab)).toMatchObject({status:"cancelled"});
		expect(await send(request,{...tab,frameId:1})).toMatchObject({status:"cancelled"});
		expect(claim).not.toHaveBeenCalled();
		expect(await send(request,tab)).toMatchObject({status:"cancelled"});
		expect(update).not.toHaveBeenCalled();
		claim.mockResolvedValue({source: {provider:"primevideo"}, receipt:"claim"});
		expect(await send(request,tab)).toMatchObject({status:"ready"});
		expect(claim).toHaveBeenLastCalledWith(expect.objectContaining({action:"follow",tabId:7,identity:{
			roomId:"watch", ownerUserId:state.owner, participantSessionId:"mine"},documentId:"guest-document",contentId:id,visit}));
		expect(update).toHaveBeenCalledExactlyOnceWith(7,{url:`https://www.primevideo.com/detail/${id}?autoplay=1`});
		expect(session).toEqual({});
		claim.mockResolvedValue({ source: {provider: "primevideo", primeNavigation: {contentId: id, routes: [{
			url: "https://www.amazon.de/-/en/dp/B0HCJ112J8", observedAt: new Date().toISOString(),
		}]}}, receipt: "claim" });
		expect(await send(request,tab)).toMatchObject({status: "ready"});
		expect(update).toHaveBeenLastCalledWith(7,{url:"https://www.amazon.de/-/en/gp/video/detail/B0HCJ112J8?autoplay=1"});
		const dp = "https://www.amazon.de/dp/B0HCJ112J8";
		const dpSender = { ...tab, origin: new URL(dp).origin, url: dp, tab: {id: 7, url: dp} };
		Object.assign(chrome.tabs, { get: async () => dpSender.tab });
		const proof = vi.spyOn(primeTransport, "isAttachedPrimePlayerDocument").mockResolvedValue(false);
		try {
			expect(await send(request, dpSender)).toMatchObject({status: "cancelled"});
			proof.mockResolvedValue(true);
			expect(await send(request, dpSender)).toMatchObject({status: "ready"});
			expect(proof).toHaveBeenCalledWith(dpSender.tab, expect.objectContaining({roomId:"watch"}), dpSender.documentId);
		} finally { proof.mockRestore(); }
		Object.assign(chrome.tabs, { get: async () => tab.tab });
		update.mockRejectedValueOnce(new Error("navigation failed"));
		expect(await send(request,tab)).toMatchObject({status:"retryable"});
		expect(claim).toHaveBeenLastCalledWith(expect.objectContaining({action:"cancel-follow",receipt:"claim"}));
	} finally { sessionForTab.mockRestore(); }
});
it.each([
	["netflix", "/browse", "456", "/watch/456"],
	["crunchyroll", "/es-ES/videos/popular", "G_EP-456", "/es-ES/watch/G_EP-456"],
])("follows a %s catalog guest to the verified episode only while still browsing", async (provider, catalog, id, destination) => {
	const origin = "https://www." + provider + ".com";
	const url = origin + catalog;
	const sender = {id: ext, url, origin, frameId: 0, documentId:"guest-doc", tab:{id:7, url}};
	const request = {type:"ANIDACHI_PRIME_LAUNCH", action:"follow", contentId:id, roomId:"room", visit:crypto.randomUUID()};
	const record = {version:1 as const, revision:1, roomId:"room", ownerUserId:state.owner, participantSessionId:"mine", cameraEnabled:false, voiceMode:"push-to-talk" as const};
	const sessionForTab = vi.spyOn(sessions, "loadRoomSessionForTab").mockResolvedValue(record);
	const target = origin + "/watch/" + id;
	const claim = vi.fn().mockResolvedValue({source:{provider,sourceUrl:target},receipt:"receipt"});
	const update = vi.fn();
	const get = vi.fn().mockResolvedValue(sender.tab);
	Object.assign(chrome.runtime, {sendMessage:claim});
	Object.assign(chrome.tabs, {get, update});
	try {
		expect(await send(request,sender)).toMatchObject({status:"ready"});
		expect(update).toHaveBeenCalledExactlyOnceWith(7,{url:origin + destination});
		for (const next of [origin + "/watch/789", origin + "/account", "https://www.primevideo.com/storefront"]) {
			get.mockResolvedValue({id:7,url:next});
			expect(await send(request,sender)).toMatchObject({status:"cancelled"});
			expect(claim).toHaveBeenLastCalledWith(expect.objectContaining({action:"cancel-follow", receipt:"receipt"}));
		}
		expect(update).toHaveBeenCalledTimes(1);
	} finally {sessionForTab.mockRestore();}
});
it("distinguishes a temporary recovery storage failure from a refused launch", async () => {
	const provider = { id: ext, frameId: 0, url: "https://www.primevideo.com/detail/" + id, tab: { id: 7 } };
	const recover = { type: "ANIDACHI_PRIME_LAUNCH", action: "recover", contentId: id };
	const get = vi.spyOn(chrome.storage.session, "get").mockRejectedValueOnce(new Error("Storage unavailable"));
	try {
		expect(await send(recover, provider)).toEqual({ status: "retryable" });
		expect(await send(recover, provider)).toEqual({ status: "empty" });
	} finally { get.mockRestore(); }
});
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
it("captures only the current tab's room identity for early player close", async () => {
	const provider = { id: ext, tab: { id: 7 }, frameId: 0, url: amazonUrl };
	const receipt = { type: "ANIDACHI_PRIME_LAUNCH", action: "pending-room" };
	const start = { type: "ANIDACHI_PRIME_LAUNCH", action: "start", contentId: id, roomId: "room-a", newTab: true };
	expect(await send(receipt, provider)).toEqual({ status: "empty" });
	await send(start);
	const first = await send(receipt, provider);
	expect(first).toEqual({ status: "ready", intentId: expect.any(String), contentId: id });
	expect(await send(receipt, { ...provider, tab: { id: 8 } })).toEqual({ status: "empty" });
	expect(await send(receipt, { ...provider, frameId: 1 })).toEqual({ status: "cancelled" });
	expect(await send(receipt, { ...provider, url: "https://staging.anidachi.app/room/a/launch" }, true)).toEqual({ status: "cancelled" });
	await send({ ...start, roomId: "room-b" });
	await send({ type: receipt.type, action: "take", contentId: id, intentId: first.intentId }, provider);
	const next = await send(receipt, provider);
	expect(next.status).toBe("ready");
	expect(next.intentId).not.toBe(first.intentId);
	state.login = "different-login";
	expect(await send(receipt, provider)).toEqual({ status: "empty" });
});
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
		tab: { id: 7, url: `https://www.primevideo.com/detail/${id}` },
		frameId: 0,
		url: "https://www.primevideo.com/region/na/storefront",
	};
	expect(await send({ type: "ANIDACHI_PRIME_LAUNCH", action: "pending-room" }, redirected)).toEqual({ status: "empty" });
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
