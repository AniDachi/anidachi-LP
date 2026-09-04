import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

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
          id: "policy_local_preferences",
          label: "Local Preferences",
          file_type: "concept",
          source_file: "policy.md",
          rationale: "Keep user preferences local.",
          _origin: "semantic",
        },
      ],
      links: [],
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
