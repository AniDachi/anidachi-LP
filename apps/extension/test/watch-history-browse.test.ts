import { describe, expect, it, vi } from "vitest";
import { createWatchHistoryBrowseCache } from "../src/watch-history-browse-cache";
import {
	createWatchHistoryClient,
	handleWatchHistoryAuthSessionChange,
	isWatchHistoryMessage,
} from "../src/watch-history-client";
import {
	createWatchHistoryStorage,
	type WatchHistoryStorageRoot,
	watchHistoryPartitionKey,
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
	browseCache?: ReturnType<typeof createWatchHistoryBrowseCache>;
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
			browseCache: input?.browseCache,
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

function required<T>(value: T | undefined): T {
	if (value === undefined) throw new Error("Required fixture value is missing");
	return value;
}

describe("watch history query-isolated browsing", () => {
	it("cannot resurrect deleted reads after real logout and same-generation login recreate the partition", async () => {
		let saved: unknown = [];
		const adapter = {
			read: async () => saved,
			write: async (value: unknown) => {
				saved = structuredClone(value);
			},
		};
		let current: typeof session | null = session;
		let release: ((response: Response) => void) | undefined;
		const target = {
			scope: "title",
			provider: "crunchyroll",
			titleKey: "crunchyroll:series:S",
		};
		const request: typeof fetch = async (url) => {
			if (new URL(String(url)).searchParams.get("search") === "held")
				return new Promise<Response>((resolve) => {
					release = resolve;
				});
			const path = new URL(String(url)).pathname;
			return Response.json(
				path.endsWith("/delete")
					? {
							meta: meta(),
							schemaVersion: 3,
							accountGeneration: 4,
							clientMutationId: GROUP,
							target,
							deletedAt: NOW,
						}
					: path.endsWith("/preferences")
						? { meta: meta(), preferences: { youtubeHistoryEnabled: false } }
						: path.endsWith("/browse")
							? browseResponse()
							: canonical(),
			);
		};
		const setup = createStoredClient({
			root: { schemaVersion: 3, partitions: {} },
			getCurrentSession: async () => current,
			fetch: request,
			browseCache: createWatchHistoryBrowseCache(adapter),
		});
		const dependencies = {
			storage: setup.storage,
			getCurrentSession: async () => current,
			fetch: request,
		};
		expect(
			await handleWatchHistoryAuthSessionChange(null, session, dependencies),
		).toMatchObject({ ok: true });
		await setup.client.handle(browseMessage());
		expect(
			await setup.client.handle({ ...browseMessage(), cacheOnly: true }),
		).toHaveProperty("data");
		current = {
			...session,
			accessToken: "rotated-access",
			refreshToken: "rotated-refresh",
		};
		expect(
			await handleWatchHistoryAuthSessionChange(session, current, dependencies),
		).toMatchObject({ ok: true });
		expect(
			await setup.client.handle({ ...browseMessage(), cacheOnly: true }),
		).toHaveProperty("data");
		const signedIn = current;
		const late = setup.client.handle(
			browseMessage({ mode: "shared", search: "held" }),
		);
		await vi.waitFor(() => expect(release).toBeTypeOf("function"));
		expect(
			await setup.client.handle({
				type: "ANIDACHI_WATCH_HISTORY_V3",
				command: "delete",
				input: {
					schemaVersion: 3,
					accountGeneration: 4,
					clientMutationId: GROUP,
					target,
					requestedAt: NOW,
				},
			}),
		).toMatchObject({ ok: true });
		current = null;
		expect(
			await handleWatchHistoryAuthSessionChange(signedIn, null, dependencies),
		).toMatchObject({ ok: true });
		expect(
			setup.readRoot().partitions[watchHistoryPartitionKey(OWNER, 4)],
		).toBeUndefined();
		current = signedIn;
		expect(
			await handleWatchHistoryAuthSessionChange(null, signedIn, dependencies),
		).toMatchObject({ ok: true });
		required(release)(Response.json(browseResponse()));
		expect(await late).toEqual({ ok: false, status: "superseded" });
		const restarted = createWatchHistoryClient({
			...dependencies,
			browseCache: createWatchHistoryBrowseCache(adapter),
		});
		for (const client of [setup.client, restarted]) {
			expect(
				await client.handle({ ...browseMessage(), cacheOnly: true }),
			).not.toHaveProperty("data");
		}
	});
	it("does not restore persistent reads after an acknowledged deletion or consent change", async () => {
		let saved: unknown = [];
		const adapter = {
			read: async () => saved,
			write: async (value: unknown) => {
				saved = structuredClone(value);
			},
		};
		const target = {
			scope: "title",
			provider: "crunchyroll",
			titleKey: "crunchyroll:series:S",
		};
		const setup = createStoredClient({
			browseCache: createWatchHistoryBrowseCache(adapter),
			fetch: async (url) =>
				Response.json(
					String(url).endsWith("/delete")
						? {
								meta: meta(),
								schemaVersion: 3,
								accountGeneration: 4,
								clientMutationId: GROUP,
								target,
								deletedAt: NOW,
							}
						: browseResponse(),
				),
		});
		await setup.client.handle(browseMessage());
		expect(
			await setup.client.handle({ ...browseMessage(), cacheOnly: true }),
		).toHaveProperty("data");
		expect(
			await setup.client.handle({
				type: "ANIDACHI_WATCH_HISTORY_V3",
				command: "delete",
				input: {
					schemaVersion: 3,
					accountGeneration: 4,
					clientMutationId: GROUP,
					target,
					requestedAt: NOW,
				},
			}),
		).toMatchObject({ ok: true });
		const restart = () =>
			createWatchHistoryClient({
				getCurrentSession: async () => session,
				storage: setup.storage,
				browseCache: createWatchHistoryBrowseCache(adapter),
				fetch: async () => Response.json(browseResponse()),
			});
		let restarted = restart();
		expect(
			await restarted.handle({ ...browseMessage(), cacheOnly: true }),
		).not.toHaveProperty("data");
		await restarted.handle(browseMessage());
		const partition = required(
			setup.readRoot().partitions[watchHistoryPartitionKey(OWNER, 4)],
		);
		partition.preferencesLocalRevision = 2;
		partition.preferences = { youtubeHistoryEnabled: true };
		restarted = restart();
		expect(
			await restarted.handle({ ...browseMessage(), cacheOnly: true }),
		).not.toHaveProperty("data");
	});
	it("retains both modes and unrelated title details across accepted progress and worker recreation", async () => {
		let saved: unknown = [];
		const adapter = {
			read: async () => saved,
			write: async (value: unknown) => {
				saved = structuredClone(value);
			},
		};
		const event = {
			schemaVersion: 3,
			clientEventId: GROUP,
			clientSessionKey: "watch-session",
			accountGeneration: 4,
			provider: "youtube",
			youtubeVideoId: "new",
			titleKey: "youtube:video:new",
			itemKind: "movie",
			title: "New video",
			artworkUrl: null,
			episodeKey: "youtube:video:new",
			episodeTitle: "New video",
			seasonKey: null,
			seasonTitle: null,
			seasonNumber: null,
			episodeNumber: null,
			sourceUrl: "https://www.youtube.com/watch?v=new",
			currentTime: 12,
			duration: 120,
			progress: 0.1,
			observedAt: NOW,
			kind: "heartbeat",
		};
		const request: typeof fetch = async (url) => {
			if (String(url).endsWith("/progress"))
				return Response.json({
					meta: meta(),
					schemaVersion: 3,
					accountGeneration: 4,
					acceptedEventId: GROUP,
					acceptedAt: NOW,
					duplicate: false,
					episode: {
						episodeKey: event.episodeKey,
						episodeTitle: event.title,
						seasonKey: null,
						seasonTitle: null,
						seasonNumber: null,
						episodeNumber: null,
						sourceUrl: event.sourceUrl,
						currentTime: 12,
						duration: 120,
						progress: 0.1,
						completedAt: null,
						lastWatchedAt: NOW,
						sessions: [],
					},
				});
			return Response.json(
				String(url).includes("title-episodes")
					? titleEpisodesResponse()
					: browseResponse(),
			);
		};
		const setup = createStoredClient({
			fetch: request,
			browseCache: createWatchHistoryBrowseCache(adapter),
		});
		required(
			setup.readRoot().partitions[watchHistoryPartitionKey(OWNER, 4)],
		).preferences = { youtubeHistoryEnabled: true };
		const oldTitle = {
			...browseMessage({
				mode: "solo",
				provider: "crunchyroll",
				titleKey: "crunchyroll:series:S",
			}),
			command: "browse-title-episodes",
		} as const;
		await setup.client.handle(browseMessage({ mode: "solo" }));
		await setup.client.handle(browseMessage());
		await setup.client.handle(oldTitle);
		expect(
			await setup.client.handle({
				type: "ANIDACHI_WATCH_HISTORY_V3",
				command: "enqueue-progress",
				expectedOwnerUserId: OWNER,
				event,
			}),
		).toEqual({ ok: true, flushed: 1 });
		const restarted = createWatchHistoryClient({
			getCurrentSession: async () => session,
			storage: setup.storage,
			browseCache: createWatchHistoryBrowseCache(adapter),
			fetch: async () => {
				throw new Error("Cache-only reads must not use the network");
			},
		});
		for (const message of [browseMessage({ mode: "solo" }), browseMessage()]) {
			expect(
				await restarted.handle({ ...message, cacheOnly: true }),
			).toMatchObject({ ok: true, data: browseResponse(), cachedAt: 0 });
		}
		const cached = await restarted.handle({ ...oldTitle, cacheOnly: true });
		expect(cached).toMatchObject({ ok: true, data: titleEpisodesResponse() });
		expect(cached.ok && cached.cachedAt).toBeGreaterThan(0);
		expect(
			setup.readRoot().partitions[watchHistoryPartitionKey(OWNER, 4)]?.outbox
				.entries,
		).toHaveLength(0);
	});
	it("rechecks authentication after retrieving a cached response", async () => {
		let current: typeof session | null = session;
		let cacheRead = false;
		let reads = 0;
		const { client } = createStoredClient({
			getCurrentSession: async () => current,
			onRead: () => {
				if (cacheRead && ++reads === 2) current = null;
			},
		});
		await client.handle(browseMessage());
		cacheRead = true;
		expect(
			await client.handle({ ...browseMessage(), cacheOnly: true }),
		).toEqual({ ok: false, status: "rejected" });
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

	it("isolates filters and hard invalidation while retaining same-owner reads after token rotation", async () => {
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
		).toMatchObject({ ok: true, data: browseResponse() });
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
			`/api/watch-history/v3/browse?mode=shared&search=Title&groupId=${GROUP}&participantUserId=${PARTICIPANT}&from=2026-09-01T00%3A00%3A00.000Z&until=2026-10-01T00%3A00%3A00.000Z&limit=20&includeEpisodePreviews=true`,
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
