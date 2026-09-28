import { afterEach, describe, expect, it, vi } from "vitest";
import {
	handleHostingAccessMessage,
	requestHostingAccess,
} from "../src/hosting-access-client";

const owner = "11111111-1111-4111-8111-111111111111";
const message = {
	type: "ANIDACHI_HOSTING_ACCESS" as const,
	ownerUserId: owner,
};
const session = {
	accessToken: "test-access",
	refreshToken: "test-refresh",
	user: {
		id: owner,
		email: "test@example.invalid",
		displayName: "Test",
		avatarUrl: null,
		plan: "free" as const,
	},
};
const access = {
	entitlementsVersion: 1,
	ownerUserId: owner,
	serverTime: "2026-09-28T01:00:00Z",
	planCode: "free",
	hosting: {
		hostingPolicyVersion: 2,
		hostingActivationAt: "2026-09-28T00:00:00Z",
		canHost: false,
		trialEligibility: "eligible",
		trialEndsAt: null,
	},
};
const dependencies = () => ({
	getSession: vi.fn().mockResolvedValue(session),
	refresh: vi.fn().mockResolvedValue(session),
});

describe("owner-bound hosting access", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});
	it("reads the fixed private endpoint with the current stored token and no cookies", async () => {
		const fetch = vi
			.fn()
			.mockResolvedValue(
				Response.json({ ...access, policy: {}, entitlements: {} }),
			);
		vi.stubGlobal("fetch", fetch);
		expect(await handleHostingAccessMessage(message, dependencies())).toEqual({
			ok: true,
			access,
		});
		expect(fetch).toHaveBeenCalledWith(
			new URL("http://localhost:3003/api/me/entitlements"),
			expect.objectContaining({
				credentials: "omit",
				cache: "no-store",
				redirect: "error",
				headers: {
					Authorization: "Bearer test-access",
					"x-anidachi-history-owner": owner,
				},
			}),
		);
	});
	it.each([
		{ ...access, ownerUserId: "22222222-2222-4222-8222-222222222222" },
		{ ...access, serverTime: "invalid" },
		{ ...access, hosting: { ...access.hosting, hostingActivationAt: null } },
		{ ...access, hosting: { ...access.hosting, canHost: true } },
	])("rejects mismatched or contradictory authority (%#)", async (payload) => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
		expect(await handleHostingAccessMessage(message, dependencies())).toEqual({
			ok: false,
		});
	});
	it("preserves a legacy response without inventing trial eligibility", async () => {
		const { hosting: _ignored, ...legacy } = access;
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(legacy)));
		expect(await handleHostingAccessMessage(message, dependencies())).toEqual({
			ok: true,
			access: legacy,
		});
	});
	it("does not return another session's answer after logout and login as the same owner", async () => {
		const deps = dependencies();
		deps.getSession
			.mockResolvedValueOnce(session)
			.mockResolvedValue({ ...session, refreshToken: "another-login" });
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(access)));
		expect(await handleHostingAccessMessage(message, deps)).toEqual({
			ok: false,
		});
	});
	it("refreshes a 401 only while the initiating session is still current", async () => {
		const fresh = { ...session, accessToken: "fresh", refreshToken: "rotated" };
		const deps = dependencies();
		deps.refresh.mockImplementation(async () => {
			deps.getSession.mockResolvedValue(fresh);
			return fresh;
		});
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 401 }))
			.mockResolvedValueOnce(Response.json(access));
		vi.stubGlobal("fetch", fetch);
		expect(await handleHostingAccessMessage(message, deps)).toEqual({
			ok: true,
			access,
		});
		expect(fetch.mock.calls[1]?.[1].headers.Authorization).toBe("Bearer fresh");
	});
	it("bounds an unresponsive body and rejects an owner mismatch across the bridge", async () => {
		vi.useFakeTimers();
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue({
					ok: true,
					status: 200,
					json: () => new Promise(() => {}),
				}),
		);
		const pending = handleHostingAccessMessage(message, dependencies());
		await vi.advanceTimersByTimeAsync(10_000);
		expect(await pending).toEqual({ ok: false });
		vi.stubGlobal("chrome", {
			runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: true, access }) },
		});
		await expect(
			requestHostingAccess("22222222-2222-4222-8222-222222222222"),
		).rejects.toThrow();
	});
});
