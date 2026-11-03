import { describe, expect, it } from "vitest";
import { parseFree20TransferRequest } from "../src/free20-scope-transfer";

const command = {
	version: 1,
	transferId: "a".repeat(64),
	ownerUserId: "11111111-1111-4111-8111-111111111111",
	roomId: "room-1",
	roomGeneration: 1,
	browserHash: "b".repeat(64),
	installationHash: "c".repeat(64),
};
describe("bounded internal scope transfer input", () => {
	it("accepts only strict JSON and cancels an oversized streaming body", async () => {
		expect(
			await parseFree20TransferRequest(
				new Request("https://room.test", {
					method: "POST",
					body: JSON.stringify(command),
				}),
			),
		).toEqual(command);
		expect(
			await parseFree20TransferRequest(
				new Request("https://room.test", {
					method: "POST",
					body: JSON.stringify({ ...command, extra: 1 }),
				}),
			),
		).toBeNull();
		let cancelled = false;
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode(" ".repeat(5000)));
			},
			cancel() {
				cancelled = true;
			},
		});
		expect(await parseFree20TransferRequest({ body } as Request)).toBeNull();
		expect(cancelled).toBe(true);
	});
});

import { afterEach, vi } from "vitest";
import { app } from "../src/index";
import { notifyWebFree20Context } from "../src/internal-web-client";

afterEach(() => vi.unstubAllGlobals());
it("only the exact neutral busy response is propagated from the attach receiver", async () => {
	const config = {
		ANIDACHI_WEB_INTERNAL_BASE_URL: "https://web.internal",
		ANIDACHI_INTERNAL_API_SECRET: "internal",
	};
	vi.stubGlobal("fetch", async () =>
		Response.json({ code: "UNRELATED_CONFLICT" }, { status: 409 }),
	);
	await expect(
		notifyWebFree20Context(config, {
			...command,
			version: 1,
			roomGeneration: 1,
		}),
	).rejects.toThrow("Free20 attachment unavailable");
	vi.stubGlobal("fetch", async () =>
		Response.json({ code: "FREE20_CONTEXT_BUSY" }, { status: 409 }),
	);
	await expect(
		notifyWebFree20Context(config, {
			...command,
			version: 1,
			roomGeneration: 1,
		}),
	).rejects.toThrow("FREE20_CONTEXT_BUSY");
});
it("Worker routes only authenticated bound transfers and preserves recovery with the admission flag off", async () => {
	let calls = 0;
	const config = {
		ANIDACHI_INTERNAL_API_SECRET: "internal",
		ANIDACHI_FREE20_ABUSE_ENABLED: "false",
		ROOMS: {
			idFromName: (name: string) => name,
			get: () => ({
				fetch: async (request: Request) => {
					calls++;
					expect(request.url).toBe(
						"https://room.internal/internal/free20-context",
					);
					expect(await request.json()).toEqual(command);
					return Response.json({ outcome: "applied" });
				},
			}),
		},
	};
	for (const [auth, value, expected] of [
		["wrong", command, 401],
		["internal", { ...command, roomId: "other" }, 400],
		["internal", { ...command, extra: 1 }, 400],
	] as const) {
		const response = await app.request(
			"/internal/rooms/room-1/free20-context",
			{
				method: "POST",
				headers: { Authorization: `Bearer ${auth}` },
				body: JSON.stringify(value),
			},
			config,
		);
		expect(response.status).toBe(expected);
		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
	}
	expect(calls).toBe(0);
	expect(
		(
			await app.request(
				"/internal/rooms/room-1/free20-context",
				{
					method: "POST",
					headers: { Authorization: "Bearer internal" },
					body: JSON.stringify(command),
				},
				config,
			)
		).status,
	).toBe(200);
	expect(calls).toBe(1);
});
