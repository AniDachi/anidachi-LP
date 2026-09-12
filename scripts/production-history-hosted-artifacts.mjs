// OFFLINE ONLY. Emits synthetic hosted-rehearsal inputs; never opens a connection.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	manifest,
	operations,
	root,
	verifyManifest,
} from "./production-history-transition.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const literal = (value) => `'${value.replaceAll("'", "''")}'`;
const read = (name) => readFileSync(resolve(operations, name), "utf8");

export function validateBinding(binding) {
	assert.deepEqual(
		Object.keys(binding).sort(),
		[
			"backupSha256",
			"database",
			"host",
			"nonce",
			"port",
			"projectRef",
			"releaseCommit",
			"sessionUser",
			"user",
		].sort(),
	);
	assert.match(binding.projectRef, /^[a-z]{20}$/);
	assert.ok(
		!["bynsjjxzatxndzjkogim", "cyppqpprkygjloyfvvvj"].includes(
			binding.projectRef,
		),
		"Production/staging forbidden",
	);
	assert.equal(binding.database, "postgres");
	assert.equal(
		binding.port,
		5432,
		"Only direct/session connection; no transaction pooler",
	);
	assert.equal(
		binding.sessionUser,
		"postgres",
		"This hosted candidate requires ordinary postgres login; temporary CLI login is not supported",
	);
	const direct = binding.host === `db.${binding.projectRef}.supabase.co`;
	const pooled = /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(
		binding.host,
	);
	assert.ok(direct || pooled, "Use an actual Supabase Connect endpoint");
	assert.equal(
		binding.user,
		`${binding.sessionUser}${pooled ? `.${binding.projectRef}` : ""}`,
	);
	assert.match(binding.nonce, /^[a-f0-9]{32}$/);
	assert.match(binding.releaseCommit, /^[a-f0-9]{40}$/);
	if (binding.backupSha256 !== null)
		assert.match(binding.backupSha256, /^[a-f0-9]{64}$/);
}

export function buildArtifacts(binding) {
	validateBinding(binding);
	verifyManifest();
	const descriptors = JSON.parse(read("baseline-schema.json"));
	const document = {
		transition: manifest.transition,
		productionProject: manifest.productionProject,
		target: binding,
		sourceCommit: manifest.sourceCommit,
		manifestSha256: hash(read("manifest.json")),
		bridgeSha256: hash(
			[
				"prepare.sql",
				"verify-archive.sql",
				"finish.sql",
				"baseline-schema.json",
			]
				.map(read)
				.join("\n"),
		),
		backupSha256: binding.backupSha256,
		baselineVersions: manifest.migrations.slice(0, 35).map((m) => m.version),
		targetVersions: manifest.migrations.map((m) => m.version),
		inventory: manifest.inventory,
		descriptors,
		publicTables: Object.keys(descriptors).sort(),
		evidenceClass: "synthetic-free-hosted-rehearsal-only",
	};
	const identity = `set role postgres;
set timezone='UTC';
set extra_float_digits=0;
set statement_timeout='120s';
set lock_timeout='10s';
set idle_in_transaction_session_timeout='30s';
do $$ begin
 if current_database() <> 'postgres' or session_user <> ${literal(binding.sessionUser)}
 or current_user <> 'postgres' or current_setting('role') <> 'postgres'
 or not pg_has_role(session_user,'postgres','MEMBER')
 or (select rolsuper from pg_roles where rolname=current_user)
 then raise exception 'HOSTED_OPERATOR_MISMATCH'; end if;
end $$;
`;
	const guard = `${identity}do $$ begin
 if (select count(*) from anidachi_rehearsal_binding.identity) <> 1
 or not exists(select 1 from anidachi_rehearsal_binding.identity
 where project_ref=${literal(binding.projectRef)} and nonce=${literal(binding.nonce)})
 then raise exception 'REHEARSAL_TARGET_MISMATCH'; end if;
end $$;
`;
	const input = `create temp table transition_input(document jsonb);
insert into pg_temp.transition_input values(${literal(JSON.stringify(document))}::jsonb);
`;
	const prefix = `do $$ declare v jsonb; begin
 select coalesce(jsonb_agg(version order by version),'[]'::jsonb) into v from supabase_migrations.schema_migrations;
 if jsonb_array_length(v) < 35 or jsonb_array_length(v) > 60
 or v <> (select jsonb_agg(value order by ordinal) from jsonb_array_elements((select document->'targetVersions' from pg_temp.transition_input)) with ordinality a(value,ordinal) where ordinal<=jsonb_array_length(v))
 then raise exception 'NONCANONICAL_PREFIX'; end if;
end $$;
`;
	const wrap = (body) =>
		`\\set ON_ERROR_STOP on\n${guard}begin;\nset local search_path='';\n${input}${prefix}${body}\ncommit;\n`;
	const result = {
		"input.json": `${JSON.stringify(document, null, 2)}\n`,
		"guard.sql": guard,
		"bind-empty-target.sql": `\\set ON_ERROR_STOP on\n${identity}begin;
do $$ begin
 if exists(select 1 from pg_tables where schemaname='public')
 or to_regclass('supabase_migrations.schema_migrations') is not null
 then raise exception 'FRESH_EMPTY_PROJECT_REQUIRED'; end if;
end $$;
create schema anidachi_rehearsal_binding;
revoke all on schema anidachi_rehearsal_binding from public,anon,authenticated,service_role;
create table anidachi_rehearsal_binding.identity(project_ref text not null,nonce text not null);
revoke all on anidachi_rehearsal_binding.identity from public,anon,authenticated,service_role;
alter table anidachi_rehearsal_binding.identity enable row level security;
insert into anidachi_rehearsal_binding.identity values(${literal(binding.projectRef)},${literal(binding.nonce)});
commit;\n`,
		"prepare.sql": wrap(
			`${read("prepare.sql")}\n${read("verify-archive.sql")}`,
		),
		"verify.sql": wrap(read("verify-archive.sql")),
		"finish.sql": wrap(
			`${read("verify-archive.sql")}\n${read("finish.sql")}\n${read("verify-archive.sql")}`,
		),
	};
	for (const [name, count] of [
		["first35", 35],
		["all60", 60],
	]) {
		result[`${name}/supabase/config.toml`] =
			`project_id = "free-hosted-rehearsal"\n[db]\nmajor_version = 17\n`;
		for (const m of manifest.migrations.slice(0, count))
			result[`${name}/supabase/migrations/${m.file}`] = readFileSync(
				resolve(root, "apps/web/supabase/migrations", m.file),
			);
	}
	if (binding.backupSha256 === null) {
		for (const name of [
			"input.json",
			"prepare.sql",
			"verify.sql",
			"finish.sql",
		])
			delete result[name];
	}
	result["SHA256SUMS"] = Object.entries(result)
		.map(([name, bytes]) => `${hash(bytes)}  ${name}\n`)
		.join("");
	return result;
}

export function writeArtifacts(directory, artifacts) {
	// Validate EVERY preexisting artifact before writing any new file. Never repin.
	for (const prefix of ["first35", "all60"]) {
		const migrationDir = resolve(directory, prefix, "supabase/migrations");
		if (existsSync(migrationDir))
			for (const name of readdirSync(migrationDir)) {
				assert.ok(
					Object.hasOwn(artifacts, `${prefix}/supabase/migrations/${name}`),
					`Unexpected migration artifact: ${name}`,
				);
			}
	}
	for (const [name, bytes] of Object.entries(artifacts)) {
		const path = resolve(directory, name);
		if (existsSync(path))
			assert.deepEqual(
				readFileSync(path),
				Buffer.from(bytes),
				`Immutable artifact mismatch: ${name}`,
			);
	}
	for (const [name, bytes] of Object.entries(artifacts)) {
		const path = resolve(directory, name);
		if (!existsSync(path)) {
			mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
			writeFileSync(path, bytes, { flag: "wx", mode: 0o400 });
		}
	}
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	assert.equal(
		process.argv.length,
		4,
		"Usage: node scripts/production-history-hosted-artifacts.mjs binding.json output-directory (offline only)",
	);
	writeArtifacts(
		resolve(process.argv[3]),
		buildArtifacts(JSON.parse(readFileSync(process.argv[2], "utf8"))),
	);
	console.log(
		"Offline synthetic rehearsal artifacts verified; no connection opened.",
	);
}
