import { describe, expect, it } from "vitest";
import {
	coalescePresence,
	presencePairs,
	claimPresence,
	acknowledgePresence,
} from "../src/room-presence-evidence";
const user = (i: number) => ({
	userId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
	sessionId: `session-${i}`,
});
const evidence = (i = 1, at = 1000) =>
	presencePairs("room-test", 7, [user(i), user(i + 1)], at)[0]!;
describe("confirmed room presence", () => {
	it("deduplicates accounts and only pairs supplied live authenticated sessions", () => {
		expect(presencePairs("room-test", 7, [user(1)], 1000)).toEqual([]);
		expect(
			presencePairs("room-test", 7, [user(1), user(1), user(2)], 1000),
		).toHaveLength(1);
	});
	it("coalesces latest pairs and bounds churn with an overflow counter", () => {
		let state = coalescePresence(undefined, [evidence()], 1000);
		state = coalescePresence(state, [evidence(1, 2000)], 2000);
		expect(state.pending).toHaveLength(1);
		expect(state.pending[0]?.evidence.observedAt).toBe(2000);
		for (let i = 2; i < 120; i++)
			state = coalescePresence(state, [evidence(i, 2000 + i)], 2000 + i);
		expect(state.pending).toHaveLength(105);
		expect(state.overflow).toBe(14);
	});
	it("claims bounded work before I/O and stale ack cannot delete newer evidence", () => {
		let state = coalescePresence(undefined, [evidence()], 1000);
		const claim = claimPresence(state, 1000);
		expect(claim.claimed).toHaveLength(1);
		expect(claimPresence(claim.state, 1001).claimed).toHaveLength(0);
		state = coalescePresence(claim.state, [evidence(1, 2000)], 2000);
		expect(acknowledgePresence(state, claim.claimed[0]!).pending).toHaveLength(
			1,
		);
		expect(
			acknowledgePresence(claim.state, claim.claimed[0]!).pending,
		).toHaveLength(0);
	});
	it("expires old evidence and finite attempts", () => {
		let state = coalescePresence(undefined, [evidence()], 1000);
		for (let i = 0; i < 8; i++)
			state = claimPresence(state, 1000 + i * 400000).state;
		expect(claimPresence(state, 4000000).state.pending).toHaveLength(0);
		expect(
			claimPresence(coalescePresence(undefined, [evidence()], 1000), 86401001)
				.state.pending,
		).toHaveLength(0);
	});
});

import { notifyWebRoomPresence } from "../src/internal-web-client";
describe("presence transport", () => {
	it("uses existing server auth and accepts only the private acknowledgement", async () => {
		let request: RequestInit | undefined;
		await notifyWebRoomPresence(
			{
				ANIDACHI_INTERNAL_API_SECRET: "test",
				ANIDACHI_WEB_INTERNAL_BASE_URL: "https://web.test",
			},
			evidence(),
			async (input, init) => {
				expect(String(input)).toBe(
					"https://web.test/api/internal/rooms/presence-evidence",
				);
				request = init;
				return Response.json({ accepted: true });
			},
		);
		expect(request?.headers).toMatchObject({ Authorization: "Bearer test" });
		expect(JSON.parse(String(request?.body))).toEqual(evidence());
		await expect(
			notifyWebRoomPresence(
				{
					ANIDACHI_INTERNAL_API_SECRET: "test",
					ANIDACHI_WEB_INTERNAL_BASE_URL: "https://web.test",
				},
				evidence(),
				async () => Response.json({ ok: true }),
			),
		).rejects.toThrow();
	});
	it("bounds an unresolved request independently of room work", async () => {
		await expect(
			notifyWebRoomPresence(
				{
					ANIDACHI_INTERNAL_API_SECRET: "test",
					ANIDACHI_WEB_INTERNAL_BASE_URL: "https://web.test",
				},
				evidence(),
				() => new Promise(() => {}),
				10,
			),
		).rejects.toThrow("deadline");
	});
});
