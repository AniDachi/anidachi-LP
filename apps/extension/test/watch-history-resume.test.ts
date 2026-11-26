import { CrunchyrollVideoAdapter } from "../src/source-adapters/crunchyroll/adapter";
import { describe, expect, it, vi } from "vitest";
import {
	buildPersonalHistoryResumeUrl,
	parsePersonalHistoryResumeUrl,
} from "@anidachi/protocol";
import {
	applyPersonalHistoryResume,
	takePersonalHistoryResume,
} from "../src/watch-history-resume";
import {
	paidHistoryLease,
	historyOwner,
} from "./watch-history-personal-fixtures";
import type { VideoAdapter } from "../src/source-adapters/core/types";
const sourceUrl = "https://www.youtube.com/watch?v=abcdefghijk";
const now = Date.now();
async function intent() {
	return parsePersonalHistoryResumeUrl(
		await buildPersonalHistoryResumeUrl({
			ownerUserId: historyOwner,
			accountGeneration: 1,
			provider: "youtube",
			sourceUrl,
			currentTime: 42,
			now,
		}),
		now,
	)!;
}
describe("explicit personal Resume", () => {
	it("keeps only salted owner matching in a bounded safe URL and preserves the room hash", async () => {
		const url = await buildPersonalHistoryResumeUrl({
			ownerUserId: historyOwner,
			accountGeneration: 1,
			provider: "youtube",
			sourceUrl,
			currentTime: 42,
			now,
		});
		expect(url).not.toContain(historyOwner);
		expect(parsePersonalHistoryResumeUrl(url, now)?.currentTime).toBe(42);
		expect(parsePersonalHistoryResumeUrl(url, now + 300_000)).toBeNull();
		expect(parsePersonalHistoryResumeUrl(url, now - 1)).toBeNull();
		const room = await buildPersonalHistoryResumeUrl({
			ownerUserId: historyOwner,
			accountGeneration: 1,
			provider: "youtube",
			sourceUrl: `${sourceUrl}#anidachiRoom=room-a&other=preserved`,
			currentTime: 42,
			now,
		});
		const replace = vi.fn();
		expect(takePersonalHistoryResume({ href: room }, replace, now)).toBeNull();
		expect(replace.mock.calls[0]![0]).toContain(
			"anidachiRoom=room-a&other=preserved",
		);
		expect(replace.mock.calls[0]![0]).not.toContain("anidachiResume");
		await expect(
			buildPersonalHistoryResumeUrl({
				ownerUserId: historyOwner,
				accountGeneration: 1,
				provider: "youtube",
				sourceUrl: "https://evil.test/watch?v=abcdefghijk",
				currentTime: 1,
				now,
			}),
		).rejects.toThrow();
	});
	it("waits through ads then seeks once without autoplay or consuming before content readiness", async () => {
		const launch = await intent();
		let phase = "interstitial";
		let claimed = false;
		const seek = vi.fn();
		const adapter = {
			provider: "youtube",
			video: { readyState: 1, duration: 100 },
			getPlaybackSnapshot: () => ({ phase }),
			getSourceDescriptor: () => ({ sourceUrl }),
			seek,
		} as unknown as VideoAdapter;
		const claim = vi.fn(async () => {
			if (claimed) return false;
			claimed = true;
			return true;
		});
		const input = {
			adapter,
			getOwner: () => historyOwner,
			roomActive: () => false,
			isCurrent: () => true,
			getLease: async () => paidHistoryLease(historyOwner, now),
			claim,
			now: () => now,
		};
		expect(await applyPersonalHistoryResume(launch, input)).toBe("waiting");
		expect(claim).not.toHaveBeenCalled();
		phase = "content";
		expect(await applyPersonalHistoryResume(launch, input)).toBe("consumed");
		expect(seek).toHaveBeenCalledExactlyOnceWith(42, {
			resumeIfPlaying: false,
		});
		expect(await applyPersonalHistoryResume(launch, input)).toBe("cancelled");
		expect(seek).toHaveBeenCalledTimes(1);
	});
	it("Free resumes an existing saved position even with recording consent off", async () => {
		const lease = paidHistoryLease(historyOwner, now);
		lease.access.state = "plan_required";
		lease.access.youtubeHistoryEnabled = false;
		const seek = vi.fn();
		const claim = vi.fn(async () => true);
		const adapter = { provider: "youtube", video: { readyState: 1, duration: 100 },
			getPlaybackSnapshot: () => ({ phase: "content" }), getSourceDescriptor: () => ({ sourceUrl }), seek } as unknown as VideoAdapter;
		expect(await applyPersonalHistoryResume(await intent(), {
			adapter, getOwner: () => historyOwner, roomActive: () => false, isCurrent: () => true,
			getLease: async () => lease, claim, now: () => now,
		})).toBe("consumed");
		expect(seek).toHaveBeenCalledExactlyOnceWith(42, { resumeIfPlaying: false });
	});
	it("matches the actual descriptor with preserved hash and provider redirect", async () => {
		const sourceUrl = "https://www.crunchyroll.com/watch/EPISODE1";
		const url = await buildPersonalHistoryResumeUrl({
			ownerUserId: historyOwner,
			accountGeneration: 1,
			provider: "crunchyroll",
			sourceUrl: `${sourceUrl}#other=preserved`,
			currentTime: 42,
			now,
		});
		Object.defineProperty(window, "location", {
			configurable: true,
			value: new URL(
				url.replace(
					"/watch/EPISODE1#",
					"/en-US/watch/EPISODE1/translated?ref=home#",
				),
			),
		});
		const video = document.createElement("video");
		Object.defineProperty(video, "readyState", { value: 1 });
		Object.defineProperty(video, "duration", { value: 100 });
		const adapter = new CrunchyrollVideoAdapter(video, video);
		vi.spyOn(adapter, "getPersonalResumeReadiness").mockResolvedValue("ready");
		const seek = vi
			.spyOn(adapter, "seekPersonalResume")
			.mockImplementation(async (_target, guard) =>
				guard() ? "consumed" : "cancelled",
			);
		const launch = takePersonalHistoryResume(
			location,
			(url) =>
				Object.defineProperty(window, "location", {
					configurable: true,
					value: new URL(url),
				}),
			now,
		)!;
		expect(launch).not.toBeNull();
		expect(adapter.getSourceDescriptor()?.sourceUrl).toContain(
			"other=preserved",
		);
		expect(
			await applyPersonalHistoryResume(launch, {
				adapter,
				getOwner: () => historyOwner,
				roomActive: () => false,
				isCurrent: () => true,
				getLease: async () => paidHistoryLease(historyOwner, now),
				claim: async () => true,
				now: () => now,
			}),
		).toBe("consumed");
		expect(seek).toHaveBeenCalledOnce();
	});
	it("cancels changed owner, generation, source and room, including room entry during claim", async () => {
		const launch = await intent();
		let room = false;
		const seek = vi.fn();
		const adapter = {
			provider: "youtube",
			video: { readyState: 1, duration: 100 },
			getPlaybackSnapshot: () => ({ phase: "content" }),
			getSourceDescriptor: () => ({ sourceUrl }),
			seek,
		} as unknown as VideoAdapter;
		const input = {
			adapter,
			getOwner: () => historyOwner,
			roomActive: () => room,
			isCurrent: () => true,
			getLease: async () => paidHistoryLease(historyOwner, now),
			claim: async () => true,
			now: () => now,
		};
		expect(
			await applyPersonalHistoryResume(launch, {
				...input,
				getOwner: () => "different-owner",
			}),
		).toBe("cancelled");
		expect(
			await applyPersonalHistoryResume(
				{ ...launch, accountGeneration: 2 },
				input,
			),
		).toBe("cancelled");
		expect(
			await applyPersonalHistoryResume(
				{ ...launch, sourceUrl: `${sourceUrl}other` },
				input,
			),
		).toBe("cancelled");
		expect(
			await applyPersonalHistoryResume(launch, {
				...input,
				claim: async () => {
					room = true;
					return true;
				},
			}),
		).toBe("cancelled");
		room = false;
		let reads = 0;
		expect(
			await applyPersonalHistoryResume(launch, {
				...input,
				getLease: async () =>
					++reads === 1 ? paidHistoryLease(historyOwner, now) : null,
			}),
		).toBe("cancelled");
		expect(seek).not.toHaveBeenCalled();
	});
});

it("Prime resume waits for provider readiness and uses guarded provider seeking, never raw seek", async () => {
  const sourceUrl = `https://www.primevideo.com/detail/${"A".repeat(26)}`;
  const url = new URL(await buildPersonalHistoryResumeUrl({
    ownerUserId: historyOwner, accountGeneration: 1, provider: "primevideo",
    sourceUrl, currentTime: 42, now,
  }));
  expect(url.searchParams.get("autoplay")).toBe("1");
  const replace = vi.fn();
  const launch = takePersonalHistoryResume({ href: url.href }, replace, now)!;
  expect(launch.sourceUrl).toBe(sourceUrl);
  expect(replace).toHaveBeenCalledExactlyOnceWith(`${sourceUrl}?autoplay=1`);
  let snapshotReady = false;
  let readiness = "waiting";
  const seek = vi.fn();
  const seekPersonalResume = vi.fn(async (_intent, guard) => guard() ? "consumed" : "cancelled");
  const adapter = { provider: "primevideo", video: { readyState: 1, duration: 100 },
    getFingerprint: () => `primevideo|detail/${"A".repeat(26)}`,
    getPlaybackSnapshot: () => ({ phase: snapshotReady ? "content" : "transition" }),
    getSourceDescriptor: () => snapshotReady ? ({ sourceUrl: `${sourceUrl}?ref_=atv_plr_detail_play` }) : undefined,
    getPersonalResumeReadiness: vi.fn(async () => readiness), seekPersonalResume, seek } as unknown as VideoAdapter;
  const claim = vi.fn(async () => true);
  const input = { adapter, getOwner: () => historyOwner, roomActive: () => false, isCurrent: () => true,
    getLease: async () => paidHistoryLease(historyOwner, now), claim, now: () => now };
  expect(await applyPersonalHistoryResume(launch, input)).toBe("waiting");
  expect(claim).not.toHaveBeenCalled();
  expect(seekPersonalResume).not.toHaveBeenCalled();
  snapshotReady = true;
  expect(await applyPersonalHistoryResume(launch, input)).toBe("waiting");
  expect(claim).not.toHaveBeenCalled();
  expect(seekPersonalResume).not.toHaveBeenCalled();
  readiness = "ready";
  expect(await applyPersonalHistoryResume(launch, input)).toBe("consumed");
  expect(seekPersonalResume).toHaveBeenCalledTimes(1);
  expect(seekPersonalResume).toHaveBeenCalledWith(launch, expect.any(Function));
  expect(claim).toHaveBeenCalledTimes(1);
  expect(seek).not.toHaveBeenCalled();
  expect(await applyPersonalHistoryResume(launch, { ...input, adapter: { ...adapter, getPersonalResumeReadiness: undefined } as VideoAdapter })).toBe("waiting");
  expect(await applyPersonalHistoryResume(launch, { ...input, claim: async () => { readiness = "cancelled"; return true; },
    adapter: { ...adapter, getSourceDescriptor: () => ({ sourceUrl: `${sourceUrl}X` }) } as unknown as VideoAdapter })).toBe("cancelled");
});

it.each([
  "owner", "expiry", "room", "current", "fingerprint", "descriptor", "provider", "phase",
] as const)("cancels Prime resume when %s changes while the first snapshot is pending", async change => {
  const id = "A".repeat(26);
  const sourceUrl = `https://www.primevideo.com/detail/${id}`;
  const launch = parsePersonalHistoryResumeUrl(await buildPersonalHistoryResumeUrl({
    ownerUserId: historyOwner, accountGeneration: 1, provider: "primevideo",
    sourceUrl, currentTime: 42, now,
  }), now)!;
  let owner = historyOwner, time = now, room = false, current = true;
  let fingerprint = `primevideo|detail/${id}`;
  let descriptor: { sourceUrl: string } | undefined;
  let provider = "primevideo", phase = "transition";
  const seek = vi.fn(), seekPersonalResume = vi.fn(), claim = vi.fn(), getLease = vi.fn();
  const adapter = { get provider() { return provider; }, video: { readyState: 1, duration: 100 },
    getFingerprint: () => fingerprint, getSourceDescriptor: () => descriptor,
    getPlaybackSnapshot: () => ({ phase }), seek, seekPersonalResume,
  } as unknown as VideoAdapter;
  const input = { adapter, getOwner: () => owner, roomActive: () => room,
    isCurrent: () => current, getLease, claim, now: () => time };
  expect(await applyPersonalHistoryResume(launch, input)).toBe("waiting");
  if (change === "owner") owner = "other-owner";
  if (change === "expiry") time = launch.expiresAt;
  if (change === "room") room = true;
  if (change === "current") current = false;
  if (change === "fingerprint") fingerprint = `primevideo|detail/${"B".repeat(26)}`;
  if (change === "descriptor") descriptor = { sourceUrl: `https://www.primevideo.com/detail/${"B".repeat(26)}` };
  if (change === "provider") provider = "netflix";
  if (change === "phase") phase = "content";
  expect(await applyPersonalHistoryResume(launch, input)).toBe("cancelled");
  expect(getLease).not.toHaveBeenCalled();
  expect(claim).not.toHaveBeenCalled();
  expect(seekPersonalResume).not.toHaveBeenCalled();
  expect(seek).not.toHaveBeenCalled();
});

it.each(["interstitial", "buffering"])("holds a matching HBO Max resume during %s before its descriptor exists", async phase => {
  const id = "4d269596-6871-4419-892a-ca2b801d447d";
  const sourceUrl = "https://www.hbomax.com/video/watch/" + id;
  const launch = parsePersonalHistoryResumeUrl(await buildPersonalHistoryResumeUrl({
    ownerUserId: historyOwner, accountGeneration: 1, provider: "hbomax", sourceUrl, currentTime: 42, now,
  }), now)!;
  const adapter = {
    provider: "hbomax", getPlaybackSnapshot: () => ({ phase }),
    getFingerprint: () => "hbomax|video/watch/" + id, getSourceDescriptor: () => undefined,
  } as unknown as VideoAdapter;
  const claim = vi.fn();
  const input = { adapter, getOwner: () => historyOwner, roomActive: () => false, isCurrent: () => true,
    getLease: async () => paidHistoryLease(historyOwner, now), claim, now: () => now };
  expect(await applyPersonalHistoryResume(launch, input)).toBe("waiting");
  expect(await applyPersonalHistoryResume(launch, { ...input, adapter: { ...adapter, getFingerprint: () => "other" } })).toBe("cancelled");
  expect(claim).not.toHaveBeenCalled();
});
