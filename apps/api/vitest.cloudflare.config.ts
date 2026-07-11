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
				},
			},
		}),
	],
	test: {
		include: ["test/runtime/**/*.ts"],
	},
});
