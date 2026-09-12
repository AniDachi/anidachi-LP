import assert from "node:assert/strict";
import {
	chmodSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
	buildArtifacts,
	validateBinding,
	writeArtifacts,
} from "./production-history-hosted-artifacts.mjs";
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
test("reject live targets, mismatched endpoints, transaction pooling and credentials", () => {
	for (const projectRef of ["bynsjjxzatxndzjkogim", "cyppqpprkygjloyfvvvj"])
		assert.throws(() =>
			validateBinding({
				...binding,
				projectRef,
				host: `db.${projectRef}.supabase.co`,
			}),
		);
	for (const delta of [
		{ host: "db.wrong.supabase.co" },
		{ port: 6543 },
		{ database: "other" },
		{ password: "secret" },
		{ sessionUser: "supabase_admin" },
		{ user: "cli_login_postgres" },
	])
		assert.throws(() => validateBinding({ ...binding, ...delta }));
	validateBinding({
		...binding,
		host: "aws-0-ap-southeast-1.pooler.supabase.com",
		user: `postgres.${binding.projectRef}`,
	});
	for (const endpoint of [
		{ host: binding.host, user: "cli_login_postgres" },
		{
			host: "aws-0-ap-southeast-1.pooler.supabase.com",
			user: `cli_login_postgres.${binding.projectRef}`,
		},
	]) {
		assert.throws(
			() =>
				validateBinding({
					...binding,
					...endpoint,
					sessionUser: "cli_login_postgres",
				}),
			/ordinary postgres login/,
		);
	}
});
test("all phases bind exact original backup/target/input and unchanged SQL; no executor", () => {
	const files = buildArtifacts(binding),
		doc = JSON.parse(files["input.json"]);
	assert.equal(doc.evidenceClass, "synthetic-free-hosted-rehearsal-only");
	assert.equal(doc.backupSha256, binding.backupSha256);
	assert.equal(
		Object.keys(files).filter(
			(n) => n.startsWith("first35/") && n.endsWith(".sql"),
		).length,
		35,
	);
	assert.equal(
		Object.keys(files).filter(
			(n) => n.startsWith("all60/") && n.endsWith(".sql"),
		).length,
		60,
	);
	for (const phase of ["prepare", "verify", "finish"]) {
		assert.ok(
			files[`${phase}.sql`].includes(JSON.stringify(doc).replaceAll("'", "''")),
		);
		assert.match(files[`${phase}.sql`], /REHEARSAL_TARGET_MISMATCH/);
		assert.match(files[`${phase}.sql`], /NONCANONICAL_PREFIX/);
	}
	assert.doesNotMatch(
		readFileSync(
			new URL("./production-history-hosted-artifacts.mjs", import.meta.url),
			"utf8",
		),
		/spawn|execSync|fetch\(/,
	);
});
test("retry reuses artifacts, refuses changed backup and tampered phase without replacing input", () => {
	const dir = mkdtempSync(join(tmpdir(), "hosted-artifacts-test-"));
	try {
		const files = buildArtifacts(binding);
		writeArtifacts(dir, files);
		writeArtifacts(dir, files);
		assert.throws(
			() =>
				writeArtifacts(
					dir,
					buildArtifacts({ ...binding, backupSha256: "d".repeat(64) }),
				),
			/Immutable artifact mismatch/,
		);
		chmodSync(join(dir, "verify.sql"), 0o600);
		writeFileSync(join(dir, "verify.sql"), "tampered", { mode: 0o600 });
		assert.throws(
			() => writeArtifacts(dir, files),
			/Immutable artifact mismatch/,
		);
		assert.equal(
			readFileSync(join(dir, "input.json"), "utf8"),
			files["input.json"],
		);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("bootstrap cannot emit bridge phases without a real backup identity", () => {
	const files = buildArtifacts({ ...binding, backupSha256: null });
	for (const name of ["input.json", "prepare.sql", "verify.sql", "finish.sql"])
		assert.equal(files[name], undefined);
	assert.ok(files["bind-empty-target.sql"]);
});
