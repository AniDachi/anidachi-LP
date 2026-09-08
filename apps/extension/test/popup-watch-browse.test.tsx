import { paidHistoryLease } from "./watch-history-personal-fixtures";
import {
	parsePersonalHistoryResumeUrl,
	type WatchHistoryBrowseQuery,
	WatchHistoryBrowseResponseSchema,
	WatchHistoryGridResponseSchema,
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
			(request ? vi.fn(async (message: Parameters<PopupWatchHistoryClient["request"]>[0]): Promise<WatchHistoryMessageResponse> => message.command === "bootstrap" ? { ok: true, data: { ownerUserId: message.expectedOwnerUserId, accountGeneration: 1, preferences: { youtubeHistoryEnabled: false }, capturePaused: false, source: "network", accessLease: paidHistoryLease(message.expectedOwnerUserId) } } : request(message)) : undefined) ??
			vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
				if (message.command === "bootstrap") return { ok: true, data: { ownerUserId: message.expectedOwnerUserId, accountGeneration: 1, preferences: { youtubeHistoryEnabled: false }, capturePaused: false, source: "network", accessLease: paidHistoryLease(message.expectedOwnerUserId) } };
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
function unavailableGrid(
	titleKey = item.titleKey,
	generation = 1,
	seasonKey: string | null = "season:one",
) {
	return {
		meta: { ...meta, accountGeneration: generation },
		provider: "crunchyroll",
		titleKey,
		state: "unavailable",
		revision: null,
		seasonKey,
		seasons: [],
		mainAggregate: null,
		specialsAggregate: null,
		episodes: [],
		nextCursor: null,
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
				accessLease: paidHistoryLease(OWNER),
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
		fetch: async (raw, init) => {
			const url = new URL(String(raw));
			if (url.pathname.endsWith("/access")) return Response.json(paidHistoryLease(OWNER, Date.now() - 1000, stored.activeGenerations?.[OWNER] ?? 1).access);
			// Existing history regression fixtures have no accepted catalog roster.
			if (url.pathname.endsWith("/browse/catalog"))
				return Response.json(
					unavailableGrid(
						url.searchParams.get("titleKey")!,
						stored.activeGenerations?.[OWNER],
						url.searchParams.get("seasonKey"),
					),
				);
			return fetch(raw, init);
		},
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
async function selectPeriod(value: string) {
	const radio = required(
		container.querySelector<HTMLInputElement>(
			`input[type="radio"][value="${value}"]`,
		),
	);
	await act(async () => radio.click());
	expect(radio.checked).toBe(true);
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
  it("opens with a valid cached access lease before network revalidation finishes, then honors revocation", async () => {
    let finish!: (value: WatchHistoryMessageResponse) => void;
    const fallback = clientFixture();
    const client: PopupWatchHistoryClient = {
      ...fallback,
      request: vi.fn((message: Parameters<PopupWatchHistoryClient["request"]>[0]): Promise<WatchHistoryMessageResponse> => {
        if (message.command === "bootstrap-cache") return Promise.resolve({ ok: true, data: {
          ownerUserId: OWNER, accountGeneration: 1, preferences: { youtubeHistoryEnabled: true },
          capturePaused: false, source: "cache", accessLease: paidHistoryLease(OWNER),
        } });
        if (message.command === "bootstrap") return new Promise<WatchHistoryMessageResponse>(resolve => { finish = resolve; });
        return fallback.request(message);
      }),
    };
    await mount(client);
    expect(container.textContent).toContain("Frieren");
    expect(container.textContent).not.toContain("Checking history access");
    await act(async () => finish({ ok: false, status: "plan-required" }));
    expect(container.textContent).not.toContain("Frieren");
    expect(container.textContent).toContain("your own Plus or Pro");
  });

  it("shows artwork for existing YouTube rows whose stored artwork is null", async () => {
    const page = browse("Saved YouTube video");
    page.history.items[0] = { ...required(page.history.items[0]), provider: "youtube", itemKind: "movie",
      titleKey: "youtube:video:FyS5dAywkEo", sourceUrl: "https://www.youtube.com/watch?v=FyS5dAywkEo", artworkUrl: null };
    page.matches = [{ ...required(page.matches[0]), provider: "youtube", titleKey: "youtube:video:FyS5dAywkEo" }];
    const client = clientFixture(async message => message.command === "browse" ? { ok: true, data: page } : { ok: true });
    await mount(client);
    expect(container.querySelector('.popup-watch-artwork img')?.getAttribute('src'))
      .toBe('https://i.ytimg.com/vi/FyS5dAywkEo/hqdefault.jpg');
  });

  it.each(["expired", "other-owner", "other-generation"])("does not use a %s cached lease to reveal history", async kind => {
    const now = Date.now();
    const lease = paidHistoryLease(kind === "other-owner" ? PERSON : OWNER,
      kind === "expired" ? now - 600_000 : now, kind === "other-generation" ? 2 : 1);
    let finish!: (value: WatchHistoryMessageResponse) => void;
    const fallback = clientFixture();
    const request = vi.fn((message: Parameters<PopupWatchHistoryClient["request"]>[0]) => {
      if (message.command === "bootstrap-cache") return Promise.resolve({ ok: true as const, data: {
        ownerUserId: OWNER, accountGeneration: 1, preferences: { youtubeHistoryEnabled: true },
        capturePaused: false, source: "cache", accessLease: lease,
      } });
      if (message.command === "bootstrap") return new Promise<WatchHistoryMessageResponse>(resolve => { finish = resolve; });
      return fallback.request(message);
    });
    await mount({ ...fallback, request });
    expect(container.textContent).not.toContain("Frieren");
    expect(request.mock.calls.some(([message]) => message.command === "browse")).toBe(false);
    await act(async () => finish({ ok: false, status: "plan-required" }));
    expect(container.textContent).toContain("your own Plus or Pro");
  });

  it("keeps a valid cached lease through a network failure only until its original expiry", async () => {
    vi.useFakeTimers();
    try {
      const now = Date.now();
      const lease = paidHistoryLease(OWNER, now);
      lease.access.validUntil = new Date(now + 1_000).toISOString();
      lease.expiresAt = now + 1_000;
      const fallback = clientFixture();
      await mount({ ...fallback, request: async message => {
        if (message.command === "bootstrap-cache") return { ok: true, data: {
          ownerUserId: OWNER, accountGeneration: 1, preferences: { youtubeHistoryEnabled: true },
          capturePaused: false, source: "cache", accessLease: lease,
        } };
        if (message.command === "bootstrap") return { ok: false, status: "retryable" };
        return fallback.request(message);
      } });
      expect(container.textContent).toContain("Frieren");
      await act(async () => { await vi.advanceTimersByTimeAsync(1_001); });
      expect(container.textContent).not.toContain("Frieren");
      expect(container.textContent).toContain("temporarily unavailable");
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores a late successful bootstrap after a confirmed access loss", async () => {
    let finish!: (value: WatchHistoryMessageResponse) => void;
    let publish!: Parameters<NonNullable<PopupWatchHistoryClient["subscribe"]>>[1];
    const fallback = clientFixture();
    const data = { ownerUserId: OWNER, accountGeneration: 1, preferences: { youtubeHistoryEnabled: true },
      capturePaused: false, source: "cache", accessLease: paidHistoryLease(OWNER) };
    await mount({ ...fallback,
      subscribe: (_owner, listener) => { publish = listener; return () => {}; },
      request: async message => {
        if (message.command === "bootstrap-cache") return { ok: true, data };
        if (message.command === "bootstrap") return new Promise(resolve => { finish = resolve; });
        return fallback.request(message);
      },
    });
    expect(container.textContent).toContain("Frieren");
    await act(async () => publish(null, { ok: false, status: "plan-required" }));
    await act(async () => finish({ ok: true, data: { ...data, source: "network" } }));
    expect(container.textContent).not.toContain("Frieren");
    expect(container.textContent).toContain("your own Plus or Pro");
  });

  it.each(["plan-required", "access-unavailable", "upgrade-required"])("never reveals cached paid titles while access resolves to %s", async (status) => {
    let finish!: (value: WatchHistoryMessageResponse) => void;
    const fallback = clientFixture();
    const client = { ...fallback,
      loadCached: async () => ({ history: browse("Private cached title").history, accountGeneration: 1, preferences: { youtubeHistoryEnabled: false }, pendingEvents: [], localObservation: null, capturePaused: false }),
      request: vi.fn((message: Parameters<PopupWatchHistoryClient["request"]>[0]) => message.command === "bootstrap" ? new Promise<WatchHistoryMessageResponse>(resolve => { finish = resolve; }) : fallback.request(message)) };
    await mount(client);
    expect(container.querySelector('[aria-label="Watch History"]')?.getAttribute('aria-busy')).toBe('true');
    expect(container.textContent).not.toContain("Private cached title");
    if (status === "plan-required") {
      const lease = paidHistoryLease(OWNER); lease.access.state = "plan_required";
      await act(async () => finish({ ok: true, data: { ownerUserId: OWNER, accountGeneration: 1, preferences: { youtubeHistoryEnabled: false }, capturePaused: false, source: "network", accessLease: lease } }));
      expect(container.textContent).toContain("your own Plus or Pro");
    } else {
      await act(async () => finish({ ok: false, status: status as "access-unavailable" | "upgrade-required" }));
      expect(container.textContent).toContain(status === "upgrade-required" ? "Update AniDachi" : "temporarily unavailable");
    }
    expect(container.textContent).not.toContain("Private cached title");
    expect(client.request.mock.calls.some(([m]) => m.command === "browse")).toBe(false);
    expect(container.textContent).toContain("Manage history");
  });
  it("removes paid cards immediately on a confirmed access loss and ignores a delayed browse", async () => {
    let publish!: Parameters<NonNullable<PopupWatchHistoryClient["subscribe"]>>[1];
    let finish!: (value: WatchHistoryMessageResponse) => void;
    let blocked = false;
    const fallback = clientFixture();
    const client = { ...clientFixture(async message => message.command === "browse" && blocked ? new Promise<WatchHistoryMessageResponse>(resolve => { finish = resolve; }) : fallback.request(message)),
      subscribe: (_owner: string, listener: typeof publish) => { publish = listener; return () => {}; } };
    await mount(client); expect(container.textContent).toContain("Frieren");
    blocked = true; await change("Search watch history", "Journey");
    await act(async () => publish(null, { ok: false, status: "plan-required" }));
    expect(container.textContent).not.toContain("Frieren");
    await act(async () => finish({ ok: true, data: browse("Late private title") }));
    expect(container.textContent).not.toContain("Late private title");
    expect(container.textContent).toContain("your own Plus or Pro");
  });

	it("bounds calendar fields and blocks manually typed future or reversed dates before browsing", async () => {
		const client = clientFixture();
		await mount(client);
		await click("Filters");
		await selectPeriod("custom");
		const from = required(
			container.querySelector<HTMLInputElement>('[aria-label="From date"]'),
		);
		const through = required(
			container.querySelector<HTMLInputElement>('[aria-label="Through date"]'),
		);
		const now = new Date();
		const localDate = (date: Date) =>
			`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
		const today = localDate(now);
		const tomorrow = new Date(now);
		tomorrow.setDate(now.getDate() + 1);
		const yesterday = new Date(now);
		yesterday.setDate(now.getDate() - 1);
		expect(from.max).toBe(today);
		expect(through.max).toBe(today);
		await change("From date", today);
		expect(through.min).toBe(today);
		const browseCount = () =>
			vi
				.mocked(client.request)
				.mock.calls.filter(([m]) => m.command === "browse").length;
		const initialCount = browseCount();
		await change("Through date", localDate(tomorrow));
		expect(container.textContent).toContain("Choose today or an earlier date.");
		expect(through.getAttribute("aria-invalid")).toBe("true");
		expect(browseCount()).toBe(initialCount);
		await change("Through date", localDate(yesterday));
		expect(from.max).toBe(localDate(yesterday));
		expect(container.textContent).toContain(
			"End date must be on or after start date.",
		);
		expect(browseCount()).toBe(initialCount);
		await change("Through date", today);
		expect(through.getAttribute("aria-invalid")).toBeNull();
		expect(browseCount()).toBeGreaterThan(initialCount);
	});

	it.each([
		false,
		true,
	])("keeps the saved-history toolbar quiet while a background read is pending (empty: %s)", async (empty) => {
		let blocked = false;
		const fallback = clientFixture();
		const client = clientFixture(async (message) => {
			if (message.command === "browse" && blocked)
				return new Promise<WatchHistoryMessageResponse>(() => {});
			if (message.command === "browse" && empty) {
				const response = browse();
				response.history.items = [];
				response.history.totalTitleCount = 0;
				response.matches = [];
				return { ok: true, data: response };
			}
			return fallback.request(message);
		});
		await mount(client);
		const savedContent = empty
			? "Episodes you watch on supported sites will appear here."
			: "Frieren";
		expect(container.textContent).toContain(savedContent);
		expect(
			container.querySelector('[aria-label="Refresh watch history"]'),
		).toBeNull();
		blocked = true;
		await act(async () =>
			root.render(
				<PopupWatchHistoryPanel
					client={client}
					ownerUserId={OWNER}
					refreshSignal={1}
				/>,
			),
		);
		expect(container.textContent).toContain(savedContent);
		expect(container.querySelector(".popup-watch-status")).toBeNull();
		expect(container.querySelector(".popup-watch-mode-switch")).toBeNull();
		expect(button("Filters").disabled).toBe(false);
	});
	it("marks selected filter conditions and restores focus when dismissed with Escape", async () => {
		await mount(clientFixture());
		const trigger = button("Filters");
		expect(trigger.getAttribute("title")).toBe("Filters");
		await click("Filters");
		await selectPeriod("today");
		expect(trigger.getAttribute("data-active")).toBe("true");
		await act(async () =>
			required(
				container.querySelector('[aria-label="History filters"]'),
			).dispatchEvent(
				new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
			),
		);
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		expect(document.activeElement).toBe(trigger);
		await click("Filters");
		await selectPeriod("all-time");
		expect(trigger.getAttribute("data-active")).toBe("false");
		await click("Close filters");
		expect(
			container.querySelector('[aria-label="History filters"]'),
		).toBeNull();
		expect(document.activeElement).toBe(trigger);
		await click("Filters");
		expect(
			container.querySelector<HTMLInputElement>(
				'input[type="radio"][value="all-time"]',
			)?.checked,
		).toBe(true);
	});
	it("dismisses the filter popover outside, preserves search on reset, and shows no chips", async () => {
		await mount(clientFixture());
		await change("Search watch history", "Frieren");
		await click("Filters");
		await selectPeriod("today");
		expect(container.querySelector(".popup-watch-conditions")).toBeNull();
		await act(async () =>
			document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })),
		);
		expect(button("Filters").getAttribute("aria-expanded")).toBe("false");
		await click("Filters");
		expect(
			container.querySelector<HTMLInputElement>(
				'input[type="radio"][value="today"]',
			)?.checked,
		).toBe(true);
		await click("Reset filters");
		expect(
			container.querySelector<HTMLInputElement>(
				'[aria-label="Search watch history"]',
			)?.value,
		).toBe("Frieren");
		expect(button("Filters").getAttribute("data-active")).toBe("false");
		await act(async () => button("Manage history").focus());
		expect(button("Filters").getAttribute("aria-expanded")).toBe("false");
		expect(document.activeElement).toBe(button("Manage history"));
	});
	it("keeps saved personal queries and their episodes visible while progress revalidation is blocked", async () => {
		let blocked = false;
		const requests: string[] = [];
		const setup = generationClient(async (url) => {
			requests.push(String(url));
			if (blocked) return new Promise<Response>(() => {});
			return Response.json({
				...browse(
					String(url).includes("search=Journey") ? "Saved search" : "Saved personal",
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
		await change("Search watch history", "Journey");
		await settles(() =>
			expect(container.textContent).toContain("Saved search"),
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
		expect(container.textContent).toContain("Saved search");
		await change("Search watch history", "");
		await settles(() => expect(container.textContent).toContain("Saved personal"));
		expect(container.textContent).toContain("Matching episode");
		await act(async () => root.unmount());
		container.remove();
		await mount(client);
		await settles(() => expect(container.textContent).toContain("Saved personal"));
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
		expect(container.textContent).toContain("New shared video");
		expect(container.textContent).toContain("New shared video");
		expect(container.textContent).toContain("Pending sync");
		expect(container.textContent).not.toContain("Watch together again");
	});
	it.each(["Personal"])("renders %s preview episodes without a detail request and continues only on demand", async (mode) => {
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
		client.loadBrowseCached = async () => ({ ok: true });
		await mount(client);
		expect(container.textContent).toContain("Matching episode");
		expect(container.textContent).not.toContain("Canonical nonmatch");
		expect(requests).toHaveLength(0);
		await click("Load more episodes for Frieren");
		expect(requests).toHaveLength(1);
		expect(JSON.parse(required(requests[0]))).toMatchObject({
			mode: "personal",
			cursor: "next-preview-episodes",
		});
		expect(container.textContent).toContain("Matching episode");
		expect(
			container.querySelector('[title="Older matching episode"]'),
		).not.toBeNull();
	});
	it.each(["Personal"])("prefers newer saved %s detail and continues from its cursor with network held", async (mode) => {
		const preview = detail("preview-next");
		const saved = detail("saved-next");
		saved.detail.generatedAt = saved.detail.meta.serverTime =
			"2026-09-05T09:00:00.000Z";
		saved.detail.episodes[0] = {
			...episode,
			episodeTitle: "Newer saved episode",
			currentTime: 900,
			progress: 0.75,
		};
		saved.detail.episodes.push({
			...episode,
			episodeKey: "saved-extra",
			episodeTitle: "Additional saved episode",
			episodeNumber: 2,
		});
		saved.matches.push({
			...required(saved.matches[0]),
			episodeKey: "saved-extra",
		});
		const requests: unknown[] = [];
		const client = {
			...clientFixture(async (message) => {
				if (message.command === "browse")
					return {
						ok: true,
						data: { ...browse(), episodePreviews: [preview] },
					};
				if (message.command === "browse-title-episodes") {
					requests.push(message.input);
					return new Promise<WatchHistoryMessageResponse>(() => {});
				}
				return { ok: true };
			}),
			loadBrowseCached: async (
				message: Parameters<
					NonNullable<PopupWatchHistoryClient["loadBrowseCached"]>
				>[0],
			) =>
				message.command === "browse-title-episodes" &&
				!(message.input as { cursor?: string }).cursor
					? { ok: true as const, data: saved, cachedAt: 0 }
					: { ok: true as const },
		};
		await mount(client);
		expect(container.textContent).toContain("Newer saved episode");
		expect(
			container.querySelector('[title="Additional saved episode"]'),
		).not.toBeNull();
		expect(container.textContent).toContain("15:00");
		expect(requests).toHaveLength(0);
		await click("Load more episodes for Frieren");
		expect(requests).toEqual([
			expect.objectContaining({
				mode: "personal",
				cursor: "saved-next",
			}),
		]);
		expect(container.textContent).toContain("Newer saved episode");
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
	it.each(["plan-required", "access-changed"] as const)("drops retained paid pages on %s", async (status) => {
        let denied = false;
        const client = clientFixture(async () => denied ? { ok: false, status } : { ok: true, data: browse("Paid retained title") });
        function Harness() {
            const result = usePopupWatchBrowse({ client,
                message: { type: "ANIDACHI_WATCH_HISTORY_V3", command: "browse", expectedOwnerUserId: OWNER, input: { mode: "solo" } },
                parser: WatchHistoryBrowseResponseSchema, meta: (data) => data.history.meta, cursor: (data) => data.history.nextCursor,
                refresh: 0, generation: 1 });
            return <><div>{result.pages.flatMap((page) => page.history.items.map((item) => item.title)).join(",")}</div><button onClick={result.reload}>Refresh paid</button></>;
        }
        container = document.createElement("div"); document.body.append(container); root = createRoot(container);
        await act(async () => root.render(<Harness />));
        expect(container.textContent).toContain("Paid retained title");
        denied = true; await click("Refresh paid");
        expect(container.textContent).not.toContain("Paid retained title");
    });
	it("reuses personal and search queries on return and popup remount without another HTTP round trip", async () => {
		const fetch = vi.fn(async (raw: string | URL | Request) => {
			const url = String(raw);
			return Response.json(
				url.includes("title-episodes")
					? detail()
					: browse(url.includes("search=Journey") ? "Search title" : "My title"),
			);
		});
		const { client } = generationClient(fetch);
		await mount(client);
		await settles(() => expect(container.textContent).toContain("My title"));
		await settles(() =>
			expect(container.textContent).toContain("Matching episode"),
		);
		await change("Search watch history", "Journey");
		await settles(() =>
			expect(container.textContent).toContain("Search title"),
		);
		await settles(() =>
			expect(container.textContent).toContain("Matching episode"),
		);
		const count = fetch.mock.calls.length;
		await change("Search watch history", "");
		await settles(() => expect(container.textContent).toContain("My title"));
		expect(fetch).toHaveBeenCalledTimes(count);
		await act(async () => root.unmount());
		container.remove();
		await mount(client);
		await settles(() => expect(container.textContent).toContain("My title"));
		expect(fetch).toHaveBeenCalledTimes(count);
	});

	it("restores a visited personal query immediately while its exact cache read is pending", async () => {
		const fallback = gridClient();
		const client = clientFixture(async (message) => {
			if (message.command !== "browse") return fallback.request(message);
			const shared =
				Boolean((message.input as WatchHistoryBrowseQuery).search);
			const data = browse(shared ? "Shared title" : "My title");
			const preview = detail();
			if (shared) {
				data.history.items[0]!.titleKey = "crunchyroll:title:shared";
				data.matches[0]!.titleKey = "crunchyroll:title:shared";
				preview.detail.titleKey = "crunchyroll:title:shared";
			}
			return { ok: true, data: { ...data, episodePreviews: [preview] } };
		});
		await mount(client);
		await change("Search watch history", "Journey");
		expect(container.textContent).toContain("Shared title");
		client.loadBrowseCached = () => new Promise(() => {});
		await change("Search watch history", "");
		expect(container.textContent).toContain("My title");
		expect(container.textContent).not.toContain("Shared title");
		expect(container.querySelectorAll(".popup-episode-cell")).toHaveLength(12);
		expect(container.textContent).not.toContain("Loading watch history...");
	});

	it.each([
		"refresh",
		"generation",
		"client",
		"discard",
	] as const)("does not restore a visited query after %s changes", async (change) => {
		let blocked = false;
		const client = clientFixture(async (message) =>
			blocked
				? new Promise(() => {})
				: {
						ok: true,
						data: browse(
							message.command === "browse" &&
								(message.input as WatchHistoryBrowseQuery).mode === "shared"
								? "Shared title"
								: "My title",
						),
					},
		);
		const replacementClient = { ...client };
		function Harness({
			mode,
			changed = false,
		}: {
			mode: "solo" | "shared";
			changed?: boolean;
		}) {
			const result = usePopupWatchBrowse({
				client: changed && change === "client" ? replacementClient : client,
				message: {
					type: "ANIDACHI_WATCH_HISTORY_V3",
					command: "browse",
					expectedOwnerUserId: OWNER,
					input: { mode, limit: 20 },
				},
				parser: WatchHistoryBrowseResponseSchema,
				meta: (data) => data.history.meta,
				cursor: (data) => data.history.nextCursor,
				refresh: changed && change === "refresh" ? 1 : 0,
				generation: changed && change === "generation" ? 2 : 1,
				discard: changed && change === "discard",
			});
			return (
				<div>
					{result.pages
						.flatMap((page) => page.history.items.map((item) => item.title))
						.join(",")}
				</div>
			);
		}
		container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
		await act(async () => root.render(<Harness mode="solo" />));
		expect(container.textContent).toBe("My title");
		await act(async () => root.render(<Harness mode="shared" />));
		expect(container.textContent).toBe("Shared title");
		blocked = true;
		await act(async () => root.render(<Harness mode="solo" changed />));
		expect(container.textContent).toBe("");
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
			container.querySelector('[aria-label="Retry watch history"]'),
		).toBeNull();
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
			if (path.endsWith("/access")) return Response.json(paidHistoryLease(OWNER, Date.now(), 2).access);
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
		expect(container.querySelector(".popup-watch-filter-people")).toBeNull();
		expect(button("Retry episodes")).toBeDefined();
		expect(canonicalReads).toHaveLength(1);
		await click("Retry episodes");
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
			if (path.endsWith("/access")) return Response.json(paidHistoryLease(OWNER, Date.now(), 2).access);
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
			if (path.endsWith("/access")) return Response.json(paidHistoryLease(OWNER, Date.now(), 2).access);
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
			input: { search: "Recovered", mode: "personal" },
			expectedOwnerUserId: OWNER,
		});
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
		expect(
			container.querySelector(".popup-season-trigger > span")?.textContent,
		).toBe("Historical season");
		expect(container.querySelector(".popup-season-counter")?.textContent).toBe(
			"1 known",
		);
		expect(container.textContent).toContain("Matching episode");
	});
	it("uses personal mode and uses matching detail instead of the canonical eight-row slice", async () => {
		const client = clientFixture();
		await mount(client);
		expect(container.querySelector(".popup-watch-mode-switch")).toBeNull();
		expect(container.textContent).toContain("Matching episode");
		expect(container.textContent).not.toContain("Canonical nonmatch");
		const calls = vi
			.mocked(client.request)
			.mock.calls.map(([m]) => m)
			.filter((m) => m.command === "browse");
		expect(calls).toHaveLength(1);
		expect(calls[0]).toMatchObject({
			expectedOwnerUserId: OWNER,
			input: { mode: "personal", limit: 20 },
		});
	});
	it("keeps own search and local dates without social filter options", async () => {
		const client = clientFixture(); await mount(client);
		await change("Search watch history", "Journey"); await click("Filters");
		await selectPeriod("custom"); await change("From date", "2026-09-01"); await change("Through date", "2026-09-03");
		const calls = vi.mocked(client.request).mock.calls.map(([m]) => m).filter(m => m.command === "browse");
		const last = calls.at(-1) as { input: WatchHistoryBrowseQuery };
		expect(last.input).toMatchObject({ mode: "personal", search: "Journey" });
		expect(new Date(last.input.from!).getDate()).toBe(1); expect(new Date(last.input.until!).getDate()).toBe(4);
		expect(last.input).not.toHaveProperty("groupId"); expect(last.input).not.toHaveProperty("participantUserId");
		expect(container.querySelector('[aria-label="My groups"]')).toBeNull();
		expect(vi.mocked(client.request).mock.calls.some(([m]) => m.command === "browse-options" || m.command === "browse-sessions")).toBe(false);
		await click("Reset filters"); expect(container.querySelector<HTMLInputElement>('[aria-label="Search watch history"]')?.value).toBe("Journey");
	});

	it("retains canonical aggregate and opens account management without destructive controls or consent in Watch", async () => {
		const client = clientFixture();
		await mount(client);
		expect(container.textContent).toContain("2 / 12 episodes");
		expect(container.textContent).toContain("17%");
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
					mode: "personal",
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
				input: { mode: "personal", limit: 20, cursor: "title-next" },
			}),
		);
		expect(container.querySelectorAll(".popup-watch-item")).toHaveLength(1);
		await change("Search watch history", "Journey");
		expect(
			vi
				.mocked(client.request)
				.mock.calls.map(([m]) => m)
				.filter((m) => m.command === "browse")
				.at(-1),
		).toMatchObject({ input: { mode: "personal", limit: 20, search: "Journey" } });
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

function gridResponse(seasonKey = "season:one") {
	const seasons = [
		{ ...item.seasons[0]!, kind: "season", nextEpisode: null },
		{
			seasonKey: "season:two",
			seasonTitle: "Season 2",
			seasonNumber: 2,
			order: 1,
			aggregate: { completedEpisodes: 0, availableEpisodes: 1, progress: 0 },
			kind: "season",
			nextEpisode: null,
		},
		{
			seasonKey: "season:special",
			seasonTitle: "Specials",
			seasonNumber: null,
			order: 2,
			aggregate: { completedEpisodes: 0, availableEpisodes: 2, progress: 0 },
			kind: "specials",
			nextEpisode: null,
		},
	].map(({ ...season }) => {
		delete (season as { episodes?: unknown }).episodes;
		return season;
	});
	const selected = seasons.find((s) => s.seasonKey === seasonKey)!;
	const episodes = Array.from(
		{ length: selected.aggregate.availableEpisodes },
		(_, index) => ({
			episodeKey:
				seasonKey === "season:one" && !index
					? episode.episodeKey
					: `${seasonKey}:${index}`,
			episodeTitle:
				seasonKey === "season:one" && !index
					? episode.episodeTitle
					: `Catalog ${selected.seasonTitle} ${index}`,
			episodeNumber:
				selected.kind === "specials" ? (index ? null : 12.5) : index + 1,
			seasonKey,
			order: index,
			releasedAt: null,
			available: index !== 10,
			sourceUrl: `https://www.crunchyroll.com/watch/GRID${index}`,
			history: seasonKey === "season:one" && !index ? episode : null,
		}),
	);
	return WatchHistoryGridResponseSchema.parse({
		meta,
		provider: item.provider,
		titleKey: item.titleKey,
		state: "complete",
		revision: "grid-one",
		seasonKey,
		seasons,
		mainAggregate: {
			completedEpisodes: 2,
			availableEpisodes: 13,
			progress: 2 / 13,
		},
		specialsAggregate: {
			completedEpisodes: 0,
			availableEpisodes: 2,
			progress: 0,
		},
		episodes,
		nextCursor: null,
	});
}
function gridClient() {
	const fallback = clientFixture();
	return clientFixture(
		vi.fn(
			async (
				message: Parameters<PopupWatchHistoryClient["request"]>[0],
			): Promise<WatchHistoryMessageResponse> =>
				message.command === "browse-catalog"
					? {
							ok: true,
							data: gridResponse(
								(message.input as { seasonKey?: string }).seasonKey,
							),
						}
					: fallback.request(message),
		),
	);
}

describe("watch episode grid", () => {
	it.each(["saved", "canonical", "pending", "canonical-over-older-pending"] as const)("keeps %s raw URL and time as one Resume observation", async (kind) => {
		const fallback = gridClient();
		const newer = { ...episode, sourceUrl: "https://www.crunchyroll.com/watch/NEWRAW", currentTime: 731, lastWatchedAt: "2026-09-05T09:00:00.000Z" };
		const history = browse().history;
		if (kind.startsWith("canonical")) history.items[0]!.seasons[0]!.episodes = [newer];
		const event = { ...newer, schemaVersion: 3, clientEventId: GROUP, clientSessionKey: "raw-resume", accountGeneration: 1, provider: item.provider, titleKey: item.titleKey, itemKind: item.itemKind, title: item.title, artworkUrl: null, observedAt: newer.lastWatchedAt, kind: "heartbeat" } as WatchProgressEvent;
		if (kind === "canonical-over-older-pending") { event.observedAt = "2026-09-05T08:30:00.000Z"; event.currentTime = 680; event.sourceUrl = "https://www.crunchyroll.com/watch/OLDERPENDING"; }
		const client = {
			...clientFixture(async (message) => fallback.request(message)),
			loadCached: async () => ({ history, accountGeneration: 1, preferences: { youtubeHistoryEnabled: false }, capturePaused: false, pendingEvents: kind.includes("pending") ? [event] : [], localObservation: null }),
		};
		await mount(client);
		await click(`Resume ${episode.episodeTitle}`);
		await settles(() => expect(client.openUrl).toHaveBeenCalledTimes(1));
		const url = vi.mocked(client.openUrl).mock.calls[0]![0];
		const intent = parsePersonalHistoryResumeUrl(url);
		expect(intent?.sourceUrl).toBe(kind === "saved" ? episode.sourceUrl : newer.sourceUrl);
		expect(intent?.currentTime).toBe(kind === "saved" ? episode.currentTime : newer.currentTime);
	});

	it("keeps Resume on the current episode when its cell is beyond the first catalog page", async () => {
		const fallback = gridClient();
		const client = clientFixture(async (message) => {
			if (message.command !== "browse-catalog")
				return fallback.request(message);
			const data = gridResponse();
			data.episodes = data.episodes.filter(
				(entry) => entry.episodeKey !== episode.episodeKey,
			);
			data.nextCursor = "later-page";
			return { ok: true, data };
		});
		await mount(client);
		expect(container.querySelectorAll(".popup-episode-cell")).toHaveLength(11);
		expect(
			container.querySelector(".popup-selected-episode-title")?.textContent,
		).toBe(episode.episodeTitle);
		expect(
			container.querySelectorAll('.popup-episode-cell[tabindex="0"]'),
		).toHaveLength(1);
		expect(
			container.querySelector(
				`.popup-episode-cell[data-episode-key="${episode.episodeKey}"]`,
			),
		).toBeNull();
		await click(`Resume ${episode.episodeTitle}`);
		await settles(() => expect(client.openUrl).toHaveBeenCalledWith(expect.stringContaining(`${episode.sourceUrl}#anidachiResume=`)));
		await act(async () =>
			required(
				container.querySelector<HTMLButtonElement>(".popup-episode-cell"),
			).click(),
		);
		expect(
			container.querySelector(".popup-selected-episode-title")?.textContent,
		).toBe("Catalog Season 1 1");
	});
	it("selects real unwatched episodes without launching or writing progress, then launches only the explicit action", async () => {
		const client = gridClient();
		await mount(client);
		expect(container.querySelectorAll(".popup-episode-cell")).toHaveLength(12);
		expect(
			container.querySelector(".popup-watch-summary")?.textContent,
		).toContain("2 / 13 episodes + 0 / 2 specials");
		const target = required(
			container.querySelector<HTMLButtonElement>(
				'[title="Catalog Season 1 1"]',
			),
		);
		await act(async () => target.click());
		expect(
			container.querySelector(".popup-selected-episode-title")?.textContent,
		).toBe("Catalog Season 1 1");
		expect(client.openUrl).not.toHaveBeenCalled();
		expect(
			vi
				.mocked(client.request)
				.mock.calls.every(
					([message]) => !["enqueue", "progress"].includes(message.command),
				),
		).toBe(true);
		await click("Watch E2");
		expect(client.openUrl).toHaveBeenCalledWith(
			"https://www.crunchyroll.com/watch/GRID1",
		);
		await act(async () =>
			required(
				container.querySelector<HTMLButtonElement>(
					'[title="Catalog Season 1 10"]',
				),
			).click(),
		);
		expect(button("Watch E11").disabled).toBe(true);
	});
	it("switches seasons with one dropdown, preserves the selected episode, and renders named specials with exact source numbers", async () => {
		await mount(gridClient());
		await act(async () =>
			required(
				container.querySelector<HTMLButtonElement>(
					'[title="Catalog Season 1 3"]',
				),
			).click(),
		);
		await click("Season for Frieren: Season 1");
		expect(document.activeElement?.getAttribute("aria-selected")).toBe("true");
		await act(async () =>
			document.activeElement?.dispatchEvent(
				new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
			),
		);
		expect(document.activeElement?.textContent).toBe("Season 2");
		await click("Season 2");
		expect(container.querySelectorAll(".popup-episode-cell")).toHaveLength(1);
		await click("Season for Frieren: Season 2");
		await click("Specials");
		expect(container.querySelectorAll(".popup-special-choice")).toHaveLength(2);
		expect(
			container.querySelector(".popup-special-choice .popup-cell-number")
				?.textContent,
		).toBe("12.5");
		expect(
			container.querySelector(
				".popup-special-choice:last-child .popup-cell-number",
			)?.textContent,
		).toBe("—");
		await click("Season for Frieren: Specials");
		await click("Season 1");
		expect(
			container
				.querySelector('.popup-episode-cell[aria-pressed="true"]')
				?.getAttribute("title"),
		).toBe("Catalog Season 1 3");
		const toggle = required(
			container.querySelector<HTMLButtonElement>(".popup-watch-title-toggle"),
		);
		await act(async () => toggle.click());
		expect(
			container.querySelector(".popup-watch-grid-view")?.hasAttribute("hidden"),
		).toBe(true);
		await act(async () => toggle.click());
		expect(
			container
				.querySelector('.popup-episode-cell[aria-pressed="true"]')
				?.getAttribute("title"),
		).toBe("Catalog Season 1 3");
	});
	it("restores a visited season without collapsing its grid while its cache read is pending", async () => {
		const client = gridClient();
		await mount(client);
		const scroller = required(
			container.querySelector<HTMLElement>(".popup-episode-grid-scroll"),
		);
		await act(async () => {
			scroller.scrollTop = 200;
			scroller.dispatchEvent(new Event("scroll"));
		});
		await act(async () =>
			required(
				container.querySelector<HTMLButtonElement>(
					'[title="Catalog Season 1 3"]',
				),
			).click(),
		);
		await click("Season for Frieren: Season 1");
		await click("Season 2");
		// Model the browser clamping scrollTop when a shorter season is rendered.
		await act(async () => {
			scroller.scrollTop = 0;
			scroller.dispatchEvent(new Event("scroll"));
		});
		client.loadBrowseCached = () => new Promise(() => {});
		await click("Season for Frieren: Season 2");
		await click("Season 1");
		expect(container.querySelectorAll(".popup-episode-cell")).toHaveLength(12);
		expect(
			container
				.querySelector('.popup-episode-cell[aria-pressed="true"]')
				?.getAttribute("title"),
		).toBe("Catalog Season 1 3");
		expect(container.textContent).not.toContain("Loading episode catalog...");
		expect(scroller.scrollTop).toBe(200);
	});

	it("keeps personal search results restricted to matching history while retaining canonical totals", async () => {
		await mount(gridClient());
		expect(container.querySelectorAll(".popup-episode-cell")).toHaveLength(12);
		expect(
			container.querySelector(".popup-watch-summary")?.textContent,
		).toContain("2 / 13 episodes");
		await change("Search watch history", "Matching");
		await settles(() =>
			expect(container.querySelectorAll(".popup-episode-cell")).toHaveLength(1),
		);
		expect(container.querySelector('[title="Catalog Season 1 1"]')).toBeNull();
	});
	it("keeps known episodes usable when the optional catalog endpoint is missing", async () => {
		const fallback = clientFixture();
		const client = clientFixture(async (message) =>
			message.command === "browse-catalog"
				? { ok: false, status: "rejected" }
				: fallback.request(message),
		);
		await mount(client);
		expect(container.querySelectorAll(".popup-episode-cell")).toHaveLength(1);
		expect(container.textContent).toContain("Known episodes only");
		await click("Resume Matching episode");
		await settles(() => expect(client.openUrl).toHaveBeenCalledWith(expect.stringContaining(`${episode.sourceUrl}#anidachiResume=`)));
	});
	it("drops retained catalog totals when a season read is rejected after the catalog changes", async () => {
		const fallback = gridClient();
		let rejected = false;
		const client = clientFixture(async (message) =>
			message.command === "browse-catalog" && rejected
				? { ok: false, status: "rejected" }
				: fallback.request(message),
		);
		await mount(client);
		expect(container.querySelectorAll(".popup-episode-cell")).toHaveLength(12);
		rejected = true;
		await click("Season for Frieren: Season 1");
		await click("Season 2");
		expect(container.textContent).toContain("Known episodes only");
		expect(
			container.querySelector(".popup-watch-summary")?.textContent,
		).not.toContain("specials");
		expect(container.querySelector('[title="Catalog Season 1 1"]')).toBeNull();
	});
});
