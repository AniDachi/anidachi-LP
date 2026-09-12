// OFFLINE ONLY. Catalog metadata in; immutable disposable-rehearsal SQL out.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	buildArtifacts,
	writeArtifacts,
} from "./production-history-hosted-artifacts.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const literal = (value) => `'${value.replaceAll("'", "''")}'`;
const keys = (value, expected) => {
	assert.ok(value && typeof value === "object" && !Array.isArray(value));
	assert.deepEqual(
		Object.keys(value).sort(),
		expected.sort(),
		"Unsupported snapshot fields",
	);
};
const text = (value) =>
	assert.ok(
		typeof value === "string" && !value.includes("\0"),
		"Expected text",
	);
const identifier = (value) => {
	text(value);
	assert.ok(
		value.length > 0 && Buffer.byteLength(value) <= 63,
		"Invalid identifier",
	);
};
const tablePrivileges = [
	"SELECT",
	"INSERT",
	"UPDATE",
	"DELETE",
	"TRUNCATE",
	"REFERENCES",
	"TRIGGER",
	"MAINTAIN",
];
function context(binding) {
	const files = buildArtifacts(binding);
	assert.ok(files["input.json"], "Original backup identity required");
	return {
		guard: files["guard.sql"],
		inputSha256: hash(files["input.json"]),
		tables: JSON.parse(files["input.json"]).publicTables,
	};
}
function validateSnapshot(snapshot, ctx) {
	keys(snapshot, ["format", "inputSha256", "objects"]);
	assert.equal(snapshot.format, 1);
	assert.equal(
		snapshot.inputSha256,
		ctx.inputSha256,
		"Original input binding mismatch",
	);
	assert.ok(
		Array.isArray(snapshot.objects) && snapshot.objects.length > 0,
		"Complete nonempty baseline required",
	);
	const identities = new Set();
	const tables = [];
	for (const o of snapshot.objects) {
		keys(o, [
			"kind",
			"schema",
			"name",
			"identityArguments",
			"owner",
			"rawAcl",
			"acl",
		]);
		assert.ok(
			["table", "function"].includes(o.kind),
			"Unsupported object kind",
		);
		identifier(o.schema);
		identifier(o.name);
		assert.equal(o.owner, "postgres", "Unsupported owner");
		assert.ok(
			o.schema === "public" ||
				(o.kind === "table" &&
					o.schema === "supabase_migrations" &&
					o.name === "schema_migrations"),
		);
		if (o.kind === "table") {
			assert.equal(o.identityArguments, null);
			tables.push(`${o.schema}.${o.name}`);
		} else {
			assert.equal(o.schema, "public");
			text(o.identityArguments);
		}
		const identity = JSON.stringify([
			o.kind,
			o.schema,
			o.name,
			o.identityArguments,
		]);
		assert.ok(!identities.has(identity), "Duplicate object");
		identities.add(identity);
		assert.ok(o.rawAcl === null || Array.isArray(o.rawAcl), "Invalid raw ACL");
		if (o.rawAcl !== null) for (const acl of o.rawAcl) text(acl);
		assert.ok(Array.isArray(o.acl), "Missing normalized ACL");
		const entries = new Set();
		for (const a of o.acl) {
			keys(a, ["grantor", "grantee", "privilege", "grantOption"]);
			assert.equal(a.grantor, "postgres", "Unsupported grantor");
			if (a.grantee !== null) identifier(a.grantee);
			assert.equal(typeof a.grantOption, "boolean");
			assert.ok(
				a.grantee !== null || !a.grantOption,
				"PUBLIC cannot have grant option",
			);
			assert.ok(
				(o.kind === "table" ? tablePrivileges : ["EXECUTE"]).includes(
					a.privilege,
				),
				"Unsupported privilege",
			);
			const key = JSON.stringify([a.grantor, a.grantee, a.privilege]);
			assert.ok(!entries.has(key), "Duplicate ACL entry");
			entries.add(key);
		}
	}
	assert.deepEqual(
		tables.sort(),
		[
			...ctx.tables.map((t) => `public.${t}`),
			"supabase_migrations.schema_migrations",
		].sort(),
		"Baseline table inventory mismatch",
	);
}
const sums = (files) => ({
	...files,
	SHA256SUMS: Object.entries(files)
		.map(([name, bytes]) => `${hash(bytes)}  ${name}\n`)
		.join(""),
});
// Catalog-only reader, shared by capture, preflight and the final assertion.
// Public supporting indexes and implicit table row/array types are permitted.
// Standalone types, inherited/partitioned relations and extension members are not.
const reader = `create or replace function pg_temp.application_acl_catalog() returns jsonb
language plpgsql set search_path=pg_catalog as $acl_reader$
declare result jsonb;
begin
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where (n.nspname='public' or (n.nspname='supabase_migrations' and c.relname='schema_migrations'))
  and (c.relkind not in ('r','i') or c.relispartition
   or exists(select 1 from pg_inherits i where i.inhrelid=c.oid or i.inhparent=c.oid)))
 then raise exception 'ACL_UNSUPPORTED_RELATION'; end if;
 if exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
  where n.nspname='public' and not (
   (t.typtype='c' and exists(select 1 from pg_class c where c.oid=t.typrelid and c.relkind='r'))
   or (t.typelem<>0 and exists(select 1 from pg_type e join pg_class c on c.oid=e.typrelid where e.oid=t.typelem and e.typtype='c' and c.relkind='r'))))
 then raise exception 'ACL_UNSUPPORTED_TYPE'; end if;
 if exists(select 1 from pg_depend d cross join lateral pg_identify_object(d.classid,d.objid,d.objsubid) i
  where d.deptype='e' and (i.schema='public' or
   (d.classid='pg_class'::regclass and exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.oid=d.objid and n.nspname='supabase_migrations' and c.relname='schema_migrations'))))
 then raise exception 'ACL_UNSUPPORTED_EXTENSION_MEMBER'; end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind<>'f')
 then raise exception 'ACL_UNSUPPORTED_ROUTINE'; end if;
 if exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  where (n.nspname='public' or (n.nspname='supabase_migrations' and c.relname='schema_migrations')) and a.attacl is not null)
 then raise exception 'ACL_UNSUPPORTED_COLUMN_ACL'; end if;
 with objects as (
  select 'table'::text kind,n.nspname::text schema,c.relname::text name,null::text args,c.relowner owner,c.relacl raw,'r'::"char" aclkind
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind='r' and (n.nspname='public' or (n.nspname='supabase_migrations' and c.relname='schema_migrations'))
  union all
  select 'function',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),p.proowner,p.proacl,'f'::"char"
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 )
 select coalesce(jsonb_agg(jsonb_build_object('kind',o.kind,'schema',o.schema,'name',o.name,'identityArguments',o.args,'owner',pg_get_userbyid(o.owner),
  'rawAcl',o.raw::text[],'acl',case when cardinality(o.raw)=0 then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(a.grantor),
   'grantee',case when a.grantee=0 then null else pg_get_userbyid(a.grantee) end,'privilege',a.privilege_type,'grantOption',a.is_grantable)
   order by a.grantor,a.grantee,a.privilege_type),'[]'::jsonb) from aclexplode(coalesce(o.raw,acldefault(o.aclkind,o.owner))) a) end)
  order by o.kind,o.schema,o.name,o.args),'[]'::jsonb) into result from objects o;
 if exists(select 1 from jsonb_array_elements(result) o where o->>'owner'<>'postgres')
 then raise exception 'ACL_UNSUPPORTED_OWNER'; end if;
 if exists(select 1 from jsonb_array_elements(result) o cross join lateral jsonb_array_elements(o->'acl') a where a->>'grantor'<>'postgres')
 then raise exception 'ACL_UNSUPPORTED_GRANTOR'; end if;
 return result;
end $acl_reader$;
`;
// Symmetric EXCEPT is independent of ACL array order and raw NULL-vs-explicit spelling.
const inventory = `(select j.obj-'rawAcl'-'acl' from jsonb_array_elements(actual) j(obj) except all select j.obj-'rawAcl'-'acl' from jsonb_array_elements(expected) j(obj))
 union all (select j.obj-'rawAcl'-'acl' from jsonb_array_elements(expected) j(obj) except all select j.obj-'rawAcl'-'acl' from jsonb_array_elements(actual) j(obj))`;
const equality = `(select j.obj-'rawAcl'-'acl',k.entry from jsonb_array_elements(actual) j(obj) cross join lateral jsonb_array_elements(j.obj->'acl') k(entry)
 except all select j.obj-'rawAcl'-'acl',k.entry from jsonb_array_elements(expected) j(obj) cross join lateral jsonb_array_elements(j.obj->'acl') k(entry))
 union all (select j.obj-'rawAcl'-'acl',k.entry from jsonb_array_elements(expected) j(obj) cross join lateral jsonb_array_elements(j.obj->'acl') k(entry)
 except all select j.obj-'rawAcl'-'acl',k.entry from jsonb_array_elements(actual) j(obj) cross join lateral jsonb_array_elements(j.obj->'acl') k(entry))`;
export function buildCaptureArtifacts(binding) {
	const ctx = context(binding);
	const expectedTables = JSON.stringify([
		...ctx.tables.map((name) => ({ schema: "public", name })),
		{ schema: "supabase_migrations", name: "schema_migrations" },
	]);
	return sums({
		"capture.sql": `\\set ON_ERROR_STOP on
${ctx.guard}begin;
set local search_path='';
set local standard_conforming_strings=on;
${reader}
do $acl_capture$ declare actual jsonb; expected jsonb := ${literal(expectedTables)}::jsonb; begin
 actual:=pg_temp.application_acl_catalog();
 if exists((select jsonb_build_object('schema',o->'schema','name',o->'name') from jsonb_array_elements(actual) o where o->>'kind'='table' except all select value from jsonb_array_elements(expected))
 union all (select value from jsonb_array_elements(expected) except all select jsonb_build_object('schema',o->'schema','name',o->'name') from jsonb_array_elements(actual) o where o->>'kind'='table'))
 then raise exception 'ACL_BASELINE_TABLE_INVENTORY_MISMATCH'; end if;
end $acl_capture$;
select jsonb_build_object('format',1,'inputSha256',${literal(ctx.inputSha256)},'objects',pg_temp.application_acl_catalog());
rollback;
`,
	});
}
export function buildRecoveryArtifacts(binding, snapshot) {
	const ctx = context(binding);
	validateSnapshot(snapshot, ctx);
	const bytes = `${JSON.stringify(snapshot, null, 2)}\n`;
	const sql = `\\set ON_ERROR_STOP on
-- Caller BEGIN, cleanup and archive replay MUST precede this file. No COMMIT here.
${ctx.guard}set local search_path='';
set local standard_conforming_strings=on;
-- In psql autocommit this table disappears before INSERT, so no ACL can mutate.
create temp table application_acl_input(document jsonb not null) on commit drop;
insert into pg_temp.application_acl_input values(${literal(JSON.stringify(snapshot))}::jsonb);
${reader}
do $acl_reconcile$
declare expected jsonb; actual jsonb; o jsonb; b jsonb; a jsonb; wanted jsonb; target text; who text; raw aclitem[]; normalized jsonb;
begin
 select document->'objects' into strict expected from pg_temp.application_acl_input;
 actual:=pg_temp.application_acl_catalog();
 if exists(${inventory}) then raise exception 'ACL_OBJECT_INVENTORY_MISMATCH'; end if;
 -- Audit representation must agree with normalized baseline before changing ACLs.
 for o in select value from jsonb_array_elements(expected) loop
  if o->'rawAcl'='null'::jsonb then raw:=null;
  else select coalesce(array_agg(value::aclitem),'{}'::aclitem[]) into raw from jsonb_array_elements_text(o->'rawAcl'); end if;
  if raw is not null and cardinality(raw)=0 then normalized:='[]'::jsonb;
  else select coalesce(jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(x.grantor),'grantee',case when x.grantee=0 then null else pg_get_userbyid(x.grantee) end,'privilege',x.privilege_type,'grantOption',x.is_grantable)),'[]'::jsonb)
  into normalized from aclexplode(coalesce(raw,acldefault(case when o->>'kind'='table' then 'r'::"char" else 'f'::"char" end,'postgres'::regrole))) x; end if;
  if exists((select value from jsonb_array_elements(normalized) except all select value from jsonb_array_elements(o->'acl')) union all (select value from jsonb_array_elements(o->'acl') except all select value from jsonb_array_elements(normalized)))
  then raise exception 'ACL_RAW_NORMALIZED_MISMATCH'; end if;
 end loop;
 for o in select value from jsonb_array_elements(actual) loop
  select value into strict b from jsonb_array_elements(expected) e(value) where value-'acl'-'rawAcl'=o-'acl'-'rawAcl';
  -- o is trusted CURRENT catalog output, never the snapshot's SQL signature.
  target:=case when o->>'kind'='table' then format('TABLE %I.%I',o->>'schema',o->>'name')
   else format('FUNCTION %I.%I(%s)',o->>'schema',o->>'name',o->>'identityArguments') end;
  for a in select value from jsonb_array_elements(o->'acl') loop
   select value into wanted from jsonb_array_elements(b->'acl') e(value) where value-'grantOption'=a-'grantOption';
   who:=case when a->'grantee'='null'::jsonb then 'PUBLIC' else format('%I',a->>'grantee') end;
   if wanted is null then execute format('REVOKE %s ON %s FROM %s RESTRICT',a->>'privilege',target,who);
   elsif (a->>'grantOption')::boolean and not (wanted->>'grantOption')::boolean then
    execute format('REVOKE GRANT OPTION FOR %s ON %s FROM %s RESTRICT',a->>'privilege',target,who);
   end if;
  end loop;
  for a in select value from jsonb_array_elements(b->'acl') loop
   select value into wanted from jsonb_array_elements(o->'acl') e(value) where value-'grantOption'=a-'grantOption';
   who:=case when a->'grantee'='null'::jsonb then 'PUBLIC' else format('%I',a->>'grantee') end;
   if wanted is null or ((a->>'grantOption')::boolean and not (wanted->>'grantOption')::boolean) then
    execute format('GRANT %s ON %s TO %s%s',a->>'privilege',target,who,case when (a->>'grantOption')::boolean then ' WITH GRANT OPTION' else '' end);
   end if;
  end loop;
 end loop;
 actual:=pg_temp.application_acl_catalog();
 if exists(${inventory}) or exists(${equality}) then raise exception 'ACL_FINAL_EQUALITY_MISMATCH'; end if;
end $acl_reconcile$;
drop table pg_temp.application_acl_input;
`;
	return sums({ "snapshot.json": bytes, "reconcile.sql": sql });
}
if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const [mode, bindingFile, directory, snapshotFile] = process.argv.slice(2);
	assert.ok(
		(mode === "capture" && process.argv.length === 5) ||
			(mode === "reconcile" && process.argv.length === 6),
		"Usage: application-acl.mjs capture binding.json directory | reconcile binding.json directory snapshot.json (offline only)",
	);
	const binding = JSON.parse(readFileSync(bindingFile, "utf8"));
	writeArtifacts(
		resolve(directory),
		mode === "capture"
			? buildCaptureArtifacts(binding)
			: buildRecoveryArtifacts(
					binding,
					JSON.parse(readFileSync(snapshotFile, "utf8")),
				),
	);
	console.log(
		"Immutable offline application ACL artifacts verified; no connection opened.",
	);
}
