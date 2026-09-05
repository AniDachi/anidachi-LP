import {
	type WatchHistoryBrowseQuery,
	WatchHistoryBrowseResponseSchema,
	WatchHistoryBrowseSessionsResponseSchema,
	WatchHistoryBrowseTitleEpisodesResponseSchema,
	type WatchHistorySession,
	type WatchProgressEvent,
} from "@anidachi/protocol";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePopupWatchBrowse } from "../src/popup-watch-browse";
import {
	type PopupWatchHistoryClient,
	PopupWatchHistoryPanel,
	selectConfirmedPopupWatchHistorySnapshot,
} from "../src/popup-watch-history";
import {
	createWatchHistoryClient,
	type WatchHistoryMessageResponse,
} from "../src/watch-history-client";
import {
	createWatchHistoryStorage,
	type WatchHistoryStorageRoot,
	watchHistoryPartitionKey,
} from "../src/watch-history-storage";

const OWNER = "00000000-0000-4000-8000-000000000001";
const GROUP = "00000000-0000-4000-8000-000000000003";
const PERSON = "00000000-0000-4000-8000-000000000004";
const meta = {
	schemaVersion: 3 as const,
	ownerUserId: OWNER,
	accountGeneration: 1,
	serverTime: "2026-09-05T08:00:00.000Z",
};
const aggregate = {
	completedEpisodes: 2,
	availableEpisodes: 12,
	progress: 2 / 12,
};
const episode = {
	episodeKey: "crunchyroll:episode:one",
	episodeTitle: "Matching episode",
	seasonKey: "season:one",
	seasonTitle: "Season 1",
	seasonNumber: 1,
	episodeNumber: 1,
	sourceUrl: "https://www.crunchyroll.com/watch/ONE",
	currentTime: 600,
	duration: 1200,
	progress: 0.5,
	completedAt: null,
	lastWatchedAt: meta.serverTime,
	sessions: [],
};
const item = {
	provider: "crunchyroll" as const,
	titleKey: "crunchyroll:title:one",
	title: "Frieren",
	itemKind: "series" as const,
	sourceUrl: episode.sourceUrl,
	artworkUrl: null,
	catalogState: "complete" as const,
	aggregate,
	observedEpisodeCount: 3,
	completedEpisodeCount: 2,
	episodePage: { complete: false, nextCursor: "canonical-eight" },
	seasons: [
		{
			seasonKey: "season:one",
			seasonTitle: "Season 1",
			seasonNumber: 1,
			order: 0,
			aggregate,
			episodes: [{ ...episode, episodeTitle: "Canonical nonmatch" }],
			nextEpisode: null,
		},
	],
	sessions: [],
	latestActivity: {
		episodeKey: episode.episodeKey,
		currentTime: 600,
		duration: 1200,
		progress: 0.5,
		completedAt: null,
		lastWatchedAt: meta.serverTime,
	},
	lastWatchedAt: meta.serverTime,
};
function browse(title = "Frieren", cursor: string | null = null) {
	return WatchHistoryBrowseResponseSchema.parse({
		history: {
			meta,
			generatedAt: meta.serverTime,
			items: [{ ...item, title }],
			totalTitleCount: 1,
			nextCursor: cursor,
		},
		matches: [
			{
				provider: item.provider,
				titleKey: item.titleKey,
				lastWatchedAt: "2026-09-01T08:00:00.000Z",
				matchingEpisodeCount: 1,
				matchingSessionCount: 0,
			},
		],
	});
}
function detail(cursor: string | null = null) {
	return WatchHistoryBrowseTitleEpisodesResponseSchema.parse({
		detail: {
			meta,
			generatedAt: meta.serverTime,
			provider: item.provider,
			titleKey: item.titleKey,
			observedEpisodeCount: 3,
			completedEpisodeCount: 2,
			episodes: [episode],
			catalog: {
				state: "complete",
				title: "Frieren",
				aggregate,
				seasons: [
					{
						seasonKey: "season:one",
						seasonTitle: "Season 1",
						seasonNumber: 1,
						order: 0,
						aggregate,
						nextEpisode: null,
					},
				],
			},
			complete: !cursor,
			nextCursor: cursor,
		},
		matches: [
			{
				episodeKey: episode.episodeKey,
				lastWatchedAt: meta.serverTime,
				matchingSessionCount: 0,
				sessionsComplete: true,
			},
		],
		groups: [],
	});
}
function clientFixture(
	request?: PopupWatchHistoryClient["request"],
): PopupWatchHistoryClient {
	return {
		loadCached: async () => null,
		confirmDiscard: vi.fn(() => true),
		openUrl: vi.fn(async () => undefined),
		request:
			request ??
			vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
				if (message.command === "browse") return { ok: true, data: browse() };
				if (message.command === "browse-title-episodes")
					return { ok: true, data: detail() };
				if (message.command === "browse-options")
					return {
						ok: true,
						data: {
							meta,
							options: [
								{ kind: "group", id: GROUP, label: "Friday crew" },
								{ kind: "participant", id: PERSON, label: "Mira" },
							],
							nextCursor: null,
						},
					};
				return { ok: true };
			}),
	};
}
function generationClient(fetch: typeof globalThis.fetch) {
	let stored: WatchHistoryStorageRoot = {
		schemaVersion: 3,
		activeGenerations: { [OWNER]: 1 },
		partitions: {
			[watchHistoryPartitionKey(OWNER, 1)]: {
				ownerUserId: OWNER,
				accountGeneration: 1,
				cache: browse().history,
				preferences: { youtubeHistoryEnabled: false },
				preferencesConfirmed: true,
				capturePaused: false,
				captureMarkersReady: true,
				currentObservation: null,
				outbox: { ownerUserId: OWNER, accountGeneration: 1, entries: [] },
			},
		},
	};
	const storage = createWatchHistoryStorage({
		item: {
			getValue: async () => structuredClone(stored),
			setValue: async (value) => {
				stored = structuredClone(value);
			},
		},
		getBytesInUse: async () => 0,
		quotaBytes: 1_000_000,
	});
	const background = createWatchHistoryClient({
		storage,
		fetch,
		getCurrentSession: async () => ({
			accessToken: "test",
			refreshToken: "test",
			user: {
				id: OWNER,
				email: "test@example.invalid",
				displayName: "Test",
				avatarUrl: null,
				plan: "plus",
			},
		}),
	});
	return {
		storage,
		client: {
			...clientFixture(),
			request: vi.fn(background.handle),
			loadBrowseCached: (message: Parameters<typeof background.handle>[0]) =>
				background.handle({ ...message, cacheOnly: true } as never),
			loadCached: async (owner: string) =>
				selectConfirmedPopupWatchHistorySnapshot(
					await storage.readRoot(),
					owner,
				),
		},
	};
}
(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
afterEach(async () => {
	if (root) await act(async () => root.unmount());
	container?.remove();
});
async function mount(client: PopupWatchHistoryClient) {
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	await act(async () =>
		root.render(<PopupWatchHistoryPanel client={client} ownerUserId={OWNER} />),
	);
	return container;
}
function required<T>(value: T | null | undefined): T {
	if (value === null || value === undefined)
		throw new Error("Required fixture value is missing");
	return value;
}
function button(name: string) {
	const found = [...container.querySelectorAll("button")].find(
		(node) =>
			node.getAttribute("aria-label") === name || node.textContent === name,
	);
	expect(found, name).toBeDefined();
	return required(found);
}
async function click(name: string) {
	await act(async () => button(name).click());
}
async function settles(assertion: () => void) {
	for (let attempt = 0; attempt < 100; attempt++) {
		// WebCrypto and extension storage cross task boundaries, not only React's
		// microtask queue. Wait for the observable result, not a fixed network delay.
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 5));
		});
		try {
			assertion();
			return;
		} catch (error) {
			if (attempt === 99) throw error;
		}
	}
}
async function change(label: string, value: string) {
	const node = container.querySelector(
		`[aria-label="${label}"]`,
	) as HTMLInputElement;
	expect(node, label).not.toBeNull();
	await act(async () => {
		const proto =
			node.tagName === "SELECT"
				? HTMLSelectElement.prototype
				: HTMLInputElement.prototype;
		required(Object.getOwnPropertyDescriptor(proto, "value")?.set).call(
			node,
			value,
		);
		node.dispatchEvent(
			new Event(node.tagName === "SELECT" ? "change" : "input", {
				bubbles: true,
			}),
		);
	});
}

describe("production watch browsing", () => {
	it("keeps both saved modes and their episodes visible while progress revalidation is blocked", async () => {
		let blocked = false;
		const requests: string[] = [];
		const setup = generationClient(async (url) => {
			requests.push(String(url));
			if (blocked) return new Promise<Response>(() => {});
			return Response.json({
				...browse(
					String(url).includes("mode=shared") ? "Saved together" : "Saved mine",
				),
				episodePreviews: [detail()],
			});
		});
		let publish:
			| Parameters<NonNullable<PopupWatchHistoryClient["subscribe"]>>[1]
			| undefined;
		const client = {
			...setup.client,
			subscribe: (_owner: string, listener: NonNullable<typeof publish>) => {
				publish = listener;
				return () => {};
			},
		};
		await mount(client);
		await settles(() =>
			expect(container.textContent).toContain("Matching episode"),
		);
		await click("Together");
		await settles(() =>
			expect(container.textContent).toContain("Saved together"),
		);
		await setup.storage.updateRoot((stored) => ({
			...stored,
			partitions: {
				...stored.partitions,
				[watchHistoryPartitionKey(OWNER, 1)]: {
					...required(stored.partitions[watchHistoryPartitionKey(OWNER, 1)]),
					invalidationRevision: 1,
					browseInvalidationRevision: 0,
					browseRevisionFloor: 0,
					browseTitleRevisions: { '["youtube","new"]': 1 },
				},
			},
		}));
		blocked = true;
		await act(async () =>
			required(publish)(await client.loadCached(OWNER), { ok: true }),
		);
		expect(container.textContent).toContain("Saved together");
		await click("Mine");
		await settles(() => expect(container.textContent).toContain("Saved mine"));
		expect(container.textContent).toContain("Matching episode");
		await act(async () => root.unmount());
		container.remove();
		await mount(client);
		await settles(() => expect(container.textContent).toContain("Saved mine"));
		expect(container.textContent).toContain("Matching episode");
		expect(requests.some((url) => url.includes("title-episodes"))).toBe(false);
	});
	it("shows a newly observed shared title as pending without guessing confirmed sessions", async () => {
		const event: WatchProgressEvent = {
			schemaVersion: 3,
			clientEventId: GROUP,
			clientSessionKey: "current-session",
			accountGeneration: 1,
			provider: "youtube",
			youtubeVideoId: "new",
			titleKey: "youtube:video:new",
			itemKind: "movie",
			title: "New shared video",
			artworkUrl: null,
			episodeKey: "youtube:video:new",
			episodeTitle: "New shared video",
			seasonKey: null,
			seasonTitle: null,
			seasonNumber: null,
			episodeNumber: null,
			sourceUrl: "https://www.youtube.com/watch?v=new",
			currentTime: 12,
			duration: 120,
			progress: 0.1,
			observedAt: meta.serverTime,
			kind: "heartbeat",
		};
		const empty = browse();
		empty.history.items = [];
		empty.matches = [];
		const client = {
			...clientFixture(async (message) =>
				message.command === "browse" ? { ok: true, data: empty } : { ok: true },
			),
			loadCached: async () => ({
				history: empty.history,
				accountGeneration: 1,
				preferences: { youtubeHistoryEnabled: true },
				pendingEvents: [],
				capturePaused: false,
				localObservation: { event, mode: "together" as const },
			}),
		};
		await mount(client);
		expect(container.textContent).not.toContain("New shared video");
		await click("Together");
		expect(container.textContent).toContain("New shared video");
		expect(container.textContent).toContain("Pending sync");
		expect(container.textContent).not.toContain("Watch together again");
	});
	it.each([
		"Mine",
		"Together",
	])("renders %s preview episodes without a detail request and continues only on demand", async (mode) => {
		const response = {
			...browse(),
			episodePreviews: [detail("next-preview-episodes")],
		};
		const requests: string[] = [];
		const client = clientFixture(async (message) => {
			if (message.command === "browse") return { ok: true, data: response };
			if (message.command === "browse-title-episodes") {
				requests.push(JSON.stringify(message.input));
				const more = detail();
				more.detail.episodes = [
					{
						...episode,
						episodeKey: "older",
						episodeTitle: "Older matching episode",
						episodeNumber: 2,
					},
				];
				more.matches = [{ ...required(more.matches[0]), episodeKey: "older" }];
				return { ok: true, data: more };
			}
			return { ok: true };
		});
		await mount(client);
		if (mode === "Together") await click("Together");
		expect(container.textContent).toContain("Matching episode");
		expect(container.textContent).not.toContain("Canonical nonmatch");
		expect(requests).toHaveLength(0);
		await click("Load more episodes for Frieren");
		expect(requests).toHaveLength(1);
		expect(JSON.parse(required(requests[0]))).toMatchObject({
			mode: mode === "Mine" ? "solo" : "shared",
			cursor: "next-preview-episodes",
		});
		expect(container.textContent).toContain("Matching episode");
		expect(container.textContent).toContain("Older matching episode");
	});
	it("replaces a stale provisional continuation instead of keeping deleted rows or an extra page", async () => {
		let finish: ((value: WatchHistoryMessageResponse) => void) | undefined;
		const stale = browse("Removed title");
		const empty = browse();
		empty.history.items = [];
		empty.matches = [];
		const client = {
			...clientFixture(async (message) =>
				"input" in message && (message.input as { cursor?: string })?.cursor
					? new Promise<WatchHistoryMessageResponse>((resolve) => {
							finish = resolve;
						})
					: { ok: true, data: browse("First page", "second") },
			),
			loadBrowseCached: async (message: {
				input: unknown;
			}): Promise<WatchHistoryMessageResponse> =>
				(message.input as { cursor?: string }).cursor
					? { ok: true, data: stale, cachedAt: Date.now() - 31_000 }
					: { ok: true },
		};
		function Harness() {
			const result = usePopupWatchBrowse({
				client,
				message: {
					type: "ANIDACHI_WATCH_HISTORY_V3",
					command: "browse",
					expectedOwnerUserId: OWNER,
					input: { mode: "solo" },
				},
				parser: WatchHistoryBrowseResponseSchema,
				meta: (data) => data.history.meta,
				cursor: (data) => data.history.nextCursor,
				refresh: 0,
				generation: 1,
			});
			return (
				<>
					<div data-pages={result.pages.length}>
						{result.pages
							.flatMap((page) => page.history.items.map((item) => item.title))
							.join(",")}
					</div>
					<button onClick={result.loadMore}>More</button>
				</>
			);
		}
		container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
		await act(async () => root.render(<Harness />));
		await click("More");
		expect(container.textContent).toContain("Removed title");
		await act(async () => required(finish)({ ok: true, data: empty }));
		expect(
			container.querySelector("[data-pages]")?.getAttribute("data-pages"),
		).toBe("2");
		expect(container.textContent).not.toContain("Removed title");
	});
	it("reuses Mine and Together on return and popup remount without another HTTP round trip", async () => {
		const fetch = vi.fn(async (raw: string | URL | Request) => {
			const url = String(raw);
			return Response.json(
				url.includes("title-episodes")
					? detail()
					: browse(url.includes("mode=shared") ? "Shared title" : "My title"),
			);
		});
		const { client } = generationClient(fetch);
		await mount(client);
		await settles(() => expect(container.textContent).toContain("My title"));
		await settles(() =>
			expect(container.textContent).toContain("Matching episode"),
		);
		await click("Together");
		await settles(() =>
			expect(container.textContent).toContain("Shared title"),
		);
		await settles(() =>
			expect(container.textContent).toContain("Matching episode"),
		);
		const count = fetch.mock.calls.length;
		await click("Mine");
		await settles(() => expect(container.textContent).toContain("My title"));
		expect(fetch).toHaveBeenCalledTimes(count);
		await act(async () => root.unmount());
		container.remove();
		await mount(client);
		await settles(() => expect(container.textContent).toContain("My title"));
		expect(fetch).toHaveBeenCalledTimes(count);
	});

	it("shows stale cached matches while refresh is pending and keeps them after network failure", async () => {
		let slow = false;
		const pending: Array<(value: Response) => void> = [];
		const fetch = vi.fn(
			async (raw: string | URL | Request): Promise<Response> => {
				if (slow) return new Promise((resolve) => pending.push(resolve));
				return Response.json(
					String(raw).includes("title-episodes")
						? detail()
						: browse("Saved title"),
				);
			},
		);
		const { client } = generationClient(fetch);
		await mount(client);
		await settles(() => expect(container.textContent).toContain("Saved title"));
		await act(async () => root.unmount());
		container.remove();
		const now = Date.now();
		const clock = vi.spyOn(Date, "now").mockReturnValue(now + 31_000);
		try {
			slow = true;
			await mount(client);
			await settles(() => {
				expect(container.textContent).toContain("Saved title");
				expect(pending.length).toBeGreaterThan(0);
			});
			await act(async () => {
				for (const resolve of pending)
					resolve(Response.json({}, { status: 503 }));
			});
			expect(container.textContent).toContain("Saved title");
			expect(container.textContent).toContain("Could not refresh");
		} finally {
			clock.mockRestore();
		}
	});

	it("retries a transient primary browse failure without depending on unavailable canonical history", async () => {
		let available = false;
		const fallback = clientFixture();
		const client = clientFixture(
			vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
				if (message.command === "list")
					return { ok: false, status: "retryable" };
				if (message.command === "browse" && !available)
					return { ok: false, status: "retryable" };
				return fallback.request(message);
			}),
		);
		await mount(client);
		expect(button("Retry watch history")).toBeDefined();
		available = true;
		await click("Retry watch history");
		expect(container.textContent).toContain("Frieren");
		expect(container.querySelector('[role="alert"]')).toBeNull();
		expect(
			vi
				.mocked(client.request)
				.mock.calls.filter(([message]) => message.command === "browse"),
		).toHaveLength(2);
		expect(
			vi
				.mocked(client.request)
				.mock.calls.filter(([message]) => message.command === "list"),
		).toHaveLength(0);
	});
	it("coalesces child-only generation mismatches and lets child Retry recover canonical authority", async () => {
		let cleared = false;
		let finishDetail: ((value: Response) => void) | undefined;
		const canonicalReads: Array<(value: Response) => void> = [];
		const next = browse("After child recovery");
		next.history.meta.accountGeneration = 2;
		const nextDetail = detail();
		nextDetail.detail.meta.accountGeneration = 2;
		const { client, storage } = generationClient(async (url) => {
			const path = new URL(String(url)).pathname;
			if (path.endsWith("/browse"))
				return Response.json(cleared ? next : browse());
			if (path.endsWith("/browse/title-episodes"))
				return cleared
					? Response.json(nextDetail)
					: new Promise((resolve) => {
							finishDetail = resolve;
						});
			if (path.endsWith("/browse/options"))
				return Response.json({
					meta: { ...meta, accountGeneration: 2 },
					options: [],
					nextCursor: null,
				});
			return new Promise((resolve) => canonicalReads.push(resolve));
		});
		await mount(client);
		await click("Together");
		await settles(() => expect(container.textContent).toContain("Frieren"));
		await settles(() => expect(finishDetail).toBeDefined());
		cleared = true;
		await click("Filters");
		await act(async () => required(finishDetail)(Response.json(nextDetail)));
		await settles(() => expect(canonicalReads).toHaveLength(1));
		expect(
			client.request.mock.calls.filter(([m]) => m.command === "list"),
		).toHaveLength(1);
		await act(async () =>
			required(canonicalReads[0])(new Response("offline", { status: 503 })),
		);
		expect(button("Retry options")).toBeDefined();
		expect(button("Retry episodes")).toBeDefined();
		expect(canonicalReads).toHaveLength(1);
		await click("Retry options");
		expect(canonicalReads).toHaveLength(2);
		await act(async () =>
			required(canonicalReads[1])(Response.json(next.history)),
		);
		await settles(() =>
			expect(container.textContent).toContain("After child recovery"),
		);
		expect((await storage.readRoot()).activeGenerations?.[OWNER]).toBe(2);
		expect(container.querySelector('[role="alert"]')).toBeNull();
		expect(
			client.request.mock.calls.filter(([m]) => m.command === "list"),
		).toHaveLength(2);
	});
	it("recovers an open drawer from cached generation 1 to server generation 2 through canonical authority", async () => {
		const page = browse("After website clear");
		page.history.meta.accountGeneration = 2;
		const fetch = vi.fn(async (url: RequestInfo | URL) => {
			const path = new URL(String(url)).pathname;
			if (path.endsWith("/browse")) return Response.json(page);
			if (path.endsWith("/browse/title-episodes")) {
				const result = detail();
				result.detail.meta.accountGeneration = 2;
				return Response.json(result);
			}
			return Response.json(page.history);
		});
		const { client, storage } = generationClient(fetch);
		expect((await client.loadCached(OWNER))?.accountGeneration).toBe(1);
		await mount(client);
		await settles(() =>
			expect(container.textContent).toContain("After website clear"),
		);
		expect((await storage.readRoot()).activeGenerations?.[OWNER]).toBe(2);
		expect(
			client.request.mock.calls.filter(([m]) => m.command === "list"),
		).toHaveLength(1);
		expect(
			client.request.mock.calls.filter(([m]) => m.command === "browse"),
		).toHaveLength(2);
		expect(container.querySelector('[role="alert"]')).toBeNull();
	});
	it("bounds failed generation recovery and manual Retry replays the current filtered query", async () => {
		let available = false;
		const page = browse("Recovered matching title");
		page.history.meta.accountGeneration = 2;
		const { client, storage } = generationClient(
			vi.fn(async (url: RequestInfo | URL) => {
				const path = new URL(String(url)).pathname;
				if (path.endsWith("/browse")) return Response.json(page);
				if (path.endsWith("/browse/title-episodes")) {
					const result = detail();
					result.detail.meta.accountGeneration = 2;
					return Response.json(result);
				}
				return available
					? Response.json(page.history)
					: new Response("offline", { status: 503 });
			}),
		);
		await mount(client);
		await settles(() =>
			expect(container.textContent).toContain("Please retry"),
		);
		expect(
			client.request.mock.calls.filter(([m]) => m.command === "list"),
		).toHaveLength(1);
		expect(container.textContent).toContain("Please retry");
		await change("Search watch history", "Recovered");
		await settles(() =>
			expect(button("Retry watch history").disabled).toBe(false),
		);
		expect(
			client.request.mock.calls.filter(([m]) => m.command === "list"),
		).toHaveLength(1);
		available = true;
		await click("Retry watch history");
		await settles(() =>
			expect(container.textContent).toContain("Recovered matching title"),
		);
		expect((await storage.readRoot()).activeGenerations?.[OWNER]).toBe(2);
		expect(
			client.request.mock.calls.filter(([m]) => m.command === "list"),
		).toHaveLength(2);
		expect(
			client.request.mock.calls
				.filter(([m]) => m.command === "browse")
				.at(-1)?.[0],
		).toMatchObject({
			input: { search: "Recovered", mode: "solo" },
			expectedOwnerUserId: OWNER,
		});
	});
	it("retires paged sessions when the same custom range becomes an authoritative complete sample", async () => {
		const sessions: WatchHistorySession[] = Array.from(
			{ length: 21 },
			(_, index) => ({
				id: `00000000-0000-4000-8000-${String(index + 30).padStart(12, "0")}`,
				kind: "shared",
				roomId: "old-room",
				roomGeneration: 1,
				sourceGeneration: 1,
				hostUserId: OWNER,
				currentTime: 900,
				duration: 1200,
				progress: 0.75,
				startedAt: "2020-01-01T00:00:00.000Z",
				endedAt: null,
				lastWatchedAt: "2026-09-01T08:00:00.000Z",
				participants: [
					{
						user: {
							userId: PERSON,
							displayName: index === 20 ? "Excluded observer" : "Mira",
							handle: null,
							avatarUrl: null,
						},
						role: "viewer",
						currentTime: 600,
						progress: 0.5,
						joinedAt: "2020-01-01T00:00:00.000Z",
						updatedAt: meta.serverTime,
						leftAt: null,
					},
				],
			}),
		);
		let complete = false;
		let finishLate: ((value: WatchHistoryMessageResponse) => void) | undefined;
		const fallback = clientFixture();
		const client = clientFixture(
			vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
				if (message.command === "browse-title-episodes") {
					const page = detail();
					required(page.detail.episodes[0]).sessions = sessions.slice(0, 20);
					required(page.matches[0]).matchingSessionCount = complete ? 20 : 21;
					required(page.matches[0]).sessionsComplete = complete;
					return {
						ok: true,
						data: WatchHistoryBrowseTitleEpisodesResponseSchema.parse(page),
					};
				}
				if (message.command === "browse-sessions") {
					if (complete)
						return new Promise((resolve) => {
							finishLate = resolve;
						});
					return {
						ok: true,
						data: WatchHistoryBrowseSessionsResponseSchema.parse({
							meta,
							sessions,
							groups: [],
							totalSessionCount: 21,
							nextCursor: null,
						}),
					};
				}
				return fallback.request(message);
			}),
		);
		await mount(client);
		await click("Together");
		await click("Filters");
		await change("Period", "custom");
		await change("From date", "2026-09-01");
		await change("Through date", "2026-09-01");
		await click("21 shared sessions");
		expect(container.querySelectorAll(".popup-watch-session")).toHaveLength(21);
		expect(container.textContent).toContain("Excluded observer");
		complete = true;
		await click("Refresh watch history");
		expect(button("20 shared sessions")).toBeDefined();
		expect(container.querySelectorAll(".popup-watch-session")).toHaveLength(20);
		expect(
			container.querySelectorAll(
				'[aria-label="Create room from Shared session"]',
			),
		).toHaveLength(20);
		expect(container.textContent).not.toContain("Excluded observer");
		expect(finishLate).toBeTypeOf("function");
		await act(async () =>
			required(finishLate)({
				ok: true,
				data: {
					meta,
					sessions,
					groups: [],
					totalSessionCount: 21,
					nextCursor: "obsolete",
				},
			}),
		);
		expect(container.querySelectorAll(".popup-watch-session")).toHaveLength(20);
		expect(container.textContent).not.toContain("Load more sessions");
	});
	it("does not loop when canonical recovery succeeds without advancing the mismatched generation", async () => {
		const newer = browse();
		newer.history.meta.accountGeneration = 2;
		const { client } = generationClient(async (url) =>
			Response.json(
				new URL(String(url)).pathname.endsWith("/browse")
					? newer
					: browse().history,
			),
		);
		await mount(client);
		await settles(() =>
			expect(container.textContent).toContain("Could not refresh"),
		);
		expect(
			client.request.mock.calls.filter(([m]) => m.command === "list"),
		).toHaveLength(1);
		expect(button("Retry watch history").disabled).toBe(false);
		await act(async () => {
			await Promise.resolve();
		});
		expect(
			client.request.mock.calls.filter(([m]) => m.command === "list"),
		).toHaveLength(1);
	});
	it.each([
		"owner",
		"generation",
	] as const)("ignores a canonical recovery finishing after the current %s changes", async (kind) => {
		let generation = 1;
		let finish: ((value: WatchHistoryMessageResponse) => void) | undefined;
		let publish:
			| Parameters<NonNullable<PopupWatchHistoryClient["subscribe"]>>[1]
			| undefined;
		const fallback = clientFixture();
		const snapshot = (value: ReturnType<typeof browse>["history"]) => ({
			history: value,
			accountGeneration: value.meta.accountGeneration,
			preferences: { youtubeHistoryEnabled: false },
			pendingEvents: [],
			localObservation: null,
			capturePaused: false,
		});
		const client: PopupWatchHistoryClient = {
			...clientFixture(async (message) => {
				if (message.command === "list")
					return new Promise((resolve) => {
						finish = resolve;
					});
				if (message.command === "browse") {
					if (message.expectedOwnerUserId === OWNER && generation === 1)
						return { ok: false, status: "generation-mismatch" };
					const page = browse("Current view");
					page.history.meta.ownerUserId = message.expectedOwnerUserId;
					page.history.meta.accountGeneration = generation;
					return { ok: true, data: page };
				}
				if (message.command === "browse-title-episodes") {
					const page = detail();
					page.detail.meta.ownerUserId = message.expectedOwnerUserId;
					page.detail.meta.accountGeneration = generation;
					return { ok: true, data: page };
				}
				return fallback.request(message);
			}),
			loadCached: async (owner) =>
				owner === OWNER ? snapshot(browse().history) : null,
			subscribe: (_owner, listener) => {
				publish = listener;
				return () => undefined;
			},
		};
		await mount(client);
		expect(finish).toBeTypeOf("function");
		if (kind === "owner") {
			await act(async () =>
				root.render(
					<PopupWatchHistoryPanel client={client} ownerUserId={PERSON} />,
				),
			);
		} else {
			generation = 3;
			const page = browse("Current view");
			page.history.meta.accountGeneration = 3;
			await act(async () => required(publish)(snapshot(page.history)));
		}
		const stale = browse("Obsolete recovery");
		stale.history.meta.accountGeneration = 2;
		await act(async () => required(finish)({ ok: true, data: stale.history }));
		expect(container.textContent).toContain("Current view");
		expect(container.textContent).not.toContain("Obsolete recovery");
		expect(container.querySelector('[role="alert"]')).toBeNull();
	});
	it("lets a newer browse restore exact availability and artwork after an older partial cache", async () => {
		const cached = browse().history;
		cached.generatedAt = cached.meta.serverTime = "2026-09-01T08:00:00.000Z";
		const cachedItem = required(cached.items[0]);
		cachedItem.catalogState = "partial";
		cachedItem.aggregate = {
			completedEpisodes: 2,
			availableEpisodes: null,
			progress: null,
		};
		cachedItem.artworkUrl = "https://www.crunchyroll.com/old.jpg";
		const fallback = clientFixture();
		const client = {
			...clientFixture(async (message) => {
				if (message.command !== "browse") return fallback.request(message);
				const page = browse();
				required(page.history.items[0]).artworkUrl =
					"https://www.crunchyroll.com/new.jpg";
				return { ok: true as const, data: page };
			}),
			loadCached: async () => ({
				history: cached,
				accountGeneration: 1,
				preferences: { youtubeHistoryEnabled: false },
				pendingEvents: [],
				localObservation: null,
				capturePaused: false,
			}),
		};
		await mount(client);
		expect(
			container.querySelector(".popup-watch-overall .popup-watch-percent")
				?.textContent,
		).toBe("17%");
		expect(
			container.querySelector(".popup-watch-artwork img")?.getAttribute("src"),
		).toBe("https://www.crunchyroll.com/new.jpg");
	});
	it("groups a matching episode outside the title slice using observed season metadata when catalog availability is unknown", async () => {
		const fallback = clientFixture();
		const client = clientFixture(async (message) => {
			if (message.command !== "browse-title-episodes")
				return fallback.request(message);
			const page = detail();
			page.detail.catalog = {
				state: "unavailable",
				title: null,
				aggregate: null,
				seasons: [],
			};
			page.detail.episodes[0] = {
				...episode,
				seasonKey: "season:older",
				seasonTitle: "Historical season",
			};
			return { ok: true, data: page };
		});
		await mount(client);
		expect(container.querySelector(".popup-season-title")?.textContent).toBe(
			"Historical season",
		);
		expect(container.querySelector(".popup-season-meta")?.textContent).toBe(
			"Availability unknown",
		);
		expect(container.textContent).toContain("Matching episode");
	});
	it("keeps the active segment selected and uses matching detail instead of the canonical eight-row slice", async () => {
		const client = clientFixture();
		await mount(client);
		await click("Mine");
		expect(button("Mine").getAttribute("aria-pressed")).toBe("true");
		expect(container.textContent).toContain("Matching episode");
		expect(container.textContent).not.toContain("Canonical nonmatch");
		const calls = vi
			.mocked(client.request)
			.mock.calls.map(([m]) => m)
			.filter((m) => m.command === "browse");
		expect(calls).toHaveLength(1);
		expect(calls[0]).toMatchObject({
			expectedOwnerUserId: OWNER,
			input: { mode: "solo", limit: 20 },
		});
	});
	it("combines historical group/person/local dates, retains labels in chips, and clears social filters on Mine", async () => {
		const client = clientFixture();
		await mount(client);
		await click("Together");
		await click("Filters");
		await change("My groups", GROUP);
		await change("Participant", PERSON);
		await change("Period", "custom");
		await change("From date", "2026-09-01");
		await change("Through date", "2026-09-03");
		const calls = vi
			.mocked(client.request)
			.mock.calls.map(([m]) => m)
			.filter((m) => m.command === "browse");
		const last = calls.at(-1);
		expect(last).toMatchObject({
			expectedOwnerUserId: OWNER,
			input: { mode: "shared", groupId: GROUP, participantUserId: PERSON },
		});
		const input = (last as { input: WatchHistoryBrowseQuery }).input;
		expect(new Date(input.from ?? "").getDate()).toBe(1);
		expect(new Date(input.until ?? "").getDate()).toBe(4);
		expect(container.textContent).toContain("Friday crew");
		expect(button("Remove participant Mira")).toBeDefined();
		await click("Mine");
		const mine = vi
			.mocked(client.request)
			.mock.calls.map(([m]) => m)
			.filter((m) => m.command === "browse")
			.at(-1);
		expect(mine).toMatchObject({ input: { mode: "solo" } });
		expect((mine as { input: object }).input).not.toHaveProperty("groupId");
		expect((mine as { input: object }).input).not.toHaveProperty(
			"participantUserId",
		);
		expect(container.querySelector('[aria-label="My groups"]')).toBeNull();
		await click("Clear conditions");
		expect(container.querySelector(".popup-watch-conditions")).toBeNull();
	});
	it("retains canonical aggregate and opens account management without destructive controls or consent in Watch", async () => {
		const client = clientFixture();
		await mount(client);
		expect(container.textContent).toContain("2 / 12 episodes");
		expect(container.textContent).toContain("17%");
		await click("Together");
		expect(container.textContent).toContain("2 / 12 episodes");
		expect(container.querySelector('[aria-label^="Delete"]')).toBeNull();
		expect(container.querySelector('[role="switch"]')).toBeNull();
		await click("Manage history");
		expect(client.openUrl).toHaveBeenCalledWith(
			"http://localhost:3003/account/watch-library",
		);
	});
	it("hides old-query content immediately and rejects late old query results", async () => {
		const flights: Array<{
			input: WatchHistoryBrowseQuery;
			resolve: (value: WatchHistoryMessageResponse) => void;
		}> = [];
		const fallback = clientFixture();
		const client = clientFixture(async (m) =>
			m.command === "browse"
				? new Promise((resolve) =>
						flights.push({
							input: m.input as WatchHistoryBrowseQuery,
							resolve,
						}),
					)
				: fallback.request(m),
		);
		await mount(client);
		await act(async () =>
			required(flights[0]).resolve({ ok: true, data: browse("Old query") }),
		);
		await change("Search watch history", "new");
		expect(container.textContent).not.toContain("Old query");
		await change("Search watch history", "latest");
		await act(async () =>
			required(flights[2]).resolve({ ok: true, data: browse("Latest query") }),
		);
		await act(async () =>
			required(flights[1]).resolve({ ok: true, data: browse("Stale query") }),
		);
		expect(container.textContent).toContain("Latest query");
		expect(container.textContent).not.toContain("Stale query");
	});
	it("continues title and episode streams with their own cursors and resets on changed conditions", async () => {
		const fallback = clientFixture();
		const client = clientFixture(
			vi.fn(async (m): Promise<WatchHistoryMessageResponse> => {
				if (m.command === "browse")
					return {
						ok: true,
						data: browse(
							"Frieren",
							(m.input as WatchHistoryBrowseQuery).cursor ? null : "title-next",
						),
					};
				if (m.command === "browse-title-episodes")
					return {
						ok: true,
						data: detail(
							(m.input as WatchHistoryBrowseQuery).cursor
								? null
								: "episode-next",
						),
					};
				return fallback.request(m);
			}),
		);
		await mount(client);
		await click("Load more episodes for Frieren");
		await click("Load more titles");
		expect(client.request).toHaveBeenCalledWith(
			expect.objectContaining({
				command: "browse-title-episodes",
				input: {
					mode: "solo",
					limit: 20,
					provider: item.provider,
					titleKey: item.titleKey,
					cursor: "episode-next",
				},
				expectedOwnerUserId: OWNER,
			}),
		);
		expect(client.request).toHaveBeenCalledWith(
			expect.objectContaining({
				command: "browse",
				input: { mode: "solo", limit: 20, cursor: "title-next" },
			}),
		);
		expect(container.querySelectorAll(".popup-watch-item")).toHaveLength(1);
		await click("Together");
		expect(
			vi
				.mocked(client.request)
				.mock.calls.map(([m]) => m)
				.filter((m) => m.command === "browse")
				.at(-1),
		).toMatchObject({ input: { mode: "shared", limit: 20 } });
	});
	it("starts an independent session stream beyond the sample, merges IDs and shows recorded participants and observed dates", async () => {
		const sessions: WatchHistorySession[] = Array.from(
			{ length: 22 },
			(_, index) => ({
				id: `00000000-0000-4000-8000-${String(index + 30).padStart(12, "0")}`,
				kind: "shared",
				roomId: "old-room",
				roomGeneration: 1,
				sourceGeneration: 1,
				hostUserId: OWNER,
				currentTime: 900,
				duration: 1200,
				progress: 0.75,
				startedAt: "2020-01-01T00:00:00.000Z",
				endedAt: null,
				lastWatchedAt: "2026-09-01T08:00:00.000Z",
				participants: [
					{
						user: {
							userId: PERSON,
							displayName: "Mira",
							handle: null,
							avatarUrl: null,
						},
						role: "viewer",
						currentTime: 600,
						progress: 0.5,
						joinedAt: "2020-01-01T00:00:00.000Z",
						updatedAt: meta.serverTime,
						leftAt: null,
					},
				],
			}),
		);
		const fallback = clientFixture();
		const client = clientFixture(
			vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
				if (message.command === "browse-title-episodes") {
					const page = detail();
					required(page.detail.episodes[0]).sessions = sessions.slice(0, 20);
					required(page.matches[0]).matchingSessionCount = 22;
					required(page.matches[0]).sessionsComplete = false;
					return {
						ok: true,
						data: WatchHistoryBrowseTitleEpisodesResponseSchema.parse(page),
					};
				}
				if (message.command === "browse-sessions")
					return {
						ok: true,
						data: WatchHistoryBrowseSessionsResponseSchema.parse({
							meta,
							sessions: (message.input as WatchHistoryBrowseQuery).cursor
								? sessions.slice(20)
								: sessions.slice(0, 20),
							groups: [],
							totalSessionCount: 22,
							nextCursor: (message.input as WatchHistoryBrowseQuery).cursor
								? null
								: "sessions-next",
						}),
					};
				return fallback.request(message);
			}),
		);
		await mount(client);
		await click("Together");
		await click("22 shared sessions");
		expect(container.querySelectorAll(".popup-watch-session")).toHaveLength(20);
		expect(container.textContent).toContain("Mira");
		expect(container.textContent).not.toContain("2020");
		expect(
			container
				.querySelector(".popup-watch-session time")
				?.getAttribute("datetime"),
		).toBe("2026-09-01T08:00:00.000Z");
		expect(
			container.querySelector(".popup-series-progress")?.textContent,
		).toContain("10:00");
		await click("Load more sessions");
		expect(container.querySelectorAll(".popup-watch-session")).toHaveLength(22);
		const calls = vi
			.mocked(client.request)
			.mock.calls.map(([m]) => m)
			.filter((m) => m.command === "browse-sessions");
		expect(calls[0]).toMatchObject({
			expectedOwnerUserId: OWNER,
			input: {
				mode: "shared",
				limit: 20,
				provider: item.provider,
				titleKey: item.titleKey,
				episodeKey: episode.episodeKey,
			},
		});
		expect((calls[0] as { input: object }).input).not.toHaveProperty("cursor");
		expect(calls[1]).toMatchObject({ input: { cursor: "sessions-next" } });
	});
	it("never paints an old owner title or detail when account changes with requests pending", async () => {
		let finishDetail!: (value: WatchHistoryMessageResponse) => void;
		const client = clientFixture(async (message) => {
			if (message.command === "browse") {
				const page = browse(
					message.expectedOwnerUserId === OWNER ? "Owner A" : "Owner B",
				);
				page.history.meta.ownerUserId = message.expectedOwnerUserId;
				return { ok: true, data: page };
			}
			if (
				message.command === "browse-title-episodes" &&
				message.expectedOwnerUserId === OWNER
			)
				return new Promise((resolve) => {
					finishDetail = resolve;
				});
			return { ok: true };
		});
		await mount(client);
		expect(container.textContent).toContain("Owner A");
		await act(async () =>
			root.render(
				<PopupWatchHistoryPanel client={client} ownerUserId={PERSON} />,
			),
		);
		await act(async () => finishDetail({ ok: true, data: detail() }));
		expect(container.textContent).toContain("Owner B");
		expect(container.textContent).not.toContain("Owner A");
		expect(container.textContent).not.toContain("Matching episode");
	});
	it("keeps selected historical labels when refreshed option pages no longer contain them", async () => {
		let removed = false;
		const fallback = clientFixture();
		const client = clientFixture(async (message) =>
			message.command === "browse-options" && removed
				? { ok: true, data: { meta, options: [], nextCursor: null } }
				: fallback.request(message),
		);
		await mount(client);
		await click("Together");
		await click("Filters");
		await change("My groups", GROUP);
		removed = true;
		await click("Refresh watch history");
		expect(button("Remove group Friday crew")).toBeDefined();
		expect(
			(container.querySelector('[aria-label="My groups"]') as HTMLSelectElement)
				.value,
		).toBe(GROUP);
	});
	it.each([
		{ completed: 1, available: 475, label: "<1%" },
		{ completed: 474, available: 475, label: "99%" },
	])("formats truthful integer progress without false completion: $label", async ({
		completed,
		available,
		label,
	}) => {
		const fallback = clientFixture();
		const client = clientFixture(async (message) => {
			if (message.command !== "browse") return fallback.request(message);
			const page = browse();
			required(page.history.items[0]).aggregate = {
				completedEpisodes: completed,
				availableEpisodes: available,
				progress: completed / available,
			};
			return { ok: true, data: page };
		});
		await mount(client);
		expect(container.querySelector(".popup-watch-percent")?.textContent).toBe(
			label,
		);
		expect(container.textContent).not.toContain("100%");
	});
});
