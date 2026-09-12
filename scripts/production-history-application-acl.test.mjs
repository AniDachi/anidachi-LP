import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
import * as api from "./production-history-application-acl.mjs";
import {
	buildArtifacts,
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
function fixture() {
	const input = buildArtifacts(binding)["input.json"];
	return {
		format: 1,
		inputSha256: createHash("sha256").update(input).digest("hex"),
		objects: [
			...JSON.parse(input).publicTables.map((name) => ({
				kind: "table",
				schema: "public",
				name,
				identityArguments: null,
				owner: "postgres",
				rawAcl: [],
				acl: [],
			})),
			{
				kind: "table",
				schema: "supabase_migrations",
				name: "schema_migrations",
				identityArguments: null,
				owner: "postgres",
				rawAcl: [],
				acl: [],
			},
		],
	};
}
test("missing or malformed baseline metadata never becomes empty permission state", () => {
	assert.equal(typeof api.buildRecoveryArtifacts, "function");
	for (const snapshot of [
		null,
		{},
		"",
		{ ...fixture(), objects: [] },
		{ ...fixture(), unsupported: true },
	])
		assert.throws(() => api.buildRecoveryArtifacts(binding, snapshot));
	const baseline = fixture();
	assert.ok(api.buildRecoveryArtifacts(binding, baseline)["reconcile.sql"]);
	for (const mutate of [
		(s) => s.objects.pop(),
		(s) => s.objects.push(s.objects[0]),
		(s) => (s.objects[0].owner = "other"),
		(s) => (s.objects[0].kind = "view"),
		(s) => (s.objects[0].rawAcl = {}),
		(s) => (s.objects[0].extra = 1),
		(s) =>
			s.objects[0].acl.push(
				...Array(2).fill({
					grantor: "postgres",
					grantee: "anon",
					privilege: "SELECT",
					grantOption: false,
				}),
			),
		(s) => (s.inputSha256 = "e".repeat(64)),
		(s) =>
			s.objects[0].acl.push({
				grantor: "other",
				grantee: null,
				privilege: "SELECT",
				grantOption: false,
			}),
		(s) =>
			s.objects[0].acl.push({
				grantor: "postgres",
				grantee: null,
				privilege: "SELECT",
				grantOption: "false",
			}),
		(s) =>
			s.objects[0].acl.push({
				grantor: "postgres",
				grantee: null,
				privilege: "EXECUTE",
				grantOption: false,
			}),
	]) {
		const s = fixture();
		mutate(s);
		assert.throws(() => api.buildRecoveryArtifacts(binding, s));
	}
});
test("snapshot and generated SQL are immutable together across changed inputs and tampering", () => {
	assert.equal(typeof api.buildRecoveryArtifacts, "function");
	const dir = mkdtempSync(join(tmpdir(), "application-acl-"));
	try {
		const s = fixture(),
			files = api.buildRecoveryArtifacts(binding, s);
		writeArtifacts(dir, files);
		writeArtifacts(dir, files);
		const changed = fixture();
		changed.objects[0].acl.push({
			grantor: "postgres",
			grantee: "anon",
			privilege: "SELECT",
			grantOption: false,
		});
		assert.throws(
			() => writeArtifacts(dir, api.buildRecoveryArtifacts(binding, changed)),
			/Immutable artifact mismatch/,
		);
		chmodSync(join(dir, "reconcile.sql"), 0o600);
		writeFileSync(join(dir, "reconcile.sql"), "tampered");
		assert.throws(
			() => writeArtifacts(dir, files),
			/Immutable artifact mismatch/,
		);
		assert.equal(
			readFileSync(join(dir, "snapshot.json"), "utf8"),
			files["snapshot.json"],
		);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
test("capture and recovery preserve forbidden-target and original-backup guards", () => {
	assert.equal(typeof api.buildCaptureArtifacts, "function");
	for (const delta of [
		{ backupSha256: null },
		{
			projectRef: "bynsjjxzatxndzjkogim",
			host: "db.bynsjjxzatxndzjkogim.supabase.co",
		},
		{ sessionUser: "supabase_admin" },
	])
		assert.throws(() => api.buildCaptureArtifacts({ ...binding, ...delta }));
});
