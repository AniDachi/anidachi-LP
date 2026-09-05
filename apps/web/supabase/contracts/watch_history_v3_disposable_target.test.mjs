import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
	assertPreTransitionPrerequisite,
	assertV3Prerequisite,
	DISPOSABLE_ACKNOWLEDGEMENT,
	DISPOSABLE_MARKER_NAME,
	requireDisposableTarget,
	requireOutputPath,
	requireTransitionAcknowledgement,
} from "./watch_history_v3_disposable_target.mjs";

const fixtures = [];
function fixture({ marker = true } = {}) {
	const workdir = mkdtempSync(join(tmpdir(), "watch-history-v3-target-"));
	fixtures.push(workdir);
	const project = "watch-history-v3-test-project";
	const container = `supabase_db_${project}`;
	const hostPort = 55461;
	mkdirSync(join(workdir, "supabase"));
	writeFileSync(
		join(workdir, "supabase/config.toml"),
		`project_id = "${project}"\n\n[db]\nport = ${hostPort}\nmajor_version = 17\n`,
	);
	if (marker) {
		writeFileSync(
			join(workdir, DISPOSABLE_MARKER_NAME),
			`${JSON.stringify({ acknowledgement: DISPOSABLE_ACKNOWLEDGEMENT, project, container, hostPort })}\n`,
		);
	}
	const env = {
		ANIDACHI_DISPOSABLE_DB_ACK: DISPOSABLE_ACKNOWLEDGEMENT,
		ANIDACHI_DISPOSABLE_DB_CONTAINER: container,
		ANIDACHI_DISPOSABLE_DB_HOST_PORT: String(hostPort),
		ANIDACHI_DISPOSABLE_DB_PROJECT: project,
		ANIDACHI_DISPOSABLE_DB_WORKDIR: workdir,
	};
	const inspectOutput = JSON.stringify({
		labels: {
			"com.docker.compose.project": project,
			"com.supabase.cli.project": project,
		},
		ports: {
			"5432/tcp": [{ HostIp: "127.0.0.1", HostPort: String(hostPort) }],
		},
	});
	return { container, env, hostPort, inspectOutput, project, workdir };
}

test.after(() => {
	for (const workdir of fixtures)
		rmSync(workdir, { recursive: true, force: true });
});

test("fails before Docker inspection when explicit target fields are absent", () => {
	let calls = 0;
	assert.throws(
		() =>
			requireDisposableTarget({}, () => {
				calls += 1;
				return { status: 0, stdout: "{}", stderr: "" };
			}),
		/ANIDACHI_DISPOSABLE_DB_ACK/,
	);
	assert.equal(calls, 0);
});

test("accepts a supplied disposable target when config, marker, labels and port agree", () => {
	const current = fixture();
	const target = requireDisposableTarget(current.env, () => ({
		status: 0,
		stdout: current.inspectOutput,
		stderr: "",
	}));
	assert.equal(target.container, current.container);
	assert.equal(target.project, current.project);
	assert.equal(target.hostPort, current.hostPort);
	assert.equal(target.workdir, realpathSync(current.workdir));
});

test("rejects a missing marker, default port, wrong container and wrong Docker labels", () => {
	const unmarked = fixture({ marker: false });
	assert.throws(
		() =>
			requireDisposableTarget(unmarked.env, () => {
				throw new Error("must fail before Docker inspection");
			}),
		/disposable marker/,
	);

	const current = fixture();
	assert.throws(
		() =>
			requireDisposableTarget(
				{ ...current.env, ANIDACHI_DISPOSABLE_DB_HOST_PORT: "54322" },
				() => {
					throw new Error("must fail before Docker inspection");
				},
			),
		/default port 54322/,
	);
	assert.throws(
		() =>
			requireDisposableTarget(
				{
					...current.env,
					ANIDACHI_DISPOSABLE_DB_CONTAINER: "supabase_db_wrong",
				},
				() => {
					throw new Error("must fail before Docker inspection");
				},
			),
		/Container and project identity differ/,
	);
	assert.throws(
		() =>
			requireDisposableTarget(current.env, () => ({
				status: 0,
				stdout: JSON.stringify({
					...JSON.parse(current.inspectOutput),
					labels: { "com.supabase.cli.project": current.project },
				}),
				stderr: "",
			})),
		/com\.docker\.compose\.project/,
	);
});

test("requires explicit output and transition acknowledgement", () => {
	assert.throws(() => requireOutputPath({}, "OUTPUT"), /OUTPUT/);
	assert.equal(
		requireOutputPath({ OUTPUT: "/tmp/watch-history-proof.json" }, "OUTPUT"),
		"/tmp/watch-history-proof.json",
	);
	assert.throws(
		() => requireTransitionAcknowledgement({}),
		/ANIDACHI_WATCH_HISTORY_TRANSITION_ACK/,
	);
	assert.doesNotThrow(() =>
		requireTransitionAcknowledgement({
			ANIDACHI_WATCH_HISTORY_TRANSITION_ACK:
				"RESET_DEDICATED_HISTORY_FIXTURES_ONLY",
		}),
	);
});

test("fails closed when the database is not at the exact required migration state", () => {
	assert.doesNotThrow(() =>
		assertPreTransitionPrerequisite({
			latestMigration: "20260904154732",
			canonicalMigrationApplied: false,
			writeSchemaColumn: false,
			v2WriterAvailable: true,
		}),
	);
	assert.throws(
		() =>
			assertPreTransitionPrerequisite({
				latestMigration: "20260904205540",
				canonicalMigrationApplied: true,
				writeSchemaColumn: true,
				v2WriterAvailable: true,
			}),
		/pre-transition migration/,
	);
	assert.doesNotThrow(() =>
		assertV3Prerequisite({
			latestMigration: "20260904205540",
			canonicalMigrationApplied: true,
			writeSchemaColumn: true,
			v3FunctionsAvailable: true,
		}),
	);
	assert.throws(
		() =>
			assertV3Prerequisite({
				latestMigration: "20260904154732",
				canonicalMigrationApplied: false,
				writeSchemaColumn: false,
				v3FunctionsAvailable: false,
			}),
		/schema-3 migration/,
	);
});
