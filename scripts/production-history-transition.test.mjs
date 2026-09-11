import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
	manifest,
	validateInventory,
	validateTarget,
	verifyManifest,
} from "./production-history-transition.mjs";

test("fixed full chain refuses omitted or altered migration bytes", () => {
	verifyManifest();
	assert.equal(manifest.migrations.length, 60);
	assert.throws(() =>
		verifyManifest([{ ...manifest.migrations[0], sha256: "bad" }]),
	);
	assert.throws(() =>
		verifyManifest(
			manifest.migrations.map((m, i) =>
				i === 37 ? { ...m, sha256: "bad" } : m,
			),
		),
	);
});
test("Vercel hold exits with its actual ignored-build convention", () => {
	const file = new URL("./production-deployment-hold.mjs", import.meta.url);
	for (const [branch, environment, expected] of [
		["main", "production", 0],
		["main", "preview", 0],
		["feature", "production", 0],
		["staging", "preview", 1],
		["feature", "preview", 1],
	]) {
		const r = spawnSync(process.execPath, [file.pathname], {
			encoding: "utf8",
			env: {
				...process.env,
				VERCEL_GIT_COMMIT_REF: branch,
				VERCEL_ENV: environment,
			},
		});
		assert.equal(r.status, expected, `${branch}/${environment}`);
	}
});
test("archive-only requires the exact reviewed inert inventory", () => {
	validateInventory(manifest.inventory);
	for (const table of Object.keys(manifest.inventory)) {
		assert.throws(
			() =>
				validateInventory({ ...manifest.inventory, [table]: { count: 999 } }),
			table,
		);
	}
	assert.throws(() =>
		validateInventory({
			...manifest.inventory,
			watch_sessions: { count: 6, schemas: [2] },
		}),
	);
});
test("disposable driver cannot impersonate either remote project", () => {
	for (const project of ["bynsjjxzatxndzjkogim", "cyppqpprkygjloyfvvvj"]) {
		assert.throws(() => validateTarget({ project, hostPort: 55692 }));
	}
	assert.throws(() =>
		validateTarget({
			project: "anidachi-prod-transition-20260912",
			hostPort: 54322,
		}),
	);
});
test("production delivery is held without credentials or apply; staging stays enabled", () => {
	const db = readFileSync(
		new URL("../.github/workflows/db-production.yml", import.meta.url),
		"utf8",
	);
	assert.doesNotMatch(db, /secrets\.|supabase.*db push|Apply migrations/);
	assert.match(db, /exit 1/);
	const api = readFileSync(
		new URL("../.github/workflows/deploy-api.yml", import.meta.url),
		"utf8",
	);
	assert.match(api, /github\.ref_name == 'staging'/);
	assert.match(api, /production-hold:/);
	const vercel = JSON.parse(
		readFileSync(new URL("../apps/web/vercel.json", import.meta.url), "utf8"),
	);
	assert.match(vercel.ignoreCommand, /production-deployment-hold/);
});
