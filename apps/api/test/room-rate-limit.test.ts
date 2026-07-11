import { describe, expect, it } from "vitest";
import { RoomRateLimiter } from "../src/room-rate-limit";

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
});
