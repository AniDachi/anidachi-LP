import { describe, expect, it } from "vitest";
import { RoomRateLimiter, RoomSubjectRateLimiters } from "../src/room-rate-limit";

describe("RoomRateLimiter", () => {
	it("rejects SDP events beyond eight per ten-second window", () => {
		const limiter = new RoomRateLimiter();
		for (let index = 0; index < 8; index += 1) {
			expect(limiter.consume("sdp", 1_000).allowed).toBe(true);
		}

		expect(limiter.consume("sdp", 1_000)).toEqual({
			allowed: false,
			close: false,
			retryAfterMs: 10_000,
		});
	});

	it("rejects ICE events beyond eighty per ten-second window", () => {
		const limiter = new RoomRateLimiter();
		for (let index = 0; index < 80; index += 1) {
			expect(limiter.consume("ice", 2_000).allowed).toBe(true);
		}

		expect(limiter.consume("ice", 2_000).allowed).toBe(false);
	});

	it("enforces the total limit across event classes", () => {
		const limiter = new RoomRateLimiter();
		for (let index = 0; index < 80; index += 1) limiter.consume("ice", 3_000);
		for (let index = 0; index < 8; index += 1) limiter.consume("sdp", 3_000);
		for (let index = 0; index < 32; index += 1)
			limiter.consume("control", 3_000);

		expect(limiter.consume("control", 3_000).allowed).toBe(false);
	});

	it("closes on the third rejection and resets after the active window", () => {
		const limiter = new RoomRateLimiter();
		for (let index = 0; index < 8; index += 1) limiter.consume("sdp", 4_000);

		expect(limiter.consume("sdp", 4_000).close).toBe(false);
		expect(limiter.consume("sdp", 4_001).close).toBe(false);
		expect(limiter.consume("sdp", 4_002).close).toBe(true);
		expect(limiter.consume("sdp", 14_000)).toEqual({
			allowed: true,
			close: false,
			retryAfterMs: 0,
		});
	});

	it("keeps a window that starts at epoch zero", () => {
		const limiter = new RoomRateLimiter();
		for (let index = 0; index < 8; index += 1) {
			expect(limiter.consume("sdp", 0).allowed).toBe(true);
		}

		expect(limiter.consume("sdp", 0).allowed).toBe(false);
	});

	it("restores the reaction budget after the active window", () => {
		const limiter = new RoomRateLimiter();
		for (let index = 0; index < 120; index += 1) {
			expect(limiter.consume("reaction", 0).allowed).toBe(true);
		}

		expect(limiter.consume("reaction", 10_000)).toEqual({
			allowed: true,
			close: false,
			retryAfterMs: 0,
		});
	});

	it("aggregates the existing total frame budget across replacement sockets for one subject", () => {
		const limiters = new RoomSubjectRateLimiters();
		const originalSocket = limiters.forSubject("member-1");
		expect(originalSocket).toBeDefined();
		if (!originalSocket) throw new Error("expected subject limiter");
		for (let index = 0; index < 119; index += 1) {
			expect(originalSocket.consumeTotal(0).allowed).toBe(true);
		}
		limiters.releaseSubject("member-1", 100);

		const replacementSocket = limiters.forSubject("member-1", 1_000);
		expect(replacementSocket?.consumeTotal(1_000).allowed).toBe(true);
		expect(replacementSocket?.consumeTotal(1_000)).toMatchObject({
			allowed: false,
		});
	});

	it("expires a released subject budget after its active window so the instance stays bounded", () => {
		const limiters = new RoomSubjectRateLimiters();
		const original = limiters.forSubject("member-1", 0);
		expect(original).toBeDefined();
		if (!original) throw new Error("expected subject limiter");
		for (let index = 0; index < 120; index += 1) {
			expect(original.consumeTotal(0).allowed).toBe(true);
		}
		limiters.releaseSubject("member-1", 100);

		expect(limiters.forSubject("member-1", 10_100)?.consumeTotal(10_100).allowed).toBe(true);
	});

	it("bounds released subject budgets by room capacity instead of accumulating new subjects", () => {
		const limiters = new RoomSubjectRateLimiters({ maxParticipants: 1 });
		expect(limiters.forSubject("joined-member", 0)).toBeDefined();
		expect(limiters.forSubject("pending-member-1", 0)).toBeDefined();
		expect(limiters.forSubject("pending-member-2", 0)).toBeDefined();

		expect(limiters.forSubject("overflow-member", 0)).toBeUndefined();
	});
});
