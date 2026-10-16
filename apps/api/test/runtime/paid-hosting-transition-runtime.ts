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
	vi.restoreAllMocks();
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
describe("durable terminal callback pacing", () => {
    it("does not spend another attempt or extend the deadline for ten early commands, including eviction", async () => {
        const f = await fixture();
        let calls = 0;
        vi.stubGlobal("fetch", async () => { calls++; return Response.json({ error: "offline" }, { status: 503 }); });
        const first = await f.end();
        expect(first.status).toBe(502);
        await first.text();
        const claimed = await terminal(f.stub);
        for (let i = 0; i < 10; i++) {
            if (i === 5)
                await evictDurableObject(f.stub, { webSockets: "hibernate" });
            const result = await f.end();
            expect(result.status).toBe(502);
            expect(await result.json()).toMatchObject({ webFinalized: false, fencedAt: claimed.fencedAt });
        }
        expect(calls).toBe(1);
        expect(claimed.attempts).toBe(1);
        expect(await terminal(f.stub)).toEqual(claimed);
    });
    it.each(["seconds", "http-date"])("honors Retry-After %s across eviction and early alarms", async (format) => {
        const f = await fixture();
        // Build the deadline at execution, not test collection; HTTP dates have second precision.
        const start = Date.now();
        const retryAfter = format === "seconds" ? "600" : new Date(start + 600000).toUTCString();
        const expectedDeadline = format === "seconds" ? start + 600000 : Date.parse(retryAfter);
        let calls = 0;
        vi.stubGlobal("fetch", async () => { calls++; return Response.json({ error: "overload" }, { status: 503, headers: { "Retry-After": retryAfter } }); });
        const response = await f.end();
        expect(response.status).toBe(502);
        await response.text();
        const claimed = await terminal(f.stub);
        expect(claimed.nextAttemptAt).toBeGreaterThanOrEqual(expectedDeadline);
        await evictDurableObject(f.stub, { webSockets: "hibernate" });
        await runInDurableObject(f.stub, async (instance) => { await (instance as any).runAlarmExclusive(); });
        expect(calls).toBe(1);
        expect(await terminal(f.stub)).toEqual(claimed);
    });
});
describe("terminal source and presence scheduling", () => {
    it("retains a source deadline and services presence without spending terminal callback attempts", async () => {
        const f = await fixture();
        const start = Date.now();
        const clock = vi.spyOn(Date, "now").mockReturnValue(start);
        const source = { schemaVersion: 1, attempts: 3, nextAttemptAt: start + 600000, callback: { roomId: f.roomId, sourceGeneration: 2, source: { provider: "youtube", sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", videoFingerprint: "youtube|dQw4w9WgXcQ" } } };
        const evidence = { roomId: f.roomId, roomGeneration: 1, observedAt: start, participants: [{ userId: "00000000-0000-4000-8000-000000000001", sessionId: "session-1" }, { userId: "00000000-0000-4000-8000-000000000002", sessionId: "session-2" }] };
        await runInDurableObject(f.stub, async (_instance, state) => {
            await state.storage.put(terminalKey, { schemaVersion: 1, fencedAt: start, finalizedAt: null, nextAttemptAt: start + 600000, attempts: 1, endedAt: start, reason: "host_ended", cutover: f.cutover });
            await state.storage.put("room_source_pending_v1", source);
            await state.storage.put("room_presence_pending_v1", { schemaVersion: 1, pending: [{ evidence, attempts: 0, nextAttemptAt: start + 10000 }], overflow: 0 });
        });
        await evictDurableObject(f.stub, { webSockets: "hibernate" });
        const urls: string[] = [];
        vi.stubGlobal("fetch", async (url: RequestInfo | URL) => { urls.push(String(url)); return Response.json({ accepted: true }); });
        const first = await f.end();
        expect(first.status).toBe(502);
        await first.text();
        expect(urls).toHaveLength(0);
        expect(await terminal(f.stub)).toMatchObject({ attempts: 1, nextAttemptAt: start + 600000 });
        expect(await runInDurableObject(f.stub, async (_instance, state) => state.storage.getAlarm())).toBe(start + 10000);
        clock.mockReturnValue(start + 10000);
        expect(await runDurableObjectAlarm(f.stub)).toBe(true);
        await vi.waitFor(() => expect(urls).toHaveLength(1));
        expect(urls[0]).toContain("presence-evidence");
        expect(await terminal(f.stub)).toMatchObject({ attempts: 1, nextAttemptAt: start + 600000 });
        expect(await runInDurableObject(f.stub, async (_instance, state) => state.storage.get("room_source_pending_v1"))).toEqual(source);
        expect(await runInDurableObject(f.stub, async (_instance, state) => state.storage.getAlarm())).toBe(start + 600000);
    });
});
describe("terminal retry restart and budget", () => {
    it("bounds an hour of 503 delivery to 15 claims under minimum jitter", async () => {
        const f = await fixture();
        const start = Date.now();
        const clock = vi.spyOn(Date, "now").mockReturnValue(start);
        vi.spyOn(Math, "random").mockReturnValue(0);
        let calls = 0;
        vi.stubGlobal("fetch", async () => { calls++; return new Response(null, { status: 503 }); });
        const first = await f.end();
        expect(first.status).toBe(502);
        await first.text();
        for (let step = 1; step <= 120; step++) {
            clock.mockReturnValue(start + step * 30000);
            if (step === 60)
                await evictDurableObject(f.stub, { webSockets: "hibernate" });
            await runInDurableObject(f.stub, async (instance) => { await (instance as any).runAlarmExclusive(); });
        }
        expect(calls).toBe(15);
        expect(await terminal(f.stub)).toMatchObject({ attempts: 15, finalizedAt: null, nextAttemptAt: start + 3750000 });
    });
    it("recovers the first forced source delivery after the initial intent flush is uncertain and eviction", async () => {
        const f = await fixture();
        const source = {
            schemaVersion: 1,
            attempts: 3,
            nextAttemptAt: Date.now() + 600_000,
            callback: {
                roomId: f.roomId,
                sourceGeneration: 2,
                source: {
                    provider: "youtube",
                    sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                    canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                    videoFingerprint: "youtube|dQw4w9WgXcQ",
                },
            },
        };
        await runInDurableObject(f.stub, async (_instance, state) => {
            await state.storage.put("room_source_pending_v1", source);
            vi.spyOn(state.storage, "sync").mockRejectedValueOnce(new Error("initial intent flush unknown"));
        });
        const order: string[] = [];
        vi.stubGlobal("fetch", async (url: RequestInfo | URL) => {
            if (String(url).endsWith("/source")) {
                order.push("source");
                return Response.json({ ok: true, outcome: "persisted", sourceGeneration: 2 });
            }
            order.push("ended");
            return Response.json({ ok: true, usageFinalized: true });
        });
        const first = await f.end();
        expect(first.status).toBe(502);
        expect(await first.json()).not.toHaveProperty("fencedAt");
        const persisted = await terminal(f.stub);
        expect(persisted).toMatchObject({ attempts: 0, finalizedAt: null });
        expect(order).toEqual([]);
        await evictDurableObject(f.stub, { webSockets: "hibernate" });
        const completed = await f.end();
        expect(completed.status).toBe(200);
        expect(await completed.json()).toMatchObject({ webFinalized: true, fencedAt: persisted.fencedAt });
        expect(order).toEqual(["source", "ended"]);
        expect(await terminal(f.stub)).toMatchObject({ attempts: 1, runtimeFinalized: true });
        const repeated = await f.end();
        expect(repeated.status).toBe(200);
        await repeated.text();
        expect(order).toEqual(["source", "ended"]);
    });
    it("keeps a claimed budget across an uncertain flush and eviction without sending early I/O", async () => {
        const f = await fixture();
        let calls = 0;
        vi.stubGlobal("fetch", async () => { calls++; return Response.json({ ok: true, usageFinalized: true }); });
        await runInDurableObject(f.stub, async (_instance, state) => {
            const sync = state.storage.sync.bind(state.storage);
            vi.spyOn(state.storage, "sync").mockImplementationOnce(sync).mockRejectedValueOnce(new Error("claim flush unknown"));
        });
        const first = await f.end();
        expect(first.status).toBe(502);
        await first.text();
        expect(calls).toBe(0);
        const claimed = await terminal(f.stub);
        expect(claimed.attempts).toBe(1);
        await evictDurableObject(f.stub, { webSockets: "hibernate" });
        const early = await f.end();
        expect(early.status).toBe(502);
        await early.text();
        expect(calls).toBe(0);
        expect(await terminal(f.stub)).toEqual(claimed);
        const clock = vi.spyOn(Date, "now").mockReturnValue(claimed.nextAttemptAt);
        const completed = await f.end();
        expect(completed.status).toBe(200);
        await completed.text();
        expect(calls).toBe(1);
        clock.mockRestore();
    });
    it("keeps a lost Web ACK pending and retries the same frozen callback after its durable deadline", async () => {
        const f = await fixture();
        const payloads: unknown[] = [];
        let valid = false;
        vi.stubGlobal("fetch", async (_url: RequestInfo | URL, init?: RequestInit) => { payloads.push(JSON.parse(String(init?.body))); return Response.json(valid ? { ok: true, usageFinalized: true } : { ok: true }); });
        const first = await f.end();
        expect(first.status).toBe(502);
        await first.text();
        const claimed = await terminal(f.stub);
        await evictDurableObject(f.stub, { webSockets: "hibernate" });
        valid = true;
        const early = await f.end();
        expect(early.status).toBe(502);
        await early.text();
        expect(payloads).toHaveLength(1);
        const clock = vi.spyOn(Date, "now").mockReturnValue(claimed.nextAttemptAt);
        const completed = await f.end();
        expect(completed.status).toBe(200);
        await completed.text();
        expect(payloads).toHaveLength(2);
        expect(payloads[1]).toEqual(payloads[0]);
        clock.mockRestore();
    });
    it("does not mark a stale local attempt complete after a newer durable claim", async () => {
        const f = await fixture();
        let release!: () => void;
        let called = false;
        const gate = new Promise<void>(resolve => release = resolve);
        vi.stubGlobal("fetch", async () => { called = true; await gate; return Response.json({ ok: true, usageFinalized: true }); });
        const ending = f.end();
        await vi.waitFor(() => expect(called).toBe(true));
        await runInDurableObject(f.stub, async (_instance, state) => { const current = await state.storage.get<any>(terminalKey); await state.storage.put(terminalKey, { ...current, attempts: current.attempts + 1 }); });
        release();
        const response = await ending;
        expect(response.status).toBe(502);
        await response.text();
        expect(await terminal(f.stub)).toMatchObject({ attempts: 2, finalizedAt: null });
    });
    it("preserves a legacy intent deadline after eviction before upgrading its attempt metadata", async () => {
        const f = await fixture();
        const start = Date.now();
        const original = { schemaVersion: 1, fencedAt: start, finalizedAt: null, nextAttemptAt: start + 600000, endedAt: start, reason: "host_ended" };
        await runInDurableObject(f.stub, async (_instance, state) => { await state.storage.put(terminalKey, original); await state.storage.setAlarm(original.nextAttemptAt); });
        await evictDurableObject(f.stub, { webSockets: "hibernate" });
        let calls = 0;
        vi.stubGlobal("fetch", async () => { calls++; return new Response(null, { status: 503 }); });
        const early = await f.end();
        expect(early.status).toBe(502);
        await early.text();
        expect(calls).toBe(0);
        expect(await terminal(f.stub)).toMatchObject(original);
        expect(await terminal(f.stub)).not.toHaveProperty("attempts");
        const clock = vi.spyOn(Date, "now").mockReturnValue(original.nextAttemptAt);
        const due = await f.end();
        expect(due.status).toBe(502);
        await due.text();
        expect(calls).toBe(1);
        expect(await terminal(f.stub)).toMatchObject({ fencedAt: start, attempts: 1 });
        clock.mockRestore();
    });
});
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
    await runInDurableObject(f.stub, async (_instance, state) => {
      const intent = await state.storage.get<any>(terminalKey);
      await state.storage.put(terminalKey, { ...intent, nextAttemptAt: Date.now()-1 });
    });
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
