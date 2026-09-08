import { describe, expect, it } from "vitest";
import {
	createWatchHistoryLease,
	canCaptureWatchHistory,
	canReadWatchHistory,
	personalEnvelopeEligible,
} from "../src/watch-history-access";

const owner = "00000000-0000-4000-8000-000000000001";
const issued = Date.parse("2026-09-08T10:00:00Z");
const access = {
	accessVersion: 1 as const,
	ownerUserId: owner,
	accountGeneration: 1,
	accessEpoch: 2,
	youtubeConsentEpoch: 4,
	state: "allowed" as const,
	serverTime: new Date(issued).toISOString(),
	validUntil: new Date(issued + 300_000).toISOString(),
	captureNotBefore: new Date(issued - 1_000).toISOString(),
	youtubeHistoryEnabled: true,
};
describe("personal history absolute authority", () => {
	it("never grants Free, missing, wrong owner, or expired proof", () => {
		const lease = createWatchHistoryLease(access, owner, issued, issued + 100)!;
		expect(canCaptureWatchHistory(lease, owner, issued + 200)).toBe(true);
		expect(canCaptureWatchHistory(lease, "other", issued + 200)).toBe(false);
		expect(canCaptureWatchHistory(lease, owner, issued + 300_000)).toBe(false);
		expect(canCaptureWatchHistory(null, owner, issued)).toBe(false);
		expect(
			canCaptureWatchHistory(
				createWatchHistoryLease(
					{ ...access, state: "plan_required" },
					owner,
					issued,
					issued,
				),
				owner,
				issued,
			),
		).toBe(false);
	});
	it("Free can read saved history but cannot capture, with owner and time fences intact", () => {
		const lease = createWatchHistoryLease({ ...access, state: "plan_required", youtubeHistoryEnabled: false }, owner, issued, issued + 100)!;
		expect(canReadWatchHistory(lease, owner, issued + 200)).toBe(true);
		expect(canCaptureWatchHistory(lease, owner, issued + 200)).toBe(false);
		for (const time of [issued, issued + 300_000, NaN]) expect(canReadWatchHistory(lease, owner, time)).toBe(false);
		expect(canReadWatchHistory(lease, "other", issued + 200)).toBe(false);
		expect(canReadWatchHistory(null, owner, issued + 200)).toBe(false);
	});
	it("persists the original deadline across restart and fails closed on wall clock rollback", () => {
		const lease = createWatchHistoryLease(
			access,
			owner,
			issued - 60_000,
			issued - 59_900,
		)!;
		const restarted = JSON.parse(JSON.stringify(lease));
		expect(canCaptureWatchHistory(restarted, owner, issued + 240_000)).toBe(
			false,
		);
		expect(canCaptureWatchHistory(restarted, owner, issued - 60_001)).toBe(
			false,
		);
		expect(
			createWatchHistoryLease(access, owner, issued, issued + 300_001),
		).toBe(null);
	});
	it("retains only original eligible epochs and rotates YouTube independently", () => {
		const lease = createWatchHistoryLease(access, owner, issued, issued)!;
		const envelope = {
			captureVersion: 1 as const,
			accessEpoch: 2,
			youtubeConsentEpoch: 3,
			clientSequence: 1,
			event: { accountGeneration: 1, provider: "crunchyroll" as const },
		};
		expect(personalEnvelopeEligible(envelope, lease, owner, issued)).toBe(true);
		expect(
			personalEnvelopeEligible(
				{ ...envelope, event: { ...envelope.event, provider: "youtube" } },
				lease,
				owner,
				issued,
			),
		).toBe(false);
		expect(
			personalEnvelopeEligible(
				{ ...envelope, accessEpoch: 1 },
				lease,
				owner,
				issued,
			),
		).toBe(false);
	});
});
