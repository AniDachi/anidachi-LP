import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";

const event = { cron: "*/2 * * * *", scheduledTime: 0, noRetry() {} };
const environment = {
	ANIDACHI_ENV: "staging",
	ANIDACHI_WEB_INTERNAL_BASE_URL: "https://staging.anidachi.app",
	ANIDACHI_INTERNAL_API_SECRET: "synthetic-recovery-secret",
	ANIDACHI_FREE20_ACCOUNTING_ENABLED: "true",
	get ROOMS(): never {
		throw new Error("Recovery must not enumerate rooms");
	},
};
const ctx = {
	waitUntil: vi.fn(),
	passThroughOnException: vi.fn(),
	props: {},
	exports: {},
};
let http: ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(() => {
	http = vi
		.fn<typeof fetch>()
		.mockImplementation(async () => Response.json({ ok: true }));
	vi.stubGlobal("fetch", http);
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("Free20 independent scheduled recovery", () => {
	it.each([
		undefined,
		"false",
		"TRUE",
		" true ",
	])("does no work with flag %j", async (flag) => {
		await worker.scheduled(
			event,
			{
				...(flag === undefined
					? {}
					: { ANIDACHI_FREE20_ACCOUNTING_ENABLED: flag }),
				get ANIDACHI_WEB_INTERNAL_BASE_URL(): never {
					throw new Error("Disabled must not read delivery config");
				},
			},
			ctx,
		);
		expect(http).not.toHaveBeenCalled();
	});
	it("stops at closed maintenance before config or feature flag", async () => {
		const env = new Proxy(
			{ ANIDACHI_MAINTENANCE_MODE: "closed" },
			{
				get(target, key) {
					if (key !== "ANIDACHI_MAINTENANCE_MODE")
						throw new Error("Closed must not read bindings");
					return target.ANIDACHI_MAINTENANCE_MODE;
				},
			},
		);
		await worker.scheduled(event, env, ctx);
		expect(http).not.toHaveBeenCalled();
	});
	it.each([
		["staging", "https://staging.anidachi.app"],
		["production", "https://www.anidachi.app"],
	])("dispatches only Free20 recovery for %s", async (env, base) => {
		await worker.scheduled(
			event,
			Object.assign(Object.create(environment), {
				ANIDACHI_ENV: env,
				ANIDACHI_WEB_INTERNAL_BASE_URL: base,
			}),
			ctx,
		);
		expect(http).toHaveBeenCalledExactlyOnceWith(
			`${base}/api/internal/rooms/free20-refresh/drain`,
			expect.objectContaining({
				method: "POST",
				redirect: "manual",
				headers: { Authorization: "Bearer synthetic-recovery-secret" },
				signal: expect.any(AbortSignal),
			}),
		);
		expect(http.mock.calls[0]?.[1]?.body).toBeUndefined();
	});
	it("keeps the old minute trigger routed only to notifications", async () => {
		await worker.scheduled({ ...event, cron: "* * * * *" }, environment, ctx);
		expect(http).toHaveBeenCalledOnce();
		expect(http.mock.calls[0]?.[0]).toBe(
			"https://staging.anidachi.app/api/internal/notifications/drain",
		);
	});
	it("ignores an unknown schedule without reading delivery config", async () => {
		await worker.scheduled({ ...event, cron: "0 0 * * *" }, {}, ctx);
		expect(http).not.toHaveBeenCalled();
	});
	it("rejects a mismatched canonical origin before sending the bearer", async () => {
		await expect(
			worker.scheduled(
				event,
				Object.assign(Object.create(environment), {
					ANIDACHI_WEB_INTERNAL_BASE_URL: "https://www.anidachi.app",
				}),
				ctx,
			),
		).rejects.toThrow("free20_refresh_drain_unavailable");
		expect(http).not.toHaveBeenCalled();
	});
	it.each([
		302, 401, 503,
	])("keeps recovery failed on HTTP %s", async (status) => {
		http.mockResolvedValue(Response.json({ ok: true }, { status }));
		await expect(worker.scheduled(event, environment, ctx)).rejects.toThrow(
			"free20_refresh_drain_unavailable",
		);
	});
	it("rejects non-minimal acknowledgements", async () => {
		http.mockResolvedValue(Response.json({ ok: true, roomId: "unexpected" }));
		await expect(worker.scheduled(event, environment, ctx)).rejects.toThrow(
			"free20_refresh_drain_unavailable",
		);
	});
	it("bounds stalled response bodies and aborts delivery", async () => {
		vi.useFakeTimers();
		http.mockResolvedValue(new Response(new ReadableStream({ start() {} })));
		const request = Promise.resolve(worker.scheduled(event, environment, ctx));
		const outcome = request.then(
			() => null,
			(error: Error) => error,
		);
		await vi.advanceTimersByTimeAsync(40_000);
		expect((await outcome)?.message).toBe("free20_refresh_drain_unavailable");
		expect(http.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
	});
	it("never configures a second notification timer on staging", () => {
		const config = readFileSync(
			new URL("../wrangler.toml", import.meta.url),
			"utf8",
		);
		const staging = config.split("[env.staging.triggers]")[1]?.split("\n[")[0];
		const production = config
			.split("[env.production.triggers]")[1]
			?.split("\n[")[0];
		expect(staging).toContain('crons = ["*/2 * * * *"]');
		expect(production).toContain('crons = ["* * * * *", "*/2 * * * *"]');
	});
});
