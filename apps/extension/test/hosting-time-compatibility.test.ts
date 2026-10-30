import { afterEach, describe, expect, it, vi } from "vitest";
import { HostingTimeSnapshotSchema } from "@anidachi/protocol";
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
});
