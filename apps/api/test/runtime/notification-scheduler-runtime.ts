import {
	SELF,
	createExecutionContext,
	createScheduledController,
	waitOnExecutionContext,
} from "cloudflare:test";
import { afterEach, expect, it, vi } from "vitest";
import worker from "../../src/index";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

it("native Workerd fetch rejects a cross-origin redirect without forwarding the bearer", async () => {
	vi.spyOn(console, "error").mockImplementation(() => {});
	const before = await (
		await fetch("https://scheduler-test.invalid/counts")
	).json<{ schedulerRequests: number; redirectedRequests: number }>();
	const ctx = createExecutionContext();
	await expect(
		worker.scheduled(
			createScheduledController({ cron: "* * * * *" }),
			{
				ANIDACHI_ENV: "local",
				ANIDACHI_WEB_INTERNAL_BASE_URL: "http://127.0.0.1:3003",
				ANIDACHI_INTERNAL_API_SECRET: "runtime-test-secret",
			},
			ctx,
		),
	).rejects.toThrow("notification_drain_unavailable");
	await waitOnExecutionContext(ctx);
	const after = await (
		await fetch("https://scheduler-test.invalid/counts")
	).json<{ schedulerRequests: number; redirectedRequests: number }>();
	expect(after.schedulerRequests - before.schedulerRequests).toBe(1);
	expect(after.redirectedRequests - before.redirectedRequests).toBe(0);
});

it("keeps the deployed fetch entrypoint healthy without invoking notification recovery", async () => {
	const http = vi.fn(() => {
		throw new Error("Unexpected recovery HTTP");
	});
	vi.stubGlobal("fetch", http);
	const response = await SELF.fetch("https://worker.test/");
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ ok: true, service: "anidachi-api" });
	expect(http).not.toHaveBeenCalled();
});

it("runs the actual scheduled export with Workers Request and streaming Response APIs", async () => {
	const http = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = new Request(input, init);
		expect(request.url).toBe(
			"https://staging.anidachi.app/api/internal/notifications/drain",
		);
		expect(request.method).toBe("POST");
		expect(request.redirect).toBe("manual");
		expect(request.headers.get("authorization")).toBe(
			"Bearer runtime-test-secret",
		);
		expect(await request.text()).toBe("");
		return new Response(
			new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode('{"ok":'));
					controller.enqueue(new TextEncoder().encode("true}"));
					controller.close();
				},
			}),
		);
	});
	vi.stubGlobal("fetch", http);
	const ctx = createExecutionContext();
	const result = await worker
		.scheduled(
			createScheduledController({ cron: "* * * * *" }),
			{
				ANIDACHI_ENV: "staging",
				ANIDACHI_WEB_INTERNAL_BASE_URL: "https://staging.anidachi.app",
				ANIDACHI_INTERNAL_API_SECRET: "runtime-test-secret",
			},
			ctx,
		)
		?.catch((error) => error);
	await expect(http.mock.results[0]?.value).resolves.toBeInstanceOf(Response);
	expect(result).toBeUndefined();
	await waitOnExecutionContext(ctx);
	expect(http).toHaveBeenCalledOnce();
});

it("makes infrastructure failure reject the Workers scheduled invocation", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () =>
			Response.json(
				{ error: "Notification drain unavailable" },
				{ status: 503 },
			),
		),
	);
	vi.spyOn(console, "error").mockImplementation(() => {});
	const ctx = createExecutionContext();
	await expect(
		worker.scheduled(
			createScheduledController({ cron: "* * * * *" }),
			{
				ANIDACHI_ENV: "staging",
				ANIDACHI_WEB_INTERNAL_BASE_URL: "https://staging.anidachi.app",
				ANIDACHI_INTERNAL_API_SECRET: "runtime-test-secret",
			},
			ctx,
		),
	).rejects.toThrow("notification_drain_unavailable");
	await waitOnExecutionContext(ctx);
});
