import assert from "node:assert/strict";
import test from "node:test";
import { requestAccountHostingStatus } from "./account-hosting-status-client";
import { ACCOUNT_HOSTING_OWNER_HEADER } from "@anidachi/protocol";
const owner = "f6250000-0000-4000-8000-000000000001",
	at = Date.parse("2030-01-01T12:00:00Z");
const status = {
	accountHostingVersion: 1,
	ownerUserId: owner,
	planCode: "free",
	serverTime: at,
	validUntil: at + 60_000,
	period: { utcDay: "2030-01-01", resetAt: at + 43_200_000 },
	activeRoom: null,
	canCreateRoom: true,
	access: {
		kind: "daily_free",
		budgetSeconds: 1200,
		usedSeconds: 0,
		remainingSeconds: 1200,
		metering: false,
	},
};
test("owner-bound no-store reader accepts only validated status or exact disabled", async () => {
	const original = globalThis.fetch;
	try {
		globalThis.fetch = async (_url, init) => {
			assert.equal(
				new Headers(init?.headers).get(ACCOUNT_HOSTING_OWNER_HEADER),
				owner,
			);
			assert.equal(init?.cache, "no-store");
			return Response.json(status);
		};
		assert.equal((await requestAccountHostingStatus(owner)).mode, "free20");
		await assert.rejects(requestAccountHostingStatus("other"));
		for (const [code, http] of [
			["FREE20_DISABLED", 404],
			["NOT_FOUND", 404],
			["HOSTING_STATUS_UNAVAILABLE", 503],
		] as const) {
			globalThis.fetch = async () => Response.json({ code }, { status: http });
			if (code === "FREE20_DISABLED")
				assert.deepEqual(await requestAccountHostingStatus(owner), {
					mode: "legacy",
				});
			else await assert.rejects(requestAccountHostingStatus(owner));
		}
		globalThis.fetch = async () => Response.json({ ...status, access: null });
		await assert.rejects(requestAccountHostingStatus(owner));
	} finally {
		globalThis.fetch = original;
	}
});
test("deadline covers a lost body and aborts the whole observation", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const original = globalThis.fetch;
	try {
		globalThis.fetch = async () =>
			({ ok: true, json: () => new Promise(() => {}) }) as Response;
		const read = requestAccountHostingStatus(owner);
		const rejected = assert.rejects(read);
		t.mock.timers.tick(10_000);
		await rejected;
	} finally {
		globalThis.fetch = original;
	}
});
