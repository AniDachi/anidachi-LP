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
