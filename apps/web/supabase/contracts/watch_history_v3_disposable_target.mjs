import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

export const DISPOSABLE_ACKNOWLEDGEMENT =
	"I_ACKNOWLEDGE_THIS_IS_A_DEDICATED_DISPOSABLE_LOCAL_DATABASE";
export const DISPOSABLE_MARKER_NAME =
	".anidachi-watch-history-v3-disposable.json";
export const TRANSITION_ACKNOWLEDGEMENT =
	"RESET_DEDICATED_HISTORY_FIXTURES_ONLY";
export const PRE_TRANSITION_MIGRATION = "20260904154732";
export const SCHEMA_3_MIGRATION = "20260904205540";

export const DATABASE_PREREQUISITE_SQL = `select jsonb_build_object(
  'latestMigration', (select max(version) from supabase_migrations.schema_migrations),
  'canonicalMigrationApplied', exists(
    select 1 from supabase_migrations.schema_migrations where version = '${SCHEMA_3_MIGRATION}'
  ),
  'writeSchemaColumn', exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_watch_settings'
      and column_name = 'write_schema_version'
  ),
  'v2WriterAvailable', to_regprocedure('public.apply_watch_progress_v2(uuid,jsonb,jsonb)') is not null,
  'v3FunctionsAvailable',
    to_regprocedure('public.begin_watch_catalog_v3(uuid,jsonb)') is not null
    and to_regprocedure('public.apply_watch_catalog_v3(uuid,jsonb)') is not null
    and to_regprocedure('public.apply_watch_progress_v3(uuid,jsonb,jsonb)') is not null
    and to_regprocedure('public.list_watch_history_v3_bounded_page(uuid,bigint,integer,timestamp with time zone,text)') is not null
);`;

function requireValue(env, name) {
	const value = env[name];
	assert.equal(typeof value, "string", `${name} must be supplied explicitly`);
	assert.notEqual(value.trim(), "", `${name} must be supplied explicitly`);
	return value;
}

function readConfiguredIdentity(workdir) {
	const config = readFileSync(resolve(workdir, "supabase/config.toml"), "utf8");
	const project = config.match(/^project_id\s*=\s*"([^"]+)"\s*$/m)?.[1];
	assert.ok(project, "Disposable workdir config must declare project_id");
	const dbHeader = config.match(/^\[db\]\s*$/m);
	assert.ok(
		dbHeader?.index !== undefined,
		"Disposable workdir config must contain [db]",
	);
	const afterHeader = config.slice(dbHeader.index + dbHeader[0].length);
	const nextSection = afterHeader.search(/^\[/m);
	const dbSection =
		nextSection === -1 ? afterHeader : afterHeader.slice(0, nextSection);
	const hostPort = Number(dbSection.match(/^port\s*=\s*(\d+)\s*$/m)?.[1]);
	assert.ok(
		Number.isInteger(hostPort),
		"Disposable workdir [db] must declare an integer port",
	);
	return { hostPort, project };
}

export function requireDisposableTarget(
	env = process.env,
	inspect = spawnSync,
) {
	assert.equal(
		requireValue(env, "ANIDACHI_DISPOSABLE_DB_ACK"),
		DISPOSABLE_ACKNOWLEDGEMENT,
		`ANIDACHI_DISPOSABLE_DB_ACK must equal ${DISPOSABLE_ACKNOWLEDGEMENT}`,
	);
	const container = requireValue(env, "ANIDACHI_DISPOSABLE_DB_CONTAINER");
	const project = requireValue(env, "ANIDACHI_DISPOSABLE_DB_PROJECT");
	const suppliedPort = Number(
		requireValue(env, "ANIDACHI_DISPOSABLE_DB_HOST_PORT"),
	);
	const suppliedWorkdir = requireValue(env, "ANIDACHI_DISPOSABLE_DB_WORKDIR");
	assert.match(
		project,
		/^[a-z0-9][a-z0-9-]{5,62}$/,
		"Invalid disposable project identifier",
	);
	assert.equal(
		container,
		`supabase_db_${project}`,
		"Container and project identity differ",
	);
	assert.ok(
		Number.isInteger(suppliedPort) &&
			suppliedPort >= 1024 &&
			suppliedPort <= 65535,
		"Disposable database host port must be an integer from 1024 through 65535",
	);
	assert.notEqual(
		suppliedPort,
		54322,
		"Refusing the Supabase default port 54322",
	);
	assert.ok(
		isAbsolute(suppliedWorkdir),
		"ANIDACHI_DISPOSABLE_DB_WORKDIR must be absolute",
	);

	const workdir = realpathSync(suppliedWorkdir);
	const configured = readConfiguredIdentity(workdir);
	assert.equal(
		configured.project,
		project,
		"Supplied project differs from workdir config",
	);
	assert.equal(
		configured.hostPort,
		suppliedPort,
		"Supplied host port differs from workdir [db] port",
	);
	const markerPath = resolve(workdir, DISPOSABLE_MARKER_NAME);
	assert.ok(
		existsSync(markerPath),
		`Required disposable marker ${DISPOSABLE_MARKER_NAME} is absent`,
	);
	const marker = JSON.parse(readFileSync(markerPath, "utf8"));
	assert.equal(
		marker.acknowledgement,
		DISPOSABLE_ACKNOWLEDGEMENT,
		"Invalid disposable marker acknowledgement",
	);
	assert.deepEqual(
		{
			project: marker.project,
			container: marker.container,
			hostPort: marker.hostPort,
		},
		{ project, container, hostPort: suppliedPort },
		"Disposable marker identity differs from supplied target",
	);

	const inspected = inspect(
		"docker",
		[
			"inspect",
			"--format",
			'{"labels":{{json .Config.Labels}},"ports":{{json .NetworkSettings.Ports}}}',
			container,
		],
		{ encoding: "utf8", timeout: 10_000 },
	);
	assert.equal(inspected.error, undefined, inspected.error?.message);
	assert.equal(
		inspected.status,
		0,
		inspected.stderr || "Disposable Docker container is unavailable",
	);
	const identity = JSON.parse(inspected.stdout);
	assert.equal(
		identity.labels?.["com.supabase.cli.project"],
		project,
		"Unexpected com.supabase.cli.project label",
	);
	assert.equal(
		identity.labels?.["com.docker.compose.project"],
		project,
		"Unexpected com.docker.compose.project label",
	);
	const bindings = identity.ports?.["5432/tcp"];
	assert.ok(
		Array.isArray(bindings) && bindings.length > 0,
		"Disposable database port is not published",
	);
	assert.ok(
		bindings.every((binding) => Number(binding.HostPort) === suppliedPort),
		"Published Docker port differs from supplied disposable host port",
	);

	return { container, hostPort: suppliedPort, project, workdir };
}

export function requireOutputPath(env, name) {
	const output = requireValue(env, name);
	assert.ok(isAbsolute(output), `${name} must be an absolute path`);
	return output;
}

export function requireTransitionAcknowledgement(env = process.env) {
	assert.equal(
		requireValue(env, "ANIDACHI_WATCH_HISTORY_TRANSITION_ACK"),
		TRANSITION_ACKNOWLEDGEMENT,
		`ANIDACHI_WATCH_HISTORY_TRANSITION_ACK must equal ${TRANSITION_ACKNOWLEDGEMENT}`,
	);
}

export function assertPreTransitionPrerequisite(state) {
	assert.equal(
		state.latestMigration,
		PRE_TRANSITION_MIGRATION,
		`Dedicated database must be reset to pre-transition migration ${PRE_TRANSITION_MIGRATION}`,
	);
	assert.equal(
		state.canonicalMigrationApplied,
		false,
		"Schema-3 migration is already applied",
	);
	assert.equal(
		state.writeSchemaColumn,
		false,
		"write_schema_version already exists",
	);
	assert.equal(
		state.v2WriterAvailable,
		true,
		"Historical v2 writer prerequisite is unavailable",
	);
}

export function assertV3Prerequisite(state) {
	assert.equal(
		state.latestMigration,
		SCHEMA_3_MIGRATION,
		`Dedicated database must contain exact schema-3 migration ${SCHEMA_3_MIGRATION}`,
	);
	assert.equal(
		state.canonicalMigrationApplied,
		true,
		"Schema-3 migration is not applied",
	);
	assert.equal(
		state.writeSchemaColumn,
		true,
		"write_schema_version is unavailable",
	);
	assert.equal(
		state.v3FunctionsAvailable,
		true,
		"Required schema-3 functions are unavailable",
	);
}
