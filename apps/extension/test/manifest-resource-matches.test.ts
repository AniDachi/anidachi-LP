import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, it, vi } from "vitest";
import { getExtensionManifestKey } from "../src/extension-channel-identity";
const root = resolve(process.cwd(), "../..");
const amazonHosts = [
	"*.amazon.com",
	"*.amazon.co.uk",
	"*.amazon.de",
	"*.amazon.co.jp",
	"*.amazon.ca",
	"*.amazon.in",
	"*.amazon.com.mx",
];
const primeRoutes = [
	"https://*.primevideo.com/*",
	...amazonHosts.flatMap((host) => [
		`https://${host}/Amazon-Video`,
		`https://${host}/Amazon-Video/*`,
		`https://${host}/*/Amazon-Video`,
		`https://${host}/*/Amazon-Video/*`,
		`https://${host}/gp/video`,
		`https://${host}/gp/video/*`,
		`https://${host}/*/gp/video`,
		`https://${host}/*/gp/video/*`,
		`https://${host}/dp/*`,
		`https://${host}/*/dp/*`,
	]),
];
const origins = [
	"https://youtube.com/*",
	"https://*.youtube.com/*",
	"https://youtu.be/*",
	"https://*.youtu.be/*",
	"https://*.youtube-nocookie.com/*",
	"https://www.netflix.com/*",
	"https://*.primevideo.com/*",
	...amazonHosts.map((host) => `https://${host}/*`),
	"https://crunchyroll.com/*",
	"https://*.crunchyroll.com/*",
];
const contentMatches = origins
	.filter((value) => !amazonHosts.some((host) => value === `https://${host}/*`))
	.concat(primeRoutes.slice(1));
function manifest() {
	return {
		name: "AniDachi Staging",
		key: getExtensionManifestKey("staging"),
		minimum_chrome_version: "121",
		permissions: ["alarms", "notifications", "offscreen"],
		icons: { 16: "icon.png", 32: "icon.png", 48: "icon.png", 128: "icon.png" },
		host_permissions: [
			...origins,
			"https://staging.anidachi.app/*",
			"https://anidachi-api-staging.vladislav-gul7.workers.dev/*",
		],
		externally_connectable: {
			matches: ["https://staging.anidachi.app/*"],
			ids: [],
		},
		background: { service_worker: "background.js" },
		web_accessible_resources: [
			{ resources: ["Anidachi_logo.png"], matches: [...origins] },
			{ resources: ["prime-media-tile.html"], matches: ["https://*.primevideo.com/*", ...amazonHosts.map(host => `https://${host}/*`)] },
		],
		content_scripts: [
			{ matches: contentMatches, js: ["content.js"] },
			{
				world: "MAIN",
				matches: primeRoutes,
				run_at: "document_start",
				all_frames: false,
				js: ["prime.js"],
			},
		],
	};
}
function validate(value: ReturnType<typeof manifest>) {
	const dir = mkdtempSync(join(tmpdir(), "anidachi-war-regression-"));
	try {
		writeFileSync(join(dir, "manifest.json"), JSON.stringify(value));
		writeFileSync(
			join(dir, "background.js"),
			'const build="test-staging-fixture";',
		);
		return spawnSync(
			process.execPath,
			[
				join(root, "scripts/validate-extension-artifact.mjs"),
				"--channel",
				"staging",
				"--dir",
				dir,
			],
			{ encoding: "utf8" },
		);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}
it("accepts explicit official resource origins while retaining narrow Prime MAIN routes", () => {
	const value = manifest();
	const result = validate(value);
	expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
});
it("rejects a video catalogue matched only by the MAIN bridge", () => {
	const value = manifest();
	value.content_scripts[0]!.matches = contentMatches.filter(
		(match) => match !== "https://*.amazon.com/Amazon-Video/*",
	);
	expect(validate(value).stderr).toContain("Missing overlay matches");
});
it.each([
	"/gp/video/*",
	"/dp/*",
	"/*/dp/*",
])("rejects Chrome-invalid WAR path %s independently of expected allowlists", (path) => {
	const value = manifest();
	value.web_accessible_resources[0]!.matches.push(
		`https://www.amazon.com${path}`,
	);
	const result = validate(value);
	expect(result.status).not.toBe(0);
	expect(result.stderr).toContain(
		"Invalid web_accessible_resources match pattern",
	);
});
it("generates Chrome-valid resource origins without broadening content routes", async () => {
	vi.stubEnv("WXT_EXTENSION_CHANNEL", "staging");
	vi.stubEnv("WXT_BROAD_HOST_PERMISSIONS", "false");
	try {
		const { default: config } = await import("../wxt.config");
		const { PRIME_CONTENT_MATCHES } = await import(
			"../src/source-adapters/primevideo/url"
		);
		expect(new Set(PRIME_CONTENT_MATCHES)).toEqual(new Set(primeRoutes));
		const resourceMatches = (
			config.manifest as { web_accessible_resources: { matches: string[] }[] }
		).web_accessible_resources[0]!.matches;
		expect(new Set(resourceMatches)).toEqual(new Set(origins));
		expect(
			resourceMatches.every((value) => /^https:\/\/[^/]+\/\*$/.test(value)),
		).toBe(true);
	} finally {
		vi.unstubAllEnvs();
	}
});

it.each([
	"https://*/*",
	"https://*.amazon.fr/*",
	"http://*.amazon.com/*",
	"https://*amazon.com/*",
	"https://*.amazon.com.evil/*",
])("rejects unapproved family permission %s", (pattern) => {
	const value = manifest();
	value.host_permissions.push(pattern);
	const result = validate(value);
	expect(result.status).not.toBe(0);
});
it("rejects a globally broadened MAIN bridge even with an otherwise approved manifest", () => {
	const value = manifest();
	value.content_scripts[1]!.matches.push("https://*/*");
	expect(validate(value).status).not.toBe(0);
});
