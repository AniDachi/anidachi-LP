import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";

const event = { cron: "* * * * *", scheduledTime: 0, noRetry() {} };
const environment = {
	ANIDACHI_ENV: "staging",
	ANIDACHI_WEB_INTERNAL_BASE_URL: "https://staging.anidachi.app",
	ANIDACHI_INTERNAL_API_SECRET: "scheduler-test-secret",
	get ROOMS(): never {
		throw new Error("Scheduler must not access rooms");
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

describe("notification scheduled recovery boundary", () => {
	it("exposes independent scheduled recovery on the actual entrypoint", async () => {
		expect(typeof worker.scheduled).toBe("function");
		await worker.scheduled(event, environment, ctx);
		expect(http).toHaveBeenCalledOnce();
		const [url, init] = http.mock.calls[0] ?? [];
		expect(String(url)).toBe(
			"https://staging.anidachi.app/api/internal/notifications/drain",
		);
		expect(init).toMatchObject({
			method: "POST",
			redirect: "manual",
			headers: { Authorization: "Bearer scheduler-test-secret" },
		});
		expect(init?.body).toBeUndefined();
		expect(console.info).toHaveBeenCalledWith(
			"[anidachi/inbox-push] scheduler",
			{
				outcome: "completed",
				durationMs: expect.any(Number),
			},
		);
	});

	it.each([
		["production", "https://www.anidachi.app"],
		["local", "http://localhost:3003"],
		["local", "http://127.0.0.1:3003"],
		["local", "http://[::1]:3003"],
	])("uses only the exact %s target %s", async (env, base) => {
		await worker.scheduled(
			event,
			{
				ANIDACHI_INTERNAL_API_SECRET: "scheduler-test-secret",
				ANIDACHI_ENV: env,
				ANIDACHI_WEB_INTERNAL_BASE_URL: base,
			},
			ctx,
		);
		expect(String(http.mock.calls[0]?.[0])).toBe(
			`${base}/api/internal/notifications/drain`,
		);
	});

	it.each([
		[undefined, "https://staging.anidachi.app"],
		["unknown", "https://staging.anidachi.app"],
		["staging", undefined],
		["staging", "https://www.anidachi.app"],
		["production", "https://staging.anidachi.app"],
		["local", "https://staging.anidachi.app"],
		["staging", "http://staging.anidachi.app"],
		["staging", "https://staging.anidachi.app.evil.example"],
		["staging", "https://user:password@staging.anidachi.app"],
		["staging", "https://staging.anidachi.app?x=1"],
		["staging", "https://staging.anidachi.app#x"],
		["staging", "https://staging.anidachi.app/redirect"],
		["staging", "https://staging.anidachi.app/"],
		["staging", "https://staging.anidachi.app:444"],
		["staging", " https://staging.anidachi.app"],
		["local", "http://localhost.evil.example:3003"],
		["local", "http://127.0.0.2:3003"],
	])("rejects environment %s and URL %s without sending the bearer", async (env, base) => {
		await expect(
			worker.scheduled(
				event,
				{
					...(env ? { ANIDACHI_ENV: env } : {}),
					...(base ? { ANIDACHI_WEB_INTERNAL_BASE_URL: base } : {}),
					ANIDACHI_INTERNAL_API_SECRET: "scheduler-test-secret",
				},
				ctx,
			),
		).rejects.toThrow("notification_drain_unavailable");
		expect(http).not.toHaveBeenCalled();
	});

	it("fails before HTTP when the internal secret is missing", async () => {
		await expect(
			worker.scheduled(
				event,
				{
					ANIDACHI_ENV: "staging",
					ANIDACHI_WEB_INTERNAL_BASE_URL: "https://staging.anidachi.app",
				},
				ctx,
			),
		).rejects.toThrow("notification_drain_unavailable");
		expect(http).not.toHaveBeenCalled();
	});

	it.each([
		"null",
		"[]",
		'{"ok":false}',
		'{"ok":true,"extra":1}',
		"<html>gate</html>",
	])("rejects a malformed acknowledgement %s", async (body) => {
		http.mockResolvedValue(new Response(body));
		await expect(worker.scheduled(event, environment, ctx)).rejects.toThrow(
			"notification_drain_unavailable",
		);
	});

	it.each([
		302, 401, 503,
	])("rejects HTTP %s even with an ok body", async (status) => {
		http.mockResolvedValue(Response.json({ ok: true }, { status }));
		await expect(worker.scheduled(event, environment, ctx)).rejects.toThrow(
			"notification_drain_unavailable",
		);
	});

	it("cancels a chunked body above 1024 bytes without trusting content length", async () => {
		const cancel = vi.fn();
		const encoder = new TextEncoder();
		http.mockResolvedValue(
			new Response(
				new ReadableStream({
					start(controller) {
						controller.enqueue(encoder.encode(" ".repeat(1000)));
						controller.enqueue(encoder.encode(" ".repeat(25)));
					},
					cancel,
				}),
				{ headers: { "content-length": "11" } },
			),
		);
		await expect(worker.scheduled(event, environment, ctx)).rejects.toThrow(
			"notification_drain_unavailable",
		);
		expect(cancel).toHaveBeenCalledOnce();
	});

	it("accepts the exact 1024-byte boundary", async () => {
		http.mockResolvedValue(new Response(`${" ".repeat(1012)}{"ok":true} `));
		await worker.scheduled(event, environment, ctx);
	});

	it("aborts hanging fetch at 40 seconds with sanitized failure diagnostics", async () => {
		vi.useFakeTimers();
		let signal: AbortSignal | undefined;
		http.mockImplementation(async (_url, init) => {
			signal = init?.signal ?? undefined;
			if (!signal) throw new Error("Missing request abort signal");
			return await new Promise((_resolve, reject) =>
				signal?.addEventListener(
					"abort",
					() => reject(new Error("secret endpoint raw failure")),
					{ once: true },
				),
			);
		});
		const pending = worker.scheduled(event, environment, ctx);
		const rejected = expect(pending).rejects.toThrow(
			"notification_drain_unavailable",
		);
		await vi.advanceTimersByTimeAsync(39_999);
		expect(signal?.aborted).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		await rejected;
		expect(signal?.aborted).toBe(true);
		expect(console.error).toHaveBeenCalledWith(
			"[anidachi/inbox-push] scheduler",
			{
				outcome: "unavailable",
				durationMs: expect.any(Number),
			},
		);
		expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
			"secret endpoint",
		);
	});

	it("shares the 40-second deadline across fetch and a stalled body", async () => {
		vi.useFakeTimers();
		let signal: AbortSignal | undefined;
		const cancel = vi.fn();
		http.mockImplementation(async (_url, init) => {
			signal = init?.signal ?? undefined;
			await new Promise((resolve) => setTimeout(resolve, 30_000));
			return new Response(new ReadableStream({ cancel }));
		});
		const pending = worker.scheduled(event, environment, ctx);
		const rejected = expect(pending).rejects.toThrow(
			"notification_drain_unavailable",
		);
		await vi.advanceTimersByTimeAsync(39_999);
		expect(signal?.aborted).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		await rejected;
		expect(signal?.aborted).toBe(true);
		expect(cancel).toHaveBeenCalledOnce();
	});
});
