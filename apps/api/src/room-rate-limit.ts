export type RoomEventClass = "ice" | "sdp" | "control";

export interface RoomRateLimitDecision {
	allowed: boolean;
	close: boolean;
	retryAfterMs: number;
}

const WINDOW_MS = 10_000;
const TOTAL_LIMIT = 120;
const CLASS_LIMITS: Record<RoomEventClass, number> = {
	ice: 80,
	sdp: 8,
	control: 40,
};

export class RoomRateLimiter {
	private windowStartedAt: number | null = null;
	private total = 0;
	private rejections = 0;
	private readonly classes: Record<RoomEventClass, number> = {
		ice: 0,
		sdp: 0,
		control: 0,
	};

	consume(eventClass: RoomEventClass, now = Date.now()): RoomRateLimitDecision {
		const total = this.consumeTotal(now);
		return total.allowed ? this.consumeClass(eventClass, now) : total;
	}

	consumeTotal(now = Date.now()): RoomRateLimitDecision {
		this.ensureWindow(now);
		if (this.total >= TOTAL_LIMIT) return this.reject(now);

		this.total += 1;
		return { allowed: true, close: false, retryAfterMs: 0 };
	}

	consumeClass(eventClass: RoomEventClass, now = Date.now()): RoomRateLimitDecision {
		this.ensureWindow(now);
		if (this.classes[eventClass] >= CLASS_LIMITS[eventClass]) return this.reject(now);

		this.classes[eventClass] += 1;
		return { allowed: true, close: false, retryAfterMs: 0 };
	}

	private ensureWindow(now: number): void {
		if (this.windowStartedAt === null || now - this.windowStartedAt >= WINDOW_MS) {
			this.reset(now);
		}
	}

	private reject(now: number): RoomRateLimitDecision {
		this.rejections += 1;
		const retryAfterMs = Math.max(0, (this.windowStartedAt ?? now) + WINDOW_MS - now);
		return { allowed: false, close: this.rejections >= 3, retryAfterMs };
	}

	private reset(now: number): void {
		this.windowStartedAt = now;
		this.total = 0;
		this.rejections = 0;
		this.classes.ice = 0;
		this.classes.sdp = 0;
		this.classes.control = 0;
	}
}
