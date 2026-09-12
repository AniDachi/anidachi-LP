import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { buildArtifacts } from "./production-history-hosted-artifacts.mjs";
import {
	assessPrefixAttempt,
	CLI_BINARY_SHA256,
	CLI_VERSION,
	captureSql,
} from "./production-history-prefix-proof.mjs";
import { manifest } from "./production-history-transition.mjs";

const binding = {
	projectRef: "abcdefghijklmnopqrst",
	host: "db.abcdefghijklmnopqrst.supabase.co",
	port: 5432,
	database: "postgres",
	user: "postgres",
	sessionUser: "postgres",
	nonce: "a".repeat(32),
	releaseCommit: "b".repeat(40),
	backupSha256: "c".repeat(64),
};
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const name = (migration) =>
	migration.file.slice(migration.version.length + 1, -4);
const ledger = (length) =>
	manifest.migrations.slice(0, length).map((migration) => ({
		version: migration.version,
		name: name(migration),
	}));

function fault(prefix) {
	const migration = manifest.migrations[prefix];
	return {
		name: "rehearsal_deny_one_version",
		tableSchema: "supabase_migrations",
		tableName: "schema_migrations",
		type: "c",
		validated: false,
		noInherit: false,
		deferrable: false,
		deferred: false,
		definition: `CHECK ((version <> '${migration.version}'::text)) NOT VALID`,
		expression: `(version <> '${migration.version}'::text)`,
	};
}

function stdoutFor(prefix) {
	const version = manifest.migrations[prefix].version;
	return `${JSON.stringify({
		_tag: "Error",
		error: {
			code: "LegacyDbPushApplyError",
			message:
				`ERROR: new row for relation "schema_migrations" violates check constraint "rehearsal_deny_one_version" (SQLSTATE 23514)\n` +
				`Failing row contains (${version}, {"alter table public.rooms add column presence_room_generation bigint","create function public.record_recent_room_presence_v1(p_evidence jsonb) returns jsonb..."}, ${name(manifest.migrations[prefix])}).\n` +
				"At statement: 5\n" +
				"INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES($1, $2, $3)",
		},
	})}\n`;
}

function proof(prefix) {
	const artifacts = buildArtifacts(binding);
	const document = JSON.parse(artifacts["input.json"]);
	const touched = { column: null, namedCheck: null, function: null };
	const control = {
		rowCount: 1,
		phase: "prepared",
		preparedAt: "2026-09-12T01:00:00.000Z",
		maintenance: true,
		documentBinding: {
			transition: document.transition,
			productionProject: document.productionProject,
			target: document.target,
			sourceCommit: document.sourceCommit,
			manifestSha256: document.manifestSha256,
			bridgeSha256: document.bridgeSha256,
			backupSha256: document.backupSha256,
		},
		archiveRelationCount: document.publicTables.length,
		archivedRelationCount: Object.keys(document.inventory).length,
		archivedRowCount: Object.values(document.inventory).reduce(
			(sum, item) => sum + item.count,
			0,
		),
		missingMaintenanceHolds: [],
	};
	const receiptBase = {
		format: 1,
		expectedPrefix: prefix,
		binding,
		source: {
			transition: document.transition,
			sourceCommit: document.sourceCommit,
			manifestSha256: document.manifestSha256,
			bridgeSha256: document.bridgeSha256,
		},
		control,
		touched,
	};
	const before = {
		...receiptBase,
		observedAt: "2026-09-12T01:00:01.000Z",
		capturedLocallyAt: "2026-09-12T01:00:02.000Z",
		ledger: ledger(35),
		fault: null,
	};
	const after = {
		...receiptBase,
		observedAt: "2026-09-12T01:00:05.000Z",
		capturedLocallyAt: "2026-09-12T01:00:06.000Z",
		ledger: ledger(prefix),
		fault: fault(prefix),
	};
	const stdout = stdoutFor(prefix);
	const stderr = "";
	const attempt = {
		binding,
		expectedPrefix: prefix,
		cli: { version: CLI_VERSION, binarySha256: CLI_BINARY_SHA256 },
		startedAt: "2026-09-12T01:00:03.000Z",
		endedAt: "2026-09-12T01:00:04.000Z",
		exitCode: 1,
		stdoutSha256: sha256(stdout),
		stderrSha256: sha256(stderr),
	};
	return {
		binding,
		expectedPrefix: prefix,
		before,
		after,
		attempt,
		stdout,
		stderr,
	};
}

const clone = (value) => structuredClone(value);

test("capture is fixed, guarded, read-only SQL and requires a real backup hash", () => {
	const sql = captureSql(binding, 50);
	assert.match(sql, /REHEARSAL_TARGET_MISMATCH/);
	assert.match(sql, /begin read only;/);
	assert.match(sql, /presence_room_generation/);
	assert.match(sql, /record_recent_room_presence_v1/);
	assert.match(sql, /rooms_presence_room_generation_check/);
	assert.throws(() => captureSql({ ...binding, backupSha256: null }, 50));
	for (const prefix of [36, 39, 49, 51])
		assert.throws(() => captureSql(binding, prefix));
});

test("all three fixed cases classify successfully and only 50 can resume", () => {
	for (const prefix of [37, 38]) {
		const result = assessPrefixAttempt(proof(prefix));
		assert.deepEqual(
			[result.canResume, result.classification, result.requiredAction],
			[
				false,
				"committed-unrecorded-ledger-divergence",
				"complete-application-recovery",
			],
		);
	}
	const result = assessPrefixAttempt(proof(50));
	assert.equal(result.canResume, true);
	assert.equal(result.classification, "rolled-back-with-no-touched-effects");
	assert.match(result.requiredAction, /resume-unchanged-suffix$/);
	assert.equal(result.source.deniedMigration.version, "20260908040654");
	for (const hash of Object.values(result.evidence))
		assert.match(hash, /^[a-f0-9]{64}$/);
});

test("target, nonce, release source and backup drift fail closed", () => {
	for (const mutate of [
		(p) => (p.before.binding.projectRef = "bcdefghijklmnopqrstu"),
		(p) => (p.after.binding.nonce = "d".repeat(32)),
		(p) => (p.attempt.binding.releaseCommit = "d".repeat(40)),
		(p) => (p.before.binding.backupSha256 = "d".repeat(64)),
		(p) => (p.after.source.sourceCommit = "d".repeat(40)),
		(p) => (p.after.control.documentBinding.backupSha256 = "d".repeat(64)),
	]) {
		const p = clone(proof(50));
		mutate(p);
		assert.throws(() => assessPrefixAttempt(p));
	}
});

test("CLI version, binary identity, normal exit and exact log hashes are mandatory", () => {
	for (const mutate of [
		(p) => (p.attempt.cli.version = "2.112.0"),
		(p) => (p.attempt.cli.binarySha256 = "d".repeat(64)),
		(p) => (p.attempt.exitCode = 2),
		(p) => (p.attempt.exitCode = null),
		(p) => (p.attempt.signal = "SIGTERM"),
		(p) => (p.attempt.stdoutSha256 = "d".repeat(64)),
		(p) => (p.attempt.stderrSha256 = "d".repeat(64)),
	]) {
		const p = clone(proof(50));
		mutate(p);
		assert.throws(() => assessPrefixAttempt(p));
	}
});

test("host chronology and independent database clock ordering fail closed", () => {
	for (const mutate of [
		(p) => (p.before.capturedLocallyAt = "2026-09-12T01:00:03.001Z"),
		(p) => (p.attempt.endedAt = p.attempt.startedAt),
		(p) => (p.after.capturedLocallyAt = "2026-09-12T01:00:03.999Z"),
		(p) => (p.after.observedAt = "2026-09-12T01:00:00.999Z"),
	]) {
		const p = clone(proof(50));
		mutate(p);
		assert.throws(() => assessPrefixAttempt(p));
	}
});

test("only the exact singleton history-insert failure is accepted", () => {
	for (const change of [
		(s) => s.replace("LegacyDbPushApplyError", "OtherError"),
		(s) => s.replace("SQLSTATE 23514", "SQLSTATE 23505"),
		(s) => s.replace("rehearsal_deny_one_version", "another_constraint"),
		(s) => s.replace("20260908040654", "20260908035702"),
		(s) => s.replace("At statement: 5", "At statement: 0"),
		(s) => s.replace("Failing row contains (", "Failing row contains (wrong"),
		(s) => s.replace("create function", "malformed\ncreate function"),
		(s) =>
			s.replace(
				"INSERT INTO supabase_migrations.schema_migrations",
				"ALTER TABLE public.rooms",
			),
		(s) => `noise${s}`,
		(s) => `${s}\n`,
	]) {
		const p = clone(proof(50));
		p.stdout = change(p.stdout);
		p.attempt.stdoutSha256 = sha256(p.stdout);
		assert.throws(() => assessPrefixAttempt(p));
	}
});

test("ordered version and basename ledger equality is exact", () => {
	for (const mutate of [
		(p) => p.before.ledger.pop(),
		(p) => p.after.ledger.pop(),
		(p) => p.after.ledger.reverse(),
		(p) => (p.after.ledger[0].name = "wrong_name"),
		(p) => p.after.ledger.push(p.after.ledger.at(-1)),
	]) {
		const p = clone(proof(50));
		mutate(p);
		assert.throws(() => assessPrefixAttempt(p));
	}
});

test("fault identity, NOT VALID state and full definitions are exact", () => {
	for (const mutate of [
		(p) => (p.after.fault = null),
		(p) => (p.after.fault.validated = true),
		(p) => (p.after.fault.type = "u"),
		(p) => (p.after.fault.definition = null),
		(p) => (p.after.fault.expression += " and true"),
		(p) => (p.before.fault = fault(50)),
	]) {
		const p = clone(proof(50));
		mutate(p);
		assert.throws(() => assessPrefixAttempt(p));
	}
});

test("prepared control, archive counters, holds and metadata cannot be missing", () => {
	for (const mutate of [
		(p) => (p.before = null),
		(p) => delete p.before.control,
		(p) => (p.before.control.rowCount = 0),
		(p) => (p.after.control.phase = "chain_applied"),
		(p) => (p.after.control.maintenance = false),
		(p) => (p.after.control.preparedAt = null),
		(p) => (p.after.control.archivedRowCount -= 1),
		(p) => p.after.control.missingMaintenanceHolds.push("rooms"),
	]) {
		const p = clone(proof(50));
		mutate(p);
		assert.throws(() => assessPrefixAttempt(p));
	}
});

test("partial migration-50 effects never become a resume decision", () => {
	for (const [field, value] of [
		["column", { name: "presence_room_generation" }],
		["namedCheck", { name: "rooms_presence_room_generation_check" }],
		["function", { name: "record_recent_room_presence_v1" }],
	]) {
		const p = clone(proof(50));
		p.after.touched[field] = value;
		assert.throws(() => assessPrefixAttempt(p));
	}
});
