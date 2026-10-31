import { describe, expect, it, vi } from "vitest";
import { notifyWebFree20Budget } from "../src/internal-web-client";
const env = {
	ANIDACHI_INTERNAL_API_SECRET: "synthetic-secret",
	ANIDACHI_WEB_INTERNAL_BASE_URL: "https://web.internal",
};
const request = {
	roomId: "room-1",
	roomGeneration: 1,
	checkpointSequence: 4,
	usage: [],
};
const checkpoint = {
	roomBudgetVersion: 1,
	ownerUserId: "8fb7bc8d-49ef-4f43-9de3-1b6b31716c00",
	...request,
	usage: undefined,
	utcDay: "2026-10-30",
	serverTime: Date.parse("2026-10-30T12:00:00Z"),
	resetAt: Date.parse("2026-10-31T00:00:00Z"),
	refreshBy: Date.parse("2026-10-30T12:15:00Z"),
	budgetSeconds: 1200,
	committedSeconds: 0,
	acknowledged: [],
};
// Strict server response has no request-only usage field.
delete (checkpoint as { usage?: unknown }).usage;
const body = {
	checkpoint,
	policy: { denied: false, roomToken: "signed-token" },
};
describe("bounded internal Free20 transport", () => {
	it("uses one authenticated nonredirecting callback with the exact durable request", async () => {
		const send = vi.fn<typeof fetch>(async () => Response.json(body));
		expect(await notifyWebFree20Budget(env, request, send)).toEqual(body);
		expect(send).toHaveBeenCalledOnce();
		const call = send.mock.calls[0];
		if (!call) throw new Error("Expected budget callback");
		const [url, init] = call;
		expect(String(url)).toBe(
			"https://web.internal/api/internal/rooms/room-1/free20-budget",
		);
		expect(init?.redirect).toBe("manual");
		expect(JSON.parse(String(init?.body))).toEqual(request);
		expect(init?.headers).toMatchObject({
			Authorization: "Bearer synthetic-secret",
		});
	});
	it("rejects redirects, malformed policy, extra fields and mismatched room/generation/sequence", async () => {
		for (const invalid of [
			{ ...body, unexpected: true },
			{ ...body, policy: null },
			...[
				{ roomId: "other" },
				{ roomGeneration: 2 },
				{ checkpointSequence: 3 },
			].map((p) => ({ ...body, checkpoint: { ...checkpoint, ...p } })),
		])
			await expect(
				notifyWebFree20Budget(env, request, async () => Response.json(invalid)),
			).rejects.toThrow();
		await expect(
			notifyWebFree20Budget(
				env,
				request,
				async () => new Response(null, { status: 302 }),
			),
		).rejects.toThrow();
	});
	it("cancels a response body that never finishes", async () => {
		let cancelled = false;
		const send: typeof fetch = async () =>
			new Response(
				new ReadableStream({
					cancel() {
						cancelled = true;
					},
				}),
			);
		await expect(
			notifyWebFree20Budget(env, request, send, 5),
		).rejects.toThrow();
		expect(cancelled).toBe(true);
	});
});
