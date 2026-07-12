import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.toml" },
			miniflare: {
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
