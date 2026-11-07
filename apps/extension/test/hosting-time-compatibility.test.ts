import { afterEach, describe, expect, it, vi } from "vitest";
import {
	AccountHostingStatusSchema,
	HostingTimeSnapshotSchema,
} from "@anidachi/protocol";
import { free } from "../../../packages/protocol/test/fixtures/hosting-time";
import { requestHostingAccess } from "../src/hosting-access-client";

const legacy = {
	entitlementsVersion: 1,
	ownerUserId: free.ownerUserId,
	serverTime: "2026-10-30T12:00:00Z",
	planCode: "free",
	hosting: {
		hostingPolicyVersion: 2,
		hostingActivationAt: "2026-09-28T00:00:00Z",
		canHost: false,
		trialEligibility: "used",
		trialEndsAt: null,
	},
};

function bridge(access: unknown) {
	vi.stubGlobal("chrome", {
		runtime: { sendMessage: async () => ({ ok: true, access }) },
	});
}

describe("inactive hosting time compatibility with the real extension parser", () => {
	afterEach(() => vi.unstubAllGlobals());
	it("keeps current active-Free denial and ignores independent future metadata", async () => {
		HostingTimeSnapshotSchema.parse(free);
		bridge({ ...legacy, hostingTime: free });
		expect(await requestHostingAccess(free.ownerUserId)).toEqual(legacy);
	});
	it("does not reinterpret Free20 as legacy hosting permission", async () => {
		for (const hosting of [free, { ...legacy.hosting, canHost: true }]) {
			bridge({ ...legacy, hosting });
			await expect(requestHostingAccess(free.ownerUserId)).rejects.toThrow();
		}
	});
	it("does not reinterpret the independent account status as legacy entitlements", async () => {
		const at = Date.parse(legacy.serverTime);
		const status = AccountHostingStatusSchema.parse({
			accountHostingVersion: 1,
			ownerUserId: free.ownerUserId,
			planCode: "free",
			serverTime: at,
			validUntil: at + 60_000,
			period: {
				utcDay: "2026-10-30",
				resetAt: Date.parse("2026-10-31T00:00:00Z"),
			},
			access: {
				kind: "daily_free",
				budgetSeconds: 1200,
				usedSeconds: 420,
				remainingSeconds: 780,
				metering: false,
			},
			activeRoom: null,
			canCreateRoom: true,
		});
		bridge({ ...legacy, accountHosting: status });
		expect(await requestHostingAccess(free.ownerUserId)).toEqual(legacy);
		bridge(status);
		await expect(requestHostingAccess(free.ownerUserId)).rejects.toThrow();
	});
});
