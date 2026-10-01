import {
	evictDurableObject,
	reset,
	runDurableObjectAlarm,
	runInDurableObject,
} from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signRoomTokenForTest } from "../../src/auth";
import { checkWebRoomAdmission } from "../../src/internal-web-client";
import { endedRoomTombstone } from "../../src/room-lifecycle";

const terminalKey = "room_terminal_intent_v1";
const secret = "anidachi-runtime-internal-secret";
afterEach(async () => {
	vi.unstubAllGlobals();
	await reset();
});
async function fixture() {
	const roomId = `cutover-${crypto.randomUUID()}`;
	const ns = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
	const stub = ns.get(ns.idFromName(roomId));
	const token = await signRoomTokenForTest(
		{
			roomId,
			sub: "legacy-host",
			role: "host",
			displayName: "Host",
			avatarUrl: null,
			participantSessionId: "legacy-session",
		},
		{ ANIDACHI_JWT_SECRET: "anidachi-runtime-test-secret" },
	);
	const connect = () =>
		stub.fetch(`https://room.test/?roomToken=${encodeURIComponent(token)}`, {
			headers: { Upgrade: "websocket" },
		});
	const cutover = {
		revision: 2,
		roomId,
		roomGeneration: 1,
		closingAt: Date.now() - 1000,
	};
	const end = (details = cutover) =>
		stub.fetch("https://room.test/internal/end", {
			method: "POST",
			headers: { Authorization: `Bearer ${secret}` },
			body: JSON.stringify({
				endedAt: cutover.closingAt,
				reason: "capability_expired",
				cutover: details,
			}),
		});
	return { roomId, stub, connect, cutover, end };
}
const terminal = (stub: DurableObjectStub) =>
	runInDurableObject(stub, async (_instance, state) =>
		state.storage.get<any>(terminalKey),
	);
describe("commercial closure in the Workers runtime", () => {
	it("keeps an unproven legacy tombstone closed without fabricating a cutover receipt", async () => {
		const f = await fixture();
		const oldEnd = {
			endedAt: Date.now() - 10_000,
			reason: "host_ended" as const,
		};
		const usage = { day: new Date().toISOString().slice(0, 10), seconds: 12 };
		await runInDurableObject(f.stub, async (instance) => {
			await (instance as any).applyTerminalRoomState(
				endedRoomTombstone(oldEnd, { usage }),
			);
		});
		const callback = vi.fn(async () =>
			Response.json({ ok: true, usageFinalized: true }),
		);
		vi.stubGlobal("fetch", callback);
		const response = await f.end();
		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: "ROOM_TERMINAL_PROOF_UNAVAILABLE",
		});
		expect(await terminal(f.stub)).toBeUndefined();
		expect(callback).not.toHaveBeenCalled();
		const reconnect = await f.connect();
		expect(reconnect.status).toBe(410);
		await reconnect.text();
	});

	it("uses native workerd fetch for room authority", async () => {
		const f = await fixture();
		const decision = await checkWebRoomAdmission(
			{
				ANIDACHI_INTERNAL_API_SECRET: secret,
				ANIDACHI_WEB_INTERNAL_BASE_URL: "https://web.internal",
			},
			f.roomId,
			"legacy-host",
		);
		expect(decision.allowed).toBe(true);
	});
	it("does not forward authority credentials through a native redirect", async () => {
		const before = (await (
			await fetch("https://scheduler-test.invalid/counts")
		).json()) as any;
		await expect(
			checkWebRoomAdmission(
				{
					ANIDACHI_INTERNAL_API_SECRET: secret,
					ANIDACHI_WEB_INTERNAL_BASE_URL: "https://web.internal",
				},
				"redirect-room",
				"legacy-host",
			),
		).rejects.toThrow();
		const after = (await (
			await fetch("https://scheduler-test.invalid/counts")
		).json()) as any;
		expect(after.redirectedRequests).toBe(before.redirectedRequests);
	});
	it("does not reopen locally or acknowledge an uncertain storage flush", async () => {
		const f = await fixture();
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: RequestInfo | URL) =>
				String(url).endsWith("/admission")
					? Response.json({
							roomId: f.roomId,
							roomGeneration: 1,
							allowed: true,
						})
					: Response.json({ ok: true, usageFinalized: true }),
			),
		);
		await runInDurableObject(f.stub, async (_instance, state) => {
			vi.spyOn(state.storage, "sync").mockRejectedValueOnce(
				new Error("uncertain flush"),
			);
		});
		const first = await f.end();
		expect(first.status).toBe(502);
		expect(await first.json()).not.toHaveProperty("fencedAt");
		const refused = await f.connect();
		expect(refused.status).toBe(409);
		await refused.text();
		const completed = await f.end();
		expect(completed.status).toBe(200);
		await completed.json();
	});
	it("retries local terminal cleanup after the Web finalization was already acknowledged", async () => {
		const f = await fixture();
		const callback = vi.fn(async () =>
			Response.json({ ok: true, usageFinalized: true }),
		);
		vi.stubGlobal("fetch", callback);
		await runInDurableObject(f.stub, async (instance) => {
			vi.spyOn(instance as any, "applyTerminalRoomState").mockRejectedValueOnce(
				new Error("storage interrupted"),
			);
		});
		const first = await f.end();
		expect(first.status).toBe(502);
		await first.json();
		expect((await terminal(f.stub)).finalizedAt).not.toBeNull();
		expect(
			await runInDurableObject(f.stub, async (_instance, state) =>
				state.storage.getAlarm(),
			),
		).not.toBeNull();
		await runInDurableObject(f.stub, async (_instance, state) => {
			const intent = await state.storage.get<any>(terminalKey);
			await state.storage.put(terminalKey, {
				...intent,
				nextAttemptAt: Date.now() - 1,
			});
			// Make the retry due, but leave delivery to runDurableObjectAlarm.
			// A past alarm can fire automatically before the helper, which then
			// returns false without waiting for that in-flight cleanup.
			await state.storage.setAlarm(Date.now() + 60_000);
		});
		expect(await runDurableObjectAlarm(f.stub)).toBe(true);
		const response = await f.connect();
		expect(response.status).toBe(410);
		await response.text();
		expect(callback).toHaveBeenCalledTimes(1);
		expect(await terminal(f.stub)).toMatchObject({ runtimeFinalized: true });
		expect(
			await runInDurableObject(f.stub, async (_instance, state) =>
				state.storage.getAlarm(),
			),
		).toBeNull();
		await evictDurableObject(f.stub, { webSockets: "hibernate" });
		const afterWake = await f.connect();
		expect(afterWake.status).toBe(410);
		await afterWake.text();
		expect(callback).toHaveBeenCalledTimes(1);
	});
	it("rechecks the local fence after an in-flight admission answer", async () => {
		const f = await fixture();
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let waiting = false;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: RequestInfo | URL) => {
				if (String(url).endsWith("/admission")) {
					waiting = true;
					await gate;
					return Response.json({
						roomId: f.roomId,
						roomGeneration: 1,
						allowed: true,
					});
				}
				return Response.json({ ok: true, usageFinalized: true });
			}),
		);
		const connecting = f.connect();
		await vi.waitFor(() => expect(waiting).toBe(true));
		try {
			const ended = await f.end();
			expect(ended.status).toBe(200);
			await ended.json();
		} finally {
			release();
		}
		const response = await connecting;
		expect([409, 410]).toContain(response.status);
		await response.text();
		expect(
			await runInDurableObject(
				f.stub,
				async (instance) => (instance as any).admissionTimeoutBySocket.size,
			),
		).toBe(0);
	});
	it("cannot close a frozen paid room with a Free cutover command", async () => {
		const f = await fixture();
		await runInDurableObject(f.stub, async (instance) => {
			const room = (instance as any).room;
			room.setCapabilities({ ...room.roomCapabilities, hostPlanCode: "pro" });
		});
		const response = await f.end();
		expect(response.status).toBe(409);
		await response.text();
		expect(await terminal(f.stub)).toBeUndefined();
	});
	it("consults authority for an old signed token before admitting a socket", async () => {
		const f = await fixture();
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: RequestInfo | URL) =>
				String(url).endsWith("/admission")
					? Response.json({
							roomId: f.roomId,
							roomGeneration: 1,
							allowed: false,
							code: "HOST_SUBSCRIPTION_REQUIRED",
							cutover: f.cutover,
						})
					: Response.json({ ok: true, usageFinalized: true }),
			),
		);
		const response = await f.connect();
		expect([403, 409, 410]).toContain(response.status);
		await response.text();
		expect(await terminal(f.stub)).toMatchObject({ cutover: f.cutover });
	});
	it("fails temporarily when authority is unavailable instead of admitting old rights", async () => {
		const f = await fixture();
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Response.json({ error: "offline" }, { status: 503 })),
		);
		const response = await f.connect();
		expect(response.status).toBe(503);
		expect(await response.json()).toMatchObject({
			error: "ROOM_AUTHORITY_UNAVAILABLE",
		});
		expect(await terminal(f.stub)).toBeUndefined();
	});
	it("fences a legacy room before a failed callback and survives more than six retries and eviction", async () => {
		let unavailable = true;
		const f = await fixture();
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: RequestInfo | URL) =>
				String(url).endsWith("/admission")
					? Response.json({
							roomId: f.roomId,
							roomGeneration: 1,
							allowed: true,
						})
					: unavailable
						? Response.json({ error: "offline" }, { status: 503 })
						: Response.json({ ok: true, usageFinalized: true }),
			),
		);
		const opened = await f.connect();
		expect(opened.status).toBe(101);
		const ws = opened.webSocket!;
		ws.accept();
		const events: any[] = [];
		ws.addEventListener("message", (event) => {
			if (typeof event.data === "string") events.push(JSON.parse(event.data));
		});
		const first = await f.end();
		expect(first.status).toBe(502);
		await first.json();
		const pending = await terminal(f.stub);
		expect(pending).toMatchObject({
			cutover: f.cutover,
			fencedAt: expect.any(Number),
			finalizedAt: null,
		});
		expect(
			await runInDurableObject(
				f.stub,
				async (instance) => (instance as any).admissionTimeoutBySocket.size,
			),
		).toBe(0);
		await vi.waitFor(() =>
			expect(events.some((e) => e.type === "ROOM_ENDED")).toBe(true),
		);
		expect(events.find((e) => e.type === "ROOM_ENDED")).toMatchObject({
			reason: "capability_expired",
			hostingCutover: true,
		});
		expect(
			events.some(
				(e) => e.type === "ERROR" && e.code === "ROOM_CAPABILITY_WARNING",
			),
		).toBe(false);
		const refused = await f.connect();
		expect([409, 410]).toContain(refused.status);
		await refused.json(); // Drain response I/O before asking workerd to evict.
		await evictDurableObject(f.stub, { webSockets: "hibernate" });
		const afterWake = await f.connect();
		expect([409, 410]).toContain(afterWake.status);
		await afterWake.json();
		for (let attempt = 0; attempt < 8; attempt++) {
			await runInDurableObject(f.stub, async (_instance, state) => {
				const intent = await state.storage.get<any>(terminalKey);
				await state.storage.put(terminalKey, {
					...intent,
					nextAttemptAt: Date.now() - 1,
				});
				// Do not race automatic delivery against the manual test helper.
				await state.storage.setAlarm(Date.now() + 60_000);
			});
			expect(await runDurableObjectAlarm(f.stub)).toBe(true);
		}
		expect(await terminal(f.stub)).toMatchObject({
			fencedAt: pending.fencedAt,
			cutover: f.cutover,
			finalizedAt: null,
		});
		expect(
			await runInDurableObject(f.stub, async (_instance, state) =>
				state.storage.getAlarm(),
			),
		).not.toBeNull();
		unavailable = false;
		const completed = await f.end();
		expect(completed.status).toBe(200);
		expect(await completed.json()).toMatchObject({
			webFinalized: true,
			cutover: f.cutover,
			fencedAt: pending.fencedAt,
			finalizedAt: expect.any(Number),
		});
		expect((await f.connect()).status).toBe(410);
		expect(
			await runInDurableObject(f.stub, async (_instance, state) =>
				state.storage.getAlarm(),
			),
		).toBeNull();
	});
	it("rejects wrong room/generation and refuses stale revisions after fencing", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Response.json({ error: "offline" }, { status: 503 })),
		);
		const f = await fixture();
		expect((await f.end({ ...f.cutover, roomId: "another-room" })).status).toBe(
			409,
		);
		expect((await f.end({ ...f.cutover, roomGeneration: 2 })).status).toBe(409);
		expect(await terminal(f.stub)).toBeUndefined();
		expect((await f.end()).status).toBe(502);
		const original = await terminal(f.stub);
		expect((await f.end({ ...f.cutover, revision: 1 })).status).toBe(409);
		expect(
			(await f.end({ ...f.cutover, closingAt: f.cutover.closingAt + 100 }))
				.status,
		).toBe(409);
		expect(await terminal(f.stub)).toEqual(original);
	});
});
