import { afterEach, describe, expect, it, vi } from "vitest";
import { fixture, ids, bridgeTransport } from "./fixture";
import { startPrimeBridge } from "../../../src/source-adapters/primevideo/main-bridge";
import { runPrimeCommand } from "../../../src/source-adapters/primevideo/bridge-client";
import { createWatchHistoryPageResolver } from "../../../src/watch-history-catalog";
import {
	paidHistoryLease,
	historyOwner as owner,
} from "../../watch-history-personal-fixtures";
import { isHistoryRecordingEnabled } from "../../../src/history-recording-choice";
import type { WatchHistoryLocalEvent } from "../../../src/watch-history-outbox";
import type { WatchHistoryMessage } from "../../../src/watch-history-client";
import { catalogFixture } from "./catalog-fixture";
import { WatchCatalogCommitRequestSchema } from "@anidachi/protocol";
vi.mock("../../../src/history-recording-choice", () => ({
	isHistoryRecordingEnabled: vi.fn(async () => true),
}));
const stops: (() => void)[] = [];
afterEach(() => {
	stops.splice(0).forEach((stop) => stop());
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	document.body.innerHTML = "";
});
function setup() {
	const f = fixture();
	bridgeTransport();
	stops.push(startPrimeBridge());
	const lease = paidHistoryLease(owner, Date.now() - 1000);
	const event = {
		provider: "primevideo",
		accountGeneration: 1,
		clientEventId: "event",
		clientSessionKey: "session",
		captureProof: lease,
		primevideoIdentity: {
			kind: "episode",
			seriesAnchorSeasonId: ids.anchor,
			providerSeasonIdentifier: ids.season,
			providerEpisodeIdentifier: ids.first,
		},
	} as WatchHistoryLocalEvent;
	const messages: WatchHistoryMessage[] = [];
	const send = vi.fn(async (message: WatchHistoryMessage) => {
		messages.push(message);
		return {
			ok: true as const,
			data:
				message.command === "bootstrap-cache"
					? { accessLease: lease }
					: {
							meta: {
								schemaVersion: 3,
								ownerUserId: owner,
								accountGeneration: 1,
								serverTime: new Date().toISOString(),
							},
							schemaVersion: 3,
							accountGeneration: 1,
							provider: "primevideo",
							titleKey: `primevideo:series:${ids.anchor}`,
							revision: 1,
							refreshRequired: true,
							availabilityChanged: true,
							effectiveCatalogState: "partial",
							projectionRevision: null,
							acceptedHash: null,
							acceptedAt: null,
						},
		};
	});
	return { ...f, event, lease, messages, send };
}
describe("Prime capture catalog authority with actual bridge and client", () => {
	it("commits complete cross-season unplayed catalog only through eligible begin and actual MAIN collection", async () => {
		const f = setup();
		const pages = catalogFixture();
		const fetcher = vi.fn(async (url: string) => {
			const index = pages.pages.findIndex((page) =>
				url.endsWith(page.season.compact),
			);
			const response = new Response(pages.html(index), {
				headers: { "content-type": "text/html" },
			});
			Object.defineProperty(response, "url", { value: url });
			return response;
		});
		vi.stubGlobal("fetch", fetcher);
		const resolver = createWatchHistoryPageResolver({ send: f.send });
		stops.push(resolver.dispose);
		await resolver.resolve(f.event, owner, { refreshCatalog: true });
		const commit = f.messages.find(
			(message) => message.command === "catalog-commit",
		);
		expect(commit).toMatchObject({
			expectedOwnerUserId: owner,
			input: {
				accountGeneration: 1,
				revision: 1,
				historyAccess: { accessEpoch: f.lease.access.accessEpoch },
				snapshot: { completeness: "complete", providerSeriesId: ids.anchor },
			},
		});
		if (commit?.command !== "catalog-commit")
			throw new Error("Expected guarded catalog commit");
		const committed = WatchCatalogCommitRequestSchema.parse(commit.input);
		expect(
			committed.snapshot.seasons.map((season) => season.episodes.length),
		).toEqual([2, 1, 1, 2]);
		const unplayed = committed.snapshot.seasons[0]!.episodes[1]!;
		expect(unplayed.watchVariants[0]?.sourceUrl).toBe(
			"https://www.primevideo.com/detail/0EPISODE010000000000000000",
		);
		expect(unplayed).not.toHaveProperty("progressSeconds");
		expect(f.messages.map((message) => message.command)).toContain(
			"catalog-release",
		);
		await resolver.resolve(f.event, owner, { refreshCatalog: true });
		expect(fetcher).toHaveBeenCalledTimes(4);
	});
	it("collects only after eligible lease and begin, preserves season1 anchor and partial truth", async () => {
		const f = setup(),
			cr = vi.fn(),
			netflix = vi.fn(),
			command = vi.fn(runPrimeCommand);
		const resolver = createWatchHistoryPageResolver({
			send: f.send,
			command: cr,
			netflixCommand: netflix,
			primeCommand: command,
		});
		stops.push(resolver.dispose);
		await resolver.resolve(f.event, owner, { refreshCatalog: true });
		expect(cr).not.toHaveBeenCalled();
		expect(netflix).not.toHaveBeenCalled();
		const commit = f.messages.find(
			(message) => message.command === "catalog-commit",
		);
		expect(commit).toMatchObject({
			input: {
				provider: "primevideo",
				providerSeriesId: ids.anchor,
				snapshot: {
					completeness: "partial",
					seasons: [
						{
							episodes: expect.arrayContaining([
								expect.objectContaining({
									providerEpisodeIdentifier: ids.first,
									available: true,
								}),
							]),
						},
					],
				},
			},
		});
		expect(f.messages.map((message) => message.command)).toContain(
			"catalog-release",
		);
		await resolver.resolve(f.event, owner, { refreshCatalog: true });
		expect(
			command.mock.calls.filter((call) => call[0].action === "catalog"),
		).toHaveLength(1);
	});
	it.each([
		"opt-out",
		"expired-lease",
		"wrong-owner",
		"wrong-generation",
	])("performs no provider I/O for %s", async (mode) => {
		const f = setup(),
			command = vi.fn(runPrimeCommand);
		if (mode === "opt-out")
			vi.mocked(isHistoryRecordingEnabled).mockResolvedValueOnce(false);
		if (mode === "expired-lease")
			f.lease.access.validUntil = new Date(Date.now() - 10000).toISOString();
		if (mode === "wrong-generation") f.event.accountGeneration = 2;
		const resolver = createWatchHistoryPageResolver({
			send: f.send,
			primeCommand: command,
		});
		stops.push(resolver.dispose);
		await resolver.resolve(
			f.event,
			mode === "wrong-owner" ? "00000000-0000-4000-8000-000000000002" : owner,
			{ refreshCatalog: true },
		);
		expect(command).not.toHaveBeenCalled();
		expect(
			f.messages.some((message) => message.command === "catalog-begin"),
		).toBe(false);
	});
	it("cancels catalog on source suspension before delayed begin resolves", async () => {
		const f = setup();
		let finish!: () => void;
		const resolver = createWatchHistoryPageResolver({
			send: async (message) => {
				if (message.command === "catalog-begin")
					await new Promise<void>((resolve) => {
						finish = resolve;
					});
				return f.send(message);
			},
		});
		stops.push(resolver.dispose);
		const pending = resolver.resolve(f.event, owner, { refreshCatalog: true });
		await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
		resolver.suspendCatalogs();
		finish();
		await pending;
		expect(
			f.messages.some((message) => message.command === "catalog-commit"),
		).toBe(false);
		expect(
			f.messages.some((message) => message.command === "catalog-release"),
		).toBe(true);
	});
	it("rejects a source change after catalog-begin without committing old metadata", async () => {
		const f = setup();
		const resolver = createWatchHistoryPageResolver({
			send: async (message) => {
				const response = await f.send(message);
				if (message.command === "catalog-begin") f.next();
				return response;
			},
		});
		stops.push(resolver.dispose);
		await resolver.resolve(f.event, owner, { refreshCatalog: true });
		expect(
			f.messages.some((message) => message.command === "catalog-commit"),
		).toBe(false);
	});
});
