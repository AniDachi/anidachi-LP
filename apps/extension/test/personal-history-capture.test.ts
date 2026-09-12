import { describe, expect, it, vi } from "vitest";
import { createWatchHistoryController } from "../src/watch-history-controller";
import { createWatchHistoryClient } from "../src/watch-history-client";
import {
	createWatchHistoryStorage,
	watchHistoryPartitionKey,
	type WatchHistoryStorageRoot,
} from "../src/watch-history-storage";
import {
	paidHistoryLease,
	historyOwner as owner,
} from "./watch-history-personal-fixtures";
import type { WatchHistoryLocalEvent } from "../src/watch-history-outbox";

function fixture() {
	let now = Date.parse("2026-09-08T10:00:00Z");
	let lease = paidHistoryLease(owner, now);
	let currentOwner = owner;
	const key = watchHistoryPartitionKey(owner, 1);
	let root: WatchHistoryStorageRoot = {
		schemaVersion: 3,
		activeGenerations: { [owner]: 1 },
		partitions: {
			[key]: {
				ownerUserId: owner,
				accountGeneration: 1,
				accessLease: lease,
				preferences: { youtubeHistoryEnabled: true },
				preferencesConfirmed: true,
				capturePaused: false,
				captureMarkersReady: true,
				cache: null,
				currentObservation: null,
				outbox: { ownerUserId: owner, accountGeneration: 1, entries: [] },
			},
		},
	};
	const storage = createWatchHistoryStorage({
		item: {
			getValue: async () => root,
			setValue: async (next) => {
				root = structuredClone(next);
			},
		},
		quotaBytes: 1_000_000,
		getBytesInUse: async () => 0,
	});
	const posts: unknown[] = [];
	let unavailable = false;
	const request = vi.fn(
		async (input: RequestInfo | URL, init?: RequestInit) => {
			if (String(input).endsWith("/access"))
				return unavailable
					? new Response("{}", { status: 503 })
					: new Response(JSON.stringify(lease.access));
			posts.push(JSON.parse(String(init?.body)));
			return new Response("{}", { status: 503 });
		},
	);
	const session = () =>
		Promise.resolve({
			accessToken: "token",
			refreshToken: "refresh",
			user: { id: currentOwner },
		} as never);
	const client = () =>
		createWatchHistoryClient({
			storage,
			getCurrentSession: session,
			now: () => now,
			fetch: request as typeof fetch,
		});
	function event(
		sequence = 1,
		provider: "youtube" | "crunchyroll" = "youtube",
	): WatchHistoryLocalEvent {
		return {
			schemaVersion: 3,
			captureProof: structuredClone(lease),
			clientSequence: sequence,
			clientEventId: crypto.randomUUID(),
			clientSessionKey: "session-a",
			accountGeneration: 1,
			provider,
			titleKey: "youtube:video:abcdefghijk",
			itemKind: "movie",
			title: "Video",
			artworkUrl: null,
			episodeKey: "youtube:video:abcdefghijk",
			episodeTitle: "Video",
			seasonKey: null,
			seasonTitle: null,
			seasonNumber: null,
			episodeNumber: null,
			sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
			youtubeVideoId: "abcdefghijk",
			currentTime: 10,
			duration: 100,
			progress: 0.1,
			observedAt: new Date(now).toISOString(),
			kind: "heartbeat",
		};
	}
	return {
		client,
		storage,
		event,
		posts,
		request,
		key,
		get root() {
			return root;
		},
		get lease() {
			return lease;
		},
		get now() {
			return now;
		},
		setNow(value: number) {
			now = value;
		},
		setLease(next: typeof lease) {
			lease = next;
		},
		setOwner(next: string) {
			currentOwner = next;
		},
		unavailable() {
			unavailable = true;
		},
	};
}
const observe = (event: WatchHistoryLocalEvent) => ({
	type: "ANIDACHI_WATCH_HISTORY_V3" as const,
	command: "observe-progress" as const,
	expectedOwnerUserId: owner,
	event,
	queueForSync: true,
});
describe("personal history recorder/background integration", () => {
	it("Free never observes, discovers, or persists for any playback or room lifecycle", async () => {
		const f = fixture();
		const lease = {
			...f.lease,
			access: { ...f.lease.access, state: "plan_required" as const },
		};
		const observation = vi.fn();
		const persist = vi.fn();
		const catalog = vi.fn();
		const controller = createWatchHistoryController({
			now: () => f.now,
			getObservation: observation,
			observeLocally: persist,
			onPersisted: catalog,
			getRoomActive: () => true,
			isPlaying: () => true,
			isSeeking: () => false,
			loadPreferences: async () => ({
				ownerUserId: owner,
				accountGeneration: 1,
				preferences: { youtubeHistoryEnabled: true },
				accessLease: lease,
			}),
		});
		await controller.start();
		for (const kind of [
			"heartbeat",
			"pause",
			"ended",
			"source_change",
			"room_leave",
		] as const)
			await controller.observe(kind);
		await controller.setRoomActive(false);
		await controller.dispose();
		expect(observation).not.toHaveBeenCalled();
		expect(persist).not.toHaveBeenCalled();
		expect(catalog).not.toHaveBeenCalled();
	});
	it("retries the exact envelope after worker recreation without changing epochs/id/sequence", async () => {
		const f = fixture();
		const event = f.event();
		expect(await f.client().handle(observe(event))).toEqual({ ok: true });
		await f
			.client()
			.handle({ type: "ANIDACHI_WATCH_HISTORY_V3", command: "flush" });
		await f
			.client()
			.handle({ type: "ANIDACHI_WATCH_HISTORY_V3", command: "flush" });
		expect(f.posts).toHaveLength(2);
		expect(f.posts[0]).toEqual(f.posts[1]);
		expect(f.posts[0]).toMatchObject({
			captureVersion: 1,
			accessEpoch: 1,
			youtubeConsentEpoch: 1,
			clientSequence: 1,
			event: { clientEventId: event.clientEventId },
		});
		expect((f.posts[0] as { event: object }).event).not.toHaveProperty(
			"captureProof",
		);
		expect((f.posts[0] as { event: object }).event).not.toHaveProperty(
			"sharedRoom",
		);
	});
	it("rejects an old same-session callback arriving after a newer checkpoint", async () => {
		const f = fixture();
		const older = f.event(1);
		const newer = { ...f.event(2), currentTime: 20, progress: 0.2 };
		await f.client().handle(observe(newer));
		expect(await f.client().handle(observe(older))).toMatchObject({
			ok: false,
		});
		expect(f.root.partitions[f.key]!.currentObservation?.currentTime).toBe(20);
		expect(
			f.root.partitions[f.key]!.outbox.entries[0]!.request?.clientSequence,
		).toBe(2);
	});
	it("expires across restart without queue loss or allowing a late event to gain fresh eligibility", async () => {
		const f = fixture();
		const event = f.event();
		await f.client().handle(observe(event));
		const queue = structuredClone(f.root.partitions[f.key]!.outbox);
		f.setNow(f.now + 300_000);
		f.unavailable();
		expect(
			await f.client().handle(
				observe({
					...event,
					clientEventId: crypto.randomUUID(),
					clientSequence: 2,
				}),
			),
		).toMatchObject({ ok: false, status: "access-unavailable" });
		expect(
			await f
				.client()
				.handle({ type: "ANIDACHI_WATCH_HISTORY_V3", command: "flush" }),
		).toMatchObject({ ok: false, status: "access-unavailable" });
		expect(f.root.partitions[f.key]!.outbox).toEqual(queue);
		expect(f.posts).toEqual([]);
	});
	it("invalid access refresh pauses existing capture without discarding eligible work", async () => {
		const f = fixture();
		await f.client().handle(observe(f.event()));
		const queue = structuredClone(f.root.partitions[f.key]!.outbox);
		f.request.mockImplementationOnce(async () =>
			Response.json({ invalid: true }),
		);
		await f.client().handle({
			type: "ANIDACHI_WATCH_HISTORY_V3",
			command: "bootstrap",
			expectedOwnerUserId: owner,
		});
		expect(f.root.partitions[f.key]!.accessLease).toBeNull();
		expect(f.root.partitions[f.key]!.outbox).toEqual(queue);
	});
	it("ignores a successful late receipt after confirmed Free closed the capture epoch", async () => {
		const f = fixture();
		const event = f.event();
		await f.client().handle(observe(event));
		let release!: (response: Response) => void;
		f.request.mockImplementationOnce(
			async () =>
				new Promise<Response>((resolve) => {
					release = resolve;
				}),
		);
		const pending = f
			.client()
			.handle({ type: "ANIDACHI_WATCH_HISTORY_V3", command: "flush" });
		await vi.waitFor(() => expect(release).toBeTypeOf("function"));
		f.setLease({
			...f.lease,
			access: { ...f.lease.access, state: "plan_required", accessEpoch: 2 },
		});
		await f
			.client()
			.handle({
				type: "ANIDACHI_WATCH_HISTORY_V3",
				command: "bootstrap",
				expectedOwnerUserId: owner,
			});
		const closed = structuredClone(f.root.partitions[f.key]);
		release(
			Response.json({
				meta: {
					schemaVersion: 3,
					ownerUserId: owner,
					accountGeneration: 1,
					serverTime: event.observedAt,
				},
				schemaVersion: 3,
				acceptedEventId: event.clientEventId,
				acceptedAt: event.observedAt,
				accountGeneration: 1,
				duplicate: false,
				episode: {
					episodeKey: event.episodeKey,
					episodeTitle: event.episodeTitle,
					seasonKey: null,
					seasonTitle: null,
					seasonNumber: null,
					episodeNumber: null,
					sourceUrl: event.sourceUrl,
					currentTime: 10,
					duration: 100,
					progress: 0.1,
					completedAt: null,
					lastWatchedAt: event.observedAt,
					sessions: [],
				},
			}),
		);
		expect(await pending).toMatchObject({ ok: false });
		expect(f.root.partitions[f.key]).toEqual(closed);
	});
	it("confirmed Free clears local capture data but preserves preferences and migration accounting", async () => {
		const f = fixture();
		await f.client().handle(observe(f.event()));
		f.setLease({
			...f.lease,
			access: { ...f.lease.access, state: "plan_required", accessEpoch: 2 },
		});
		await f.client().handle({
			type: "ANIDACHI_WATCH_HISTORY_V3",
			command: "bootstrap",
			expectedOwnerUserId: owner,
		});
		const partition = f.root.partitions[f.key]!;
		expect(partition.outbox.entries).toEqual([]);
		expect(partition.currentObservation).toBeNull();
		expect(partition.preferences?.youtubeHistoryEnabled).toBe(true);
		expect(partition.accessLease?.access.state).toBe("plan_required");
	});
	it("unproven old-storage queue is accounted once without relabeling or a false upload", async () => {
		const f = fixture();
		const { captureProof, clientSequence, ...legacy } = f.event();
		f.root.partitions[f.key]!.outbox.entries.push({
			event: legacy,
			key: "old",
			slot: "latest",
			persistedAt: f.now,
		});
		const root = await f.storage.readRoot();
		expect(root.partitions[f.key]!.outbox.entries).toEqual([]);
		expect(root.partitions[f.key]!.outbox.retiredUnproven).toBe(1);
		await f
			.client()
			.handle({ type: "ANIDACHI_WATCH_HISTORY_V3", command: "flush" });
		expect(f.posts).toEqual([]);
		expect(f.root.partitions[f.key]!.outbox.retiredUnproven).toBe(1);
	});
});
