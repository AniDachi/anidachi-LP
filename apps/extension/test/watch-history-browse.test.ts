import { describe, expect, it, vi } from "vitest";
import {
	createWatchHistoryClient,
	isWatchHistoryMessage,
} from "../src/watch-history-client";
import {
	createWatchHistoryStorage,
	watchHistoryPartitionKey,
	type WatchHistoryStorageRoot,
} from "../src/watch-history-storage";

const OWNER = "00000000-0000-4000-8000-000000000001";
const OTHER_OWNER = "00000000-0000-4000-8000-000000000002";
const GROUP = "00000000-0000-4000-8000-000000000003";
const PARTICIPANT = "00000000-0000-4000-8000-000000000004";
const NOW = "2026-09-05T08:00:00.000Z";

const session = {
	accessToken: "access-token",
	refreshToken: "refresh-token",
	user: {
		id: OWNER,
		email: "alina@example.com",
		displayName: "Alina",
		avatarUrl: null,
		plan: "plus" as const,
	},
};

function meta(accountGeneration = 4, ownerUserId = OWNER) {
	return {
		serverTime: NOW,
		schemaVersion: 3 as const,
		ownerUserId,
		accountGeneration,
	};
}

function canonical(accountGeneration = 4) {
	return {
		meta: meta(accountGeneration),
		generatedAt: NOW,
		totalTitleCount: 0,
		items: [],
		nextCursor: null,
	};
}

function browseResponse(accountGeneration = 4) {
	return { history: canonical(accountGeneration), matches: [] };
}

function titleEpisodesResponse(accountGeneration = 4) {
	return {
		detail: {
			meta: meta(accountGeneration),
			generatedAt: NOW,
			provider: "crunchyroll" as const,
			titleKey: "crunchyroll:series:S",
			observedEpisodeCount: 0,
			completedEpisodeCount: 0,
			episodes: [],
			catalog: {
				state: "unavailable" as const,
				title: null,
				aggregate: null,
				seasons: [],
			},
			complete: true,
			nextCursor: null,
		},
		matches: [],
		groups: [],
	};
}

function sessionsResponse(accountGeneration = 4) {
	return {
		meta: meta(accountGeneration),
		sessions: [],
		groups: [],
		totalSessionCount: 0,
		nextCursor: null,
	};
}

function optionsResponse(accountGeneration = 4) {
	return {
		meta: meta(accountGeneration),
		options: [],
		nextCursor: null,
	};
}

function readyPartition(cache = canonical()) {
	return {
		ownerUserId: OWNER,
		accountGeneration: 4,
		cache,
		cacheRevision: 7,
		invalidationRevision: 7,
		preferences: { youtubeHistoryEnabled: false },
		preferencesConfirmed: true,
		preferencesSyncPending: false,
		preferencesLocalRevision: 1,
		currentObservation: null,
		capturePaused: false,
		captureMarkersReady: true,
		outbox: { ownerUserId: OWNER, accountGeneration: 4, entries: [] },
	};
}

function createStoredClient(input?: {
	fetch?: typeof fetch;
	getCurrentSession?: () => Promise<typeof session | null>;
	root?: WatchHistoryStorageRoot;
	onRead?: () => void;
	onWrite?: () => void;
}) {
	let stored: WatchHistoryStorageRoot = input?.root ?? {
		schemaVersion: 3,
		activeGenerations: { [OWNER]: 4 },
		partitions: {
			[watchHistoryPartitionKey(OWNER, 4)]: readyPartition(),
		},
	};
	const storage = createWatchHistoryStorage({
		item: {
			getValue: async () => {
				input?.onRead?.();
				return stored;
			},
			setValue: async (value) => {
				input?.onWrite?.();
				stored = value;
			},
		},
		getBytesInUse: async () => 0,
		quotaBytes: 1_000_000,
	});
	return {
		client: createWatchHistoryClient({
			getCurrentSession: input?.getCurrentSession ?? (async () => session),
			storage,
			fetch: input?.fetch ?? (async () => Response.json(browseResponse())),
		}),
		storage,
		readRoot: () => stored,
		replaceRoot: (next: WatchHistoryStorageRoot) => {
			stored = next;
		},
	};
}

function browseMessage(input: unknown = { mode: "shared" }) {
	return {
		type: "ANIDACHI_WATCH_HISTORY_V3",
		command: "browse",
		expectedOwnerUserId: OWNER,
		input,
	} as const;
}

describe("watch history query-isolated browsing", () => {
	it("rechecks authentication after retrieving a cached response", async () => {
		let current: typeof session | null = session;
		let cacheRead = false;
		let reads = 0;
		const { client } = createStoredClient({
			getCurrentSession: async () => current,
			onRead: () => { if (cacheRead && ++reads === 2) current = null; },
		});
		await client.handle(browseMessage());
		cacheRead = true;
		expect(await client.handle({ ...browseMessage(), cacheOnly: true })).toEqual({ ok: false, status: "rejected" });
	});

	it("serves a completed query locally without another HTTP read and keeps refresh explicit", async () => {
		const fetchImpl = vi.fn(async () => Response.json(browseResponse()));
		const { client, readRoot } = createStoredClient({ fetch: fetchImpl });
		const before = structuredClone(readRoot());
		await client.handle(browseMessage());
		const cached = await client.handle({ ...browseMessage(), cacheOnly: true });
		expect(cached).toMatchObject({
			ok: true,
			data: browseResponse(),
			cachedAt: expect.any(Number),
		});
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(readRoot()).toEqual(before);
		await client.handle(browseMessage());
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it("never reuses query results across filters, auth sessions or invalidation", async () => {
		let current = session;
		const fetchImpl = vi.fn(async () => Response.json(browseResponse()));
		const { client, readRoot, replaceRoot } = createStoredClient({
			fetch: fetchImpl,
			getCurrentSession: async () => current,
		});
		await client.handle(browseMessage());
		expect(
			await client.handle({
				...browseMessage({ mode: "solo" }),
				cacheOnly: true,
			}),
		).toEqual({ ok: true });
		current = { ...session, refreshToken: "new-login" };
		expect(
			await client.handle({ ...browseMessage(), cacheOnly: true }),
		).toEqual({ ok: true });
		current = session;
		const changed = structuredClone(readRoot());
		changed.partitions[
			watchHistoryPartitionKey(OWNER, 4)
		]!.invalidationRevision = 8;
		replaceRoot(changed);
		expect(
			await client.handle({ ...browseMessage(), cacheOnly: true }),
		).toEqual({ ok: true });
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it("strictly validates all four owner-bound browse commands", () => {
		expect(isWatchHistoryMessage(browseMessage())).toBe(true);
		expect(
			isWatchHistoryMessage({
				type: "ANIDACHI_WATCH_HISTORY_V3",
				command: "browse-title-episodes",
				expectedOwnerUserId: OWNER,
				input: {
					mode: "shared",
					provider: "crunchyroll",
					titleKey: "crunchyroll:series:S",
				},
			}),
		).toBe(true);
		expect(
			isWatchHistoryMessage({
				type: "ANIDACHI_WATCH_HISTORY_V3",
				command: "browse-sessions",
				expectedOwnerUserId: OWNER,
				input: {
					mode: "shared",
					provider: "crunchyroll",
					titleKey: "crunchyroll:series:S",
					episodeKey: "crunchyroll:episode:E",
				},
			}),
		).toBe(true);
		expect(
			isWatchHistoryMessage({
				type: "ANIDACHI_WATCH_HISTORY_V3",
				command: "browse-options",
				expectedOwnerUserId: OWNER,
				input: { mode: "shared" },
			}),
		).toBe(true);

		expect(
			isWatchHistoryMessage(browseMessage({ mode: "solo", groupId: GROUP })),
		).toBe(false);
		expect(
			isWatchHistoryMessage(browseMessage({ mode: "shared", limit: 0 })),
		).toBe(false);
		expect(
			isWatchHistoryMessage({
				type: "ANIDACHI_WATCH_HISTORY_V3",
				command: "browse",
				input: { mode: "shared" },
			}),
		).toBe(false);
		expect(
			isWatchHistoryMessage({
				type: "ANIDACHI_WATCH_HISTORY_V3",
				command: "browse-options",
				expectedOwnerUserId: OWNER,
				input: { mode: "shared", search: "not allowed" },
			}),
		).toBe(false);
	});

	it("rejects a foreign-owner browse before local history or network reads", async () => {
		let reads = 0;
		const fetchImpl = vi.fn();
		const { client } = createStoredClient({
			fetch: fetchImpl as typeof fetch,
			onRead: () => {
				reads += 1;
			},
		});
		const foreignOwnerBrowse = {
			...browseMessage(),
			expectedOwnerUserId: OTHER_OWNER,
		} as never;

		expect(await client.handle(foreignOwnerBrowse)).toMatchObject({
			ok: false,
			status: "rejected",
		});
		expect(reads).toBe(0);
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("rejects foreign-owner preference commands before local reads or writes and keeps old callers compatible", async () => {
		let reads = 0;
		let writes = 0;
		const { client } = createStoredClient({
			onRead: () => {
				reads += 1;
			},
			onWrite: () => {
				writes += 1;
			},
		});

		await expect(
			client.handle({
				type: "ANIDACHI_WATCH_HISTORY_V3",
				command: "get-preferences",
				expectedOwnerUserId: OTHER_OWNER,
			} as never),
		).resolves.toEqual({ ok: false, status: "rejected" });
		await expect(
			client.handle({
				type: "ANIDACHI_WATCH_HISTORY_V3",
				command: "update-preferences",
				expectedOwnerUserId: OTHER_OWNER,
				input: { youtubeHistoryEnabled: true },
			} as never),
		).resolves.toEqual({ ok: false, status: "rejected" });
		expect(reads).toBe(0);
		expect(writes).toBe(0);

		await expect(
			client.handle({
				type: "ANIDACHI_WATCH_HISTORY_V3",
				command: "get-preferences",
			}),
		).resolves.toMatchObject({
			ok: true,
			data: { preferences: { youtubeHistoryEnabled: false } },
		});
		await expect(
			client.handle({
				type: "ANIDACHI_WATCH_HISTORY_V3",
				command: "update-preferences",
				input: { youtubeHistoryEnabled: true },
			}),
		).resolves.toEqual({ ok: true });
		expect(writes).toBeGreaterThan(0);
	});

	it("routes the four validated GET DTOs without replacing the canonical cache", async () => {
		const canonicalBefore = canonical();
		const requests: string[] = [];
		const fetchImpl: typeof fetch = async (rawUrl) => {
			const url = new URL(String(rawUrl));
			requests.push(`${url.pathname}${url.search}`);
			if (url.pathname.endsWith("/title-episodes"))
				return Response.json(titleEpisodesResponse());
			if (url.pathname.endsWith("/sessions"))
				return Response.json(sessionsResponse());
			if (url.pathname.endsWith("/options"))
				return Response.json(optionsResponse());
			return Response.json(browseResponse());
		};
		const { client, storage } = createStoredClient({
			fetch: fetchImpl,
			root: {
				schemaVersion: 3,
				activeGenerations: { [OWNER]: 4 },
				partitions: {
					[watchHistoryPartitionKey(OWNER, 4)]: readyPartition(canonicalBefore),
				},
			},
		});
		const common = {
			mode: "shared",
			search: "Title",
			groupId: GROUP,
			participantUserId: PARTICIPANT,
			from: "2026-09-01T00:00:00.000Z",
			until: "2026-10-01T00:00:00.000Z",
			limit: 20,
		} as const;

		await expect(client.handle(browseMessage(common))).resolves.toEqual({
			ok: true,
			data: browseResponse(),
		});
		await expect(
			client.handle({
				type: "ANIDACHI_WATCH_HISTORY_V3",
				command: "browse-title-episodes",
				expectedOwnerUserId: OWNER,
				input: {
					...common,
					provider: "crunchyroll",
					titleKey: "crunchyroll:series:S",
					cursor: "episode-page-2",
				},
			} as never),
		).resolves.toEqual({ ok: true, data: titleEpisodesResponse() });
		await expect(
			client.handle({
				type: "ANIDACHI_WATCH_HISTORY_V3",
				command: "browse-sessions",
				expectedOwnerUserId: OWNER,
				input: {
					...common,
					provider: "crunchyroll",
					titleKey: "crunchyroll:series:S",
					episodeKey: "crunchyroll:episode:E",
				},
			} as never),
		).resolves.toEqual({ ok: true, data: sessionsResponse() });
		await expect(
			client.handle({
				type: "ANIDACHI_WATCH_HISTORY_V3",
				command: "browse-options",
				expectedOwnerUserId: OWNER,
				input: { mode: "shared", limit: 20, cursor: "options-page-2" },
			} as never),
		).resolves.toEqual({ ok: true, data: optionsResponse() });

		expect(requests).toEqual([
			`/api/watch-history/v3/browse?mode=shared&search=Title&groupId=${GROUP}&participantUserId=${PARTICIPANT}&from=2026-09-01T00%3A00%3A00.000Z&until=2026-10-01T00%3A00%3A00.000Z&limit=20`,
			`/api/watch-history/v3/browse/title-episodes?mode=shared&search=Title&groupId=${GROUP}&participantUserId=${PARTICIPANT}&from=2026-09-01T00%3A00%3A00.000Z&until=2026-10-01T00%3A00%3A00.000Z&limit=20&cursor=episode-page-2&provider=crunchyroll&titleKey=crunchyroll%3Aseries%3AS`,
			`/api/watch-history/v3/browse/sessions?mode=shared&search=Title&groupId=${GROUP}&participantUserId=${PARTICIPANT}&from=2026-09-01T00%3A00%3A00.000Z&until=2026-10-01T00%3A00%3A00.000Z&limit=20&provider=crunchyroll&titleKey=crunchyroll%3Aseries%3AS&episodeKey=crunchyroll%3Aepisode%3AE`,
			"/api/watch-history/v3/browse/options?mode=shared&limit=20&cursor=options-page-2",
		]);
		expect(
			(await storage.readRoot()).partitions[watchHistoryPartitionKey(OWNER, 4)]
				?.cache,
		).toEqual(canonicalBefore);
	});

	it("releases a failed identical flight for retry and rejects malformed response DTOs", async () => {
		let attempt = 0;
		const { client } = createStoredClient({
			fetch: async () => {
				attempt += 1;
				if (attempt === 1) return new Response("offline", { status: 503 });
				if (attempt === 2)
					return Response.json({ ...browseResponse(), unexpected: true });
				return Response.json(browseResponse());
			},
		});

		await expect(client.handle(browseMessage())).resolves.toEqual({
			ok: false,
			status: "retryable",
		});
		await expect(client.handle(browseMessage())).resolves.toEqual({
			ok: false,
			status: "invalid-response",
		});
		await expect(client.handle(browseMessage())).resolves.toEqual({
			ok: true,
			data: browseResponse(),
		});
		expect(attempt).toBe(3);
	});

	it("coalesces only identical requests while pagination and filter switches proceed independently", async () => {
		const pending = new Map<string, Array<(response: Response) => void>>();
		const fetchImpl: typeof fetch = async (rawUrl) => {
			const path = new URL(String(rawUrl)).search;
			return new Promise<Response>((resolve) => {
				pending.set(path, [...(pending.get(path) ?? []), resolve]);
			});
		};
		const { client } = createStoredClient({ fetch: fetchImpl });
		const firstInput = { mode: "shared", search: "First", limit: 20 };
		const identicalOne = client.handle(browseMessage(firstInput));
		const identicalTwo = client.handle(browseMessage(firstInput));
		const changedFilter = client.handle(
			browseMessage({ mode: "shared", search: "Second", limit: 20 }),
		);
		const nextPage = client.handle(
			browseMessage({ ...firstInput, cursor: "titles-page-2" }),
		);

		await vi.waitFor(() => expect(pending.size).toBe(3));
		expect([...pending.values()].map((resolvers) => resolvers.length)).toEqual([
			1, 1, 1,
		]);
		for (const resolvers of pending.values()) {
			for (const resolve of resolvers) resolve(Response.json(browseResponse()));
		}
		await expect(
			Promise.all([identicalOne, identicalTwo, changedFilter, nextPage]),
		).resolves.toEqual([
			{ ok: true, data: browseResponse() },
			{ ok: true, data: browseResponse() },
			{ ok: true, data: browseResponse() },
			{ ok: true, data: browseResponse() },
		]);
	});

	it("rejects late browse results after account, generation, or invalidation authority changes", async () => {
		for (const change of ["account", "generation", "invalidation"] as const) {
			let currentSession: typeof session | null = session;
			let release!: (response: Response) => void;
			const setup = createStoredClient({
				getCurrentSession: async () => currentSession,
				fetch: async () =>
					new Promise<Response>((resolve) => {
						release = resolve;
					}),
			});
			const browsing = setup.client.handle(browseMessage());
			await vi.waitFor(() => expect(release).toBeTypeOf("function"));

			if (change === "account") {
				currentSession = {
					...session,
					accessToken: "other-access",
					refreshToken: "other-refresh",
					user: { ...session.user, id: OTHER_OWNER },
				};
			} else {
				const root = setup.readRoot();
				setup.replaceRoot(
					change === "generation"
						? {
								...root,
								activeGenerations: { ...root.activeGenerations, [OWNER]: 5 },
								partitions: {
									...root.partitions,
									[watchHistoryPartitionKey(OWNER, 5)]: {
										...readyPartition(),
										accountGeneration: 5,
										outbox: {
											ownerUserId: OWNER,
											accountGeneration: 5,
											entries: [],
										},
									},
								},
							}
						: {
								...root,
								partitions: {
									...root.partitions,
									[watchHistoryPartitionKey(OWNER, 4)]: {
										...readyPartition(),
										invalidationRevision: 8,
									},
								},
							},
				);
			}
			release(Response.json(browseResponse()));
			await expect(browsing).resolves.toEqual(
				change === "account"
					? { ok: false, status: "rejected" }
					: change === "generation"
						? { ok: false, status: "generation-mismatch" }
						: { ok: false, status: "superseded" },
			);
		}
	});

	it("rejects an account switch while the final authority storage read is pending", async () => {
		const otherSession = {
			...session,
			accessToken: "other-access",
			refreshToken: "other-refresh",
			user: { ...session.user, id: OTHER_OWNER },
		};
		let currentSession: typeof session | null = session;
		let reads = 0;
		let releaseFinalRead!: () => void;
		const root: WatchHistoryStorageRoot = {
			schemaVersion: 3,
			activeGenerations: { [OWNER]: 4 },
			partitions: {},
		};
		root.partitions[watchHistoryPartitionKey(OWNER, 4)] = readyPartition();
		const storage = createWatchHistoryStorage({
			item: {
				getValue: async () => {
					reads += 1;
					if (reads === 3) {
						await new Promise<void>((resolve) => {
							releaseFinalRead = resolve;
						});
					}
					return root;
				},
				setValue: async () => undefined,
			},
			getBytesInUse: async () => 0,
			quotaBytes: 1_000_000,
		});
		const client = createWatchHistoryClient({
			getCurrentSession: async () => currentSession,
			storage,
			fetch: async () => Response.json(browseResponse()),
		});

		const browsing = client.handle(browseMessage());
		await vi.waitFor(() => expect(releaseFinalRead).toBeTypeOf("function"));
		currentSession = otherSession;
		releaseFinalRead();

		await expect(browsing).resolves.toEqual({ ok: false, status: "rejected" });
	});

	it("bootstraps a missing local generation from existing preference authority before browsing", async () => {
		const requests: string[] = [];
		const { client, storage } = createStoredClient({
			root: { schemaVersion: 3, activeGenerations: {}, partitions: {} },
			fetch: async (rawUrl) => {
				const pathname = new URL(String(rawUrl)).pathname;
				requests.push(pathname);
				return pathname.endsWith("/preferences")
					? Response.json({
							meta: meta(4),
							preferences: { youtubeHistoryEnabled: false },
						})
					: Response.json(browseResponse(4));
			},
		});

		await expect(client.handle(browseMessage())).resolves.toEqual({
			ok: true,
			data: browseResponse(4),
		});
		expect(requests).toEqual([
			"/api/watch-history/v3/preferences",
			"/api/watch-history/v3/browse",
		]);
		const root = await storage.readRoot();
		expect(root.activeGenerations).toEqual({ [OWNER]: 4 });
		expect(root.partitions).not.toHaveProperty(
			watchHistoryPartitionKey(OWNER, 1),
		);
	});
});
