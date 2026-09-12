// OFFLINE ONLY. Generates read-only receipt SQL and classifies captured evidence.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	buildArtifacts,
	validateBinding,
} from "./production-history-hosted-artifacts.mjs";
import {
	manifest,
	root,
	verifyManifest,
} from "./production-history-transition.mjs";

export const CLI_VERSION = "2.111.0";
export const CLI_BINARY_SHA256 =
	"3a92cc2ea6b9fe75078305ba07923b916b509dc8d14c0f4e1153d3ddc402e796";

const FORMAT = 1;
const PREFIXES = Object.freeze({
	37: {
		migrationIndex: 37,
		classification: "committed-unrecorded-ledger-divergence",
		canResume: false,
		requiredAction: "complete-application-recovery",
	},
	38: {
		migrationIndex: 38,
		classification: "committed-unrecorded-ledger-divergence",
		canResume: false,
		requiredAction: "complete-application-recovery",
	},
	50: {
		migrationIndex: 50,
		classification: "rolled-back-with-no-touched-effects",
		canResume: true,
		requiredAction:
			"rerun-artifact-and-hold-verification-then-resume-unchanged-suffix",
	},
});
const TOUCHED_NAMES = [
	"presence_room_generation",
	"record_recent_room_presence_v1",
];
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const sqlLiteral = (value) => `'${value.replaceAll("'", "''")}'`;

function exactKeys(value, keys, label) {
	assert.ok(
		value !== null && typeof value === "object" && !Array.isArray(value),
		`${label} must be an object`,
	);
	assert.deepEqual(
		Object.keys(value).sort(),
		[...keys].sort(),
		`${label} keys`,
	);
}

function timestamp(value, label) {
	assert.equal(typeof value, "string", `${label} must be a timestamp string`);
	const parsed = Date.parse(value);
	assert.ok(Number.isFinite(parsed), `${label} must be a valid timestamp`);
	return parsed;
}

function prefixCase(expectedPrefix) {
	assert.ok(
		Number.isInteger(expectedPrefix) && Object.hasOwn(PREFIXES, expectedPrefix),
		"Expected one fixed prefix: 37, 38, or 50",
	);
	const spec = PREFIXES[expectedPrefix];
	const denied = manifest.migrations[spec.migrationIndex];
	assert.ok(denied, "Denied migration missing from manifest");
	return { ...spec, denied };
}

function migrationName(migration) {
	return migration.file.slice(migration.version.length + 1, -4);
}

function expectedLedger(length) {
	return manifest.migrations.slice(0, length).map((migration) => ({
		version: migration.version,
		name: migrationName(migration),
	}));
}

function verifyTouchedSourceBoundary() {
	for (const migration of manifest.migrations.slice(0, 50)) {
		const sql = readFileSync(
			resolve(root, "apps/web/supabase/migrations", migration.file),
			"utf8",
		);
		for (const name of TOUCHED_NAMES)
			assert.ok(
				!sql.includes(name),
				`${name} appears before its reviewed migration`,
			);
	}
	const migration = manifest.migrations[50];
	assert.equal(
		migration.file,
		"20260908040654_recent_people_from_room_presence.sql",
	);
	const sql = readFileSync(
		resolve(root, "apps/web/supabase/migrations", migration.file),
		"utf8",
	);
	for (const name of TOUCHED_NAMES)
		assert.ok(sql.includes(name), `${name} missing from reviewed migration`);
}

function context(binding, expectedPrefix) {
	validateBinding(binding);
	assert.notEqual(binding.backupSha256, null, "Backup SHA-256 is required");
	verifyManifest();
	verifyTouchedSourceBoundary();
	const spec = prefixCase(expectedPrefix);
	const artifacts = buildArtifacts(binding);
	const document = JSON.parse(artifacts["input.json"]);
	return { spec, artifacts, document };
}

function sourceReceipt(document) {
	return {
		transition: document.transition,
		sourceCommit: document.sourceCommit,
		manifestSha256: document.manifestSha256,
		bridgeSha256: document.bridgeSha256,
	};
}

function controlBinding(document) {
	return {
		transition: document.transition,
		productionProject: document.productionProject,
		target: document.target,
		sourceCommit: document.sourceCommit,
		manifestSha256: document.manifestSha256,
		bridgeSha256: document.bridgeSha256,
		backupSha256: document.backupSha256,
	};
}

function expectedArchiveRows(document) {
	return Object.values(document.inventory).reduce(
		(sum, item) => sum + item.count,
		0,
	);
}

export function captureSql(binding, expectedPrefix) {
	const { artifacts, document } = context(binding, expectedPrefix);
	const bindingJson = JSON.stringify(binding);
	const sourceJson = JSON.stringify(sourceReceipt(document));
	return `\\set ON_ERROR_STOP on
${artifacts["guard.sql"]}begin read only;
set local search_path='';
with
ledger as (
 select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name) order by version),'[]'::jsonb) value
 from supabase_migrations.schema_migrations
),
control as (
 select jsonb_build_object(
  'rowCount',(select count(*) from anidachi_transition_20260912.control),
  'phase',(select phase from anidachi_transition_20260912.control where singleton),
  'preparedAt',(select prepared_at from anidachi_transition_20260912.control where singleton),
  'maintenance',(select maintenance from anidachi_transition_20260912.control where singleton),
  'documentBinding',(select jsonb_build_object(
   'transition',document->>'transition','productionProject',document->>'productionProject',
   'target',document->'target','sourceCommit',document->>'sourceCommit',
   'manifestSha256',document->>'manifestSha256','bridgeSha256',document->>'bridgeSha256',
   'backupSha256',document->>'backupSha256')
   from anidachi_transition_20260912.control where singleton),
  'archiveRelationCount',(select count(*) from anidachi_transition_20260912.relations),
  'archivedRelationCount',(select count(*) from anidachi_transition_20260912.relations where archived),
  'archivedRowCount',(select count(*) from anidachi_transition_20260912.rows),
  'missingMaintenanceHolds',coalesce((select jsonb_agg(p.t order by p.t)
   from jsonb_array_elements_text((select document->'publicTables' from anidachi_transition_20260912.control where singleton)) p(t)
   where not exists(select 1 from pg_catalog.pg_trigger
    where tgrelid=pg_catalog.to_regclass('public.'||pg_catalog.quote_ident(p.t))
    and tgname='production_history_maintenance' and tgenabled='O')),'[]'::jsonb)
 ) value
),
fault as (
 select jsonb_build_object(
  'name',c.conname,'tableSchema',n.nspname,'tableName',r.relname,
  'type',c.contype,'validated',c.convalidated,'noInherit',c.connoinherit,
  'deferrable',c.condeferrable,'deferred',c.condeferred,
  'definition',pg_catalog.pg_get_constraintdef(c.oid,false),
  'expression',pg_catalog.pg_get_expr(c.conbin,c.conrelid,false)
 ) value
 from pg_catalog.pg_constraint c
 join pg_catalog.pg_class r on r.oid=c.conrelid
 join pg_catalog.pg_namespace n on n.oid=r.relnamespace
 where n.nspname='supabase_migrations' and r.relname='schema_migrations'
 and c.conname='rehearsal_deny_one_version'
),
column_state as (
 select jsonb_build_object(
  'name',a.attname,'number',a.attnum,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),
  'notNull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,
  'storage',a.attstorage,'compression',a.attcompression,'statistics',a.attstattarget,
  'options',to_jsonb(a.attoptions),'acl',to_jsonb(a.attacl),
  'collation',case when a.attcollation=0 then null else a.attcollation::pg_catalog.regcollation::text end,
  'tableOwner',pg_catalog.pg_get_userbyid(r.relowner),
  'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid,false),
  'checks',coalesce((select jsonb_agg(jsonb_build_object(
    'name',c.conname,'validated',c.convalidated,'noInherit',c.connoinherit,
    'definition',pg_catalog.pg_get_constraintdef(c.oid,false)) order by c.conname)
   from pg_catalog.pg_constraint c where c.conrelid=a.attrelid and c.contype='c'
   and a.attnum=any(c.conkey)),'[]'::jsonb)
 ) value
 from pg_catalog.pg_attribute a
 join pg_catalog.pg_class r on r.oid=a.attrelid
 join pg_catalog.pg_namespace n on n.oid=r.relnamespace
 left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
 where n.nspname='public' and r.relname='rooms'
 and a.attname='presence_room_generation' and a.attnum>0 and not a.attisdropped
),
named_check as (
 select jsonb_build_object(
  'name',c.conname,'type',c.contype,'validated',c.convalidated,
  'noInherit',c.connoinherit,'definition',pg_catalog.pg_get_constraintdef(c.oid,false)
 ) value
 from pg_catalog.pg_constraint c
 where c.conrelid=pg_catalog.to_regclass('public.rooms')
 and c.conname='rooms_presence_room_generation_check'
),
function_state as (
 select jsonb_build_object(
  'schema',n.nspname,'name',p.proname,
  'identityArguments',pg_catalog.pg_get_function_identity_arguments(p.oid),
  'result',pg_catalog.pg_get_function_result(p.oid),
  'language',l.lanname,'kind',p.prokind,'volatility',p.provolatile,
  'parallel',p.proparallel,'strict',p.proisstrict,'leakproof',p.proleakproof,
  'securityDefiner',p.prosecdef,'config',to_jsonb(p.proconfig),
  'owner',pg_catalog.pg_get_userbyid(p.proowner),'acl',to_jsonb(p.proacl),
  'definition',pg_catalog.pg_get_functiondef(p.oid)
 ) value
 from pg_catalog.pg_proc p
 join pg_catalog.pg_namespace n on n.oid=p.pronamespace
 join pg_catalog.pg_language l on l.oid=p.prolang
 where p.oid=pg_catalog.to_regprocedure('public.record_recent_room_presence_v1(jsonb)')
)
select jsonb_build_object(
 'format',${FORMAT},'expectedPrefix',${expectedPrefix},
 'binding',${sqlLiteral(bindingJson)}::jsonb,
 'source',${sqlLiteral(sourceJson)}::jsonb,
 'observedAt',pg_catalog.clock_timestamp(),
 'ledger',(select value from ledger),'control',(select value from control),
 'fault',(select value from fault),
 'touched',jsonb_build_object(
  'column',(select value from column_state),
  'namedCheck',(select value from named_check),
  'function',(select value from function_state))
);
commit;
`;
}

function validateControl(control, document) {
	exactKeys(
		control,
		[
			"rowCount",
			"phase",
			"preparedAt",
			"maintenance",
			"documentBinding",
			"archiveRelationCount",
			"archivedRelationCount",
			"archivedRowCount",
			"missingMaintenanceHolds",
		],
		"control",
	);
	assert.equal(control.rowCount, 1);
	assert.equal(control.phase, "prepared");
	timestamp(control.preparedAt, "control.preparedAt");
	assert.equal(control.maintenance, true);
	assert.deepEqual(control.documentBinding, controlBinding(document));
	assert.equal(control.archiveRelationCount, document.publicTables.length);
	assert.equal(
		control.archivedRelationCount,
		Object.keys(document.inventory).length,
	);
	assert.equal(control.archivedRowCount, expectedArchiveRows(document));
	assert.deepEqual(control.missingMaintenanceHolds, []);
}

function validateTouched(touched, label) {
	exactKeys(touched, ["column", "namedCheck", "function"], `${label}.touched`);
	assert.equal(touched.column, null, `${label} touched column must be absent`);
	assert.equal(touched.namedCheck, null, `${label} named check must be absent`);
	assert.equal(
		touched.function,
		null,
		`${label} touched function must be absent`,
	);
}

function validateFault(fault, denied) {
	exactKeys(
		fault,
		[
			"name",
			"tableSchema",
			"tableName",
			"type",
			"validated",
			"noInherit",
			"deferrable",
			"deferred",
			"definition",
			"expression",
		],
		"fault",
	);
	assert.deepEqual(fault, {
		name: "rehearsal_deny_one_version",
		tableSchema: "supabase_migrations",
		tableName: "schema_migrations",
		type: "c",
		validated: false,
		noInherit: false,
		deferrable: false,
		deferred: false,
		definition: `CHECK ((version <> '${denied.version}'::text)) NOT VALID`,
		expression: `(version <> '${denied.version}'::text)`,
	});
}

function validateReceipt(receipt, label, binding, expectedPrefix, document) {
	exactKeys(
		receipt,
		[
			"format",
			"expectedPrefix",
			"binding",
			"source",
			"observedAt",
			"capturedLocallyAt",
			"ledger",
			"control",
			"fault",
			"touched",
		],
		label,
	);
	assert.equal(receipt.format, FORMAT);
	assert.equal(receipt.expectedPrefix, expectedPrefix);
	assert.deepEqual(receipt.binding, binding);
	assert.deepEqual(receipt.source, sourceReceipt(document));
	timestamp(receipt.observedAt, `${label}.observedAt`);
	timestamp(receipt.capturedLocallyAt, `${label}.capturedLocallyAt`);
	assert.ok(Array.isArray(receipt.ledger), `${label}.ledger must be an array`);
	validateControl(receipt.control, document);
	validateTouched(receipt.touched, label);
}

function validateAttempt(attempt, binding, expectedPrefix) {
	exactKeys(
		attempt,
		[
			"binding",
			"expectedPrefix",
			"cli",
			"startedAt",
			"endedAt",
			"exitCode",
			"stdoutSha256",
			"stderrSha256",
		],
		"attempt",
	);
	assert.deepEqual(attempt.binding, binding);
	assert.equal(attempt.expectedPrefix, expectedPrefix);
	exactKeys(attempt.cli, ["version", "binarySha256"], "attempt.cli");
	assert.deepEqual(attempt.cli, {
		version: CLI_VERSION,
		binarySha256: CLI_BINARY_SHA256,
	});
	assert.equal(attempt.exitCode, 1, "CLI must exit normally with status 1");
	for (const field of ["stdoutSha256", "stderrSha256"])
		assert.match(attempt[field], /^[a-f0-9]{64}$/, `attempt.${field}`);
	return {
		startedAt: timestamp(attempt.startedAt, "attempt.startedAt"),
		endedAt: timestamp(attempt.endedAt, "attempt.endedAt"),
	};
}

function validateFailure(stdout, stderr, attempt, denied) {
	assert.equal(typeof stdout, "string");
	assert.equal(typeof stderr, "string");
	assert.equal(sha256(stdout), attempt.stdoutSha256, "stdout hash mismatch");
	assert.equal(sha256(stderr), attempt.stderrSha256, "stderr hash mismatch");
	const serialized = stdout.endsWith("\n") ? stdout.slice(0, -1) : stdout;
	assert.ok(
		!serialized.endsWith("\n"),
		"stdout has more than one final newline",
	);
	const payload = JSON.parse(serialized);
	assert.equal(
		JSON.stringify(payload),
		serialized,
		"stdout must be one compact JSON object",
	);
	exactKeys(payload, ["_tag", "error"], "stdout payload");
	assert.equal(payload._tag, "Error");
	exactKeys(payload.error, ["code", "message"], "stdout error");
	assert.equal(payload.error.code, "LegacyDbPushApplyError");
	const escapedVersion = denied.version.replaceAll(
		/[.*+?^${}()|[\]\\]/g,
		"\\$&",
	);
	assert.match(
		payload.error.message,
		new RegExp(
			`^ERROR: new row for relation "schema_migrations" violates check constraint "rehearsal_deny_one_version" \\(SQLSTATE 23514\\)\\n` +
				`Failing row contains \\(${escapedVersion}, [^\\r\\n]+\\)\\.\\n` +
				`At statement: [1-9][0-9]*\\n` +
				`INSERT INTO supabase_migrations\\.schema_migrations\\(version, name, statements\\) VALUES\\(\\$1, \\$2, \\$3\\)$`,
		),
		"Unexpected CLI failure",
	);
}

export function assessPrefixAttempt({
	binding,
	expectedPrefix,
	before,
	after,
	attempt,
	stdout,
	stderr,
}) {
	const { spec, document } = context(binding, expectedPrefix);
	validateReceipt(before, "before", binding, expectedPrefix, document);
	validateReceipt(after, "after", binding, expectedPrefix, document);
	assert.deepEqual(
		after.control,
		before.control,
		"Prepared control changed during prefix attempt",
	);
	assert.deepEqual(
		before.ledger,
		expectedLedger(35),
		"Before must be exact prefix 35",
	);
	assert.equal(before.fault, null, "Fault must be absent before injection");
	assert.deepEqual(
		after.ledger,
		expectedLedger(expectedPrefix),
		"After ledger is not the exact ordered manifest prefix",
	);
	validateFault(after.fault, spec.denied);
	assert.deepEqual(after.touched, before.touched, "Touched state changed");
	const times = validateAttempt(attempt, binding, expectedPrefix);
	validateFailure(stdout, stderr, attempt, spec.denied);
	const beforeLocal = timestamp(
		before.capturedLocallyAt,
		"before.capturedLocallyAt",
	);
	const afterLocal = timestamp(
		after.capturedLocallyAt,
		"after.capturedLocallyAt",
	);
	assert.ok(
		beforeLocal <= times.startedAt &&
			times.startedAt < times.endedAt &&
			times.endedAt <= afterLocal,
		"Host timestamp chronology is invalid",
	);
	assert.ok(
		timestamp(before.observedAt, "before.observedAt") <=
			timestamp(after.observedAt, "after.observedAt"),
		"Database observedAt moved backwards",
	);
	return {
		canResume: spec.canResume,
		classification: spec.classification,
		requiredAction: spec.requiredAction,
		source: {
			...sourceReceipt(document),
			releaseCommit: binding.releaseCommit,
			cliVersion: CLI_VERSION,
			cliBinarySha256: CLI_BINARY_SHA256,
			deniedMigration: spec.denied,
		},
		target: binding,
		evidence: {
			beforeSha256: sha256(JSON.stringify(before)),
			afterSha256: sha256(JSON.stringify(after)),
			attemptSha256: sha256(JSON.stringify(attempt)),
			stdoutSha256: sha256(stdout),
			stderrSha256: sha256(stderr),
		},
	};
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const mode = process.argv[2];
	if (mode === "capture") {
		assert.equal(
			process.argv.length,
			5,
			"Usage: node scripts/production-history-prefix-proof.mjs capture binding.json prefix",
		);
		const binding = JSON.parse(readFileSync(resolve(process.argv[3]), "utf8"));
		process.stdout.write(captureSql(binding, Number(process.argv[4])));
	} else if (mode === "assess") {
		assert.equal(
			process.argv.length,
			6,
			"Usage: node scripts/production-history-prefix-proof.mjs assess binding.json prefix receipt-directory",
		);
		const binding = JSON.parse(readFileSync(resolve(process.argv[3]), "utf8"));
		const directory = resolve(process.argv[5]);
		const readJson = (name) =>
			JSON.parse(readFileSync(resolve(directory, name), "utf8"));
		const result = assessPrefixAttempt({
			binding,
			expectedPrefix: Number(process.argv[4]),
			before: readJson("before.json"),
			after: readJson("after.json"),
			attempt: readJson("attempt.json"),
			stdout: readFileSync(
				resolve(directory, "denied-push.stdout.log"),
				"utf8",
			),
			stderr: readFileSync(
				resolve(directory, "denied-push.stderr.log"),
				"utf8",
			),
		});
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} else {
		assert.fail("Expected capture or assess mode (offline only)");
	}
}
