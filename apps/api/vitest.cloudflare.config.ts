import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Native fetch regression fixture: never permit external traffic from tests.
let schedulerRequests = 0;
let redirectedRequests = 0;

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.toml" },
			miniflare: {
				outboundService: async (request: { url: string }) => {
					if (request.url === "http://127.0.0.1:3003/api/internal/notifications/drain") {
						schedulerRequests++;
						return new Response(null, { status: 302, headers: { Location: "https://redirect.invalid/drain" } });
					}
					if (request.url === "https://redirect.invalid/drain") {
						redirectedRequests++;
						return Response.json({ ok: true });
					}
					if (request.url === "https://scheduler-test.invalid/counts") {
						return Response.json({ schedulerRequests, redirectedRequests });
					}
					throw new Error("Unexpected outbound runtime test request");
				},
				bindings: {
					ANIDACHI_JWT_SECRET: "anidachi-runtime-test-secret",
					ANIDACHI_INTERNAL_API_SECRET: "anidachi-runtime-internal-secret",
					ANIDACHI_WEB_INTERNAL_BASE_URL: "https://web.internal",
				},
			},
		}),
	],
	test: {
		include: ["test/runtime/**/*.ts"],
	},
});
