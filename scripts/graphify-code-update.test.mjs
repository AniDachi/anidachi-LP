import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
	new URL("./graphify-code-update.mjs", import.meta.url),
);

// Opt-in integration test: requires the locally installed Graphify CLI.
// Never runs against, or mutates, the repository's graph.
test("code refresh normalizes imports, updates the report, and preserves semantic state", async (t) => {
	const directory = await mkdtemp(join(tmpdir(), "anidachi-graphify-test-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await mkdir(join(directory, "graphify-out"));
	await writeFile(join(directory, "constants.ts"), "export const LIMIT = 4;\n");
	await writeFile(
		join(directory, "consumer.ts"),
		'import { LIMIT } from "./constants";\nexport function count() { return LIMIT; }\n',
	);
	await writeFile(
		join(directory, "policy.md"),
		"# Policy\nKeep user preferences local.\n",
	);
	await writeFile(
		join(directory, "graphify-out", "graph.json"),
		JSON.stringify({
			nodes: [
				{
					id: "policy_file_mention",
					label: "constants.ts",
					source_file: "policy.md",
					file_type: "concept",
					_origin: "semantic",
					rationale:
						"The policy discusses this file; it is not the code definition.",
				},
				{
					id: "policy_local_preferences",
					label: "Local Preferences",
					file_type: "concept",
					source_file: "policy.md",
					rationale: "Keep user preferences local.",
					_origin: "semantic",
				},
			],
			links: [
				{
					source: "policy_file_mention",
					target: "policy_local_preferences",
					relation: "references",
					source_file: "policy.md",
				},
				{
					source: "policy_local_preferences",
					target: "policy_file_mention",
					relation: "explains",
					source_file: "policy.md",
				},
			],
			directed: false,
		}),
	);
	await writeFile(
		join(directory, "graphify-out", "GRAPH_REPORT.md"),
		"STALE REPORT\n",
	);

	function refresh() {
		const result = spawnSync(process.execPath, [script], {
			cwd: directory,
			env: { ...process.env, GRAPHIFY_VIZ_NODE_LIMIT: "0" },
			encoding: "utf8",
			timeout: 30_000,
		});
		assert.equal(
			result.status,
			0,
			result.stderr || result.stdout || result.error?.message,
		);
	}

	refresh();
	const graphPath = join(directory, "graphify-out", "graph.json");
	const reportPath = join(directory, "graphify-out", "GRAPH_REPORT.md");
	const graphText = await readFile(graphPath, "utf8");
	const graph = JSON.parse(graphText);
	assert.ok(
		graph.nodes.some((n) => n.id === "policy_file_mention"),
		"retain document concepts named after code files",
	);
	assert.equal(
		graph.links.filter((e) => e.source_file === "policy.md").length,
		2,
		"retain both directions and relations",
	);
	const ids = new Set(graph.nodes.map((node) => node.id));
	assert.ok(graph.links.some((edge) => edge.relation === "imports"));
	assert.ok(
		graph.links.every((edge) => ids.has(edge.source) && ids.has(edge.target)),
		"persisted import edges must resolve to graph nodes",
	);
	assert.ok(
		graph.nodes.some((node) => node.id === "policy_local_preferences"),
		"code-only refresh must retain semantic concepts",
	);
	const report = await readFile(reportPath, "utf8");
	assert.ok(
		!report.includes("STALE REPORT"),
		"graph and report must be refreshed together",
	);
	const manifest = JSON.parse(
		await readFile(join(directory, "graphify-out", "manifest.json"), "utf8"),
	);
	assert.ok(
		!manifest["policy.md"]?.semantic_hash,
		"code-only refresh must not certify unextracted document semantics",
	);

	refresh();
	assert.equal(
		await readFile(graphPath, "utf8"),
		graphText,
		"unchanged refresh must not churn the graph",
	);
	assert.equal(
		await readFile(reportPath, "utf8"),
		report,
		"unchanged refresh must not churn the report",
	);

	const policyPath = join(directory, "policy.md");
	const fragmentPath = join(directory, "fragment.json");
	const policy =
		"# Policy\nKeep preferences local and preserve user control.\n";
	await writeFile(policyPath, policy);
	const fragment = {
		source_hashes: { "policy.md": "stale" },
		nodes: [
			{
				id: "policy_current",
				label: "Current policy",
				source_file: "policy.md",
				_origin: "semantic",
			},
		],
		edges: [],
		hyperedges: [],
	};
	await writeFile(fragmentPath, JSON.stringify(fragment));
	const manifestPath = join(directory, "graphify-out", "manifest.json");
	const beforeManifest = await readFile(manifestPath, "utf8");
	const stale = spawnSync(
		process.execPath,
		[script, "--semantic", fragmentPath],
		{
			cwd: directory,
			encoding: "utf8",
			timeout: 30_000,
		},
	);
	assert.equal(stale.status, 1);
	assert.match(stale.stderr, /Stale semantic fragment/);
	assert.equal(await readFile(graphPath, "utf8"), graphText);
	assert.equal(await readFile(reportPath, "utf8"), report);
	assert.equal(await readFile(manifestPath, "utf8"), beforeManifest);
	fragment.source_hashes["policy.md"] = createHash("sha256")
		.update(policy)
		.digest("hex");
	await writeFile(fragmentPath, JSON.stringify(fragment));
	const semantic = spawnSync(
		process.execPath,
		[script, "--semantic", fragmentPath],
		{
			cwd: directory,
			encoding: "utf8",
			timeout: 30_000,
		},
	);
	assert.equal(semantic.status, 0, semantic.stderr);
	const refreshed = JSON.parse(await readFile(graphPath, "utf8"));
	assert.ok(refreshed.nodes.some((n) => n.id === "policy_current"));
	assert.ok(!refreshed.nodes.some((n) => n.id === "policy_local_preferences"));
	assert.ok(refreshed.links.some((e) => e.relation === "imports"));
	assert.equal(
		JSON.parse(await readFile(manifestPath, "utf8"))["policy.md"].semantic_hash,
		createHash("md5").update(policy).digest("hex"),
	);
	await rm(join(directory, "consumer.ts"));
	refresh();
	const afterDelete = JSON.parse(await readFile(graphPath, "utf8"));
	assert.ok(!afterDelete.nodes.some((n) => n.source_file === "consumer.ts"));
	assert.ok(afterDelete.nodes.some((n) => n.id === "policy_current"));
	assert.ok(!JSON.parse(await readFile(manifestPath, "utf8"))["consumer.ts"]);
});

test("a missing Graphify executable reports failure", async (t) => {
	const directory = await mkdtemp(join(tmpdir(), "anidachi-graphify-missing-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const result = spawnSync(process.execPath, [script], {
		cwd: directory,
		env: { ...process.env, PATH: directory },
		encoding: "utf8",
		timeout: 5_000,
	});
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Failed to start Graphify/);
});
