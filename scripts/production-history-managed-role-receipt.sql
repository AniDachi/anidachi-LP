-- Read-only metadata receipt, not an acceptance classifier or a standalone guard.
-- psql requires receipt_context JSON from the immutable transition input workflow.
-- Run after transition/guard.sql in one explicit READ ONLY transaction.
-- Only the named role's password NULL predicate is evaluated; no hash is emitted.
with
context as (select :'receipt_context'::jsonb as document),
target as (select oid, rolname, rolcanlogin, rolcreaterole, rolinherit, rolsuper,
  rolbypassrls, rolcreatedb, rolreplication, rolconnlimit, rolvaliduntil
  from pg_catalog.pg_roles where rolname = 'supabase_functions_admin'),
expected_roles(name) as (values ('anon'), ('authenticated'), ('authenticator'), ('service_role'), ('postgres')),
producing_database as (select oid, datname, datdba, datacl from pg_catalog.pg_database where datname = current_database()),
hook as (select p.oid, n.nspname, p.proname, p.proowner, p.prosecdef
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'extensions' and p.proname = 'grant_pg_net_access' and p.pronargs = 0)
select pg_catalog.jsonb_build_object(
  'format', 1,
  'context', context.document,
  'context_complete', (
    jsonb_typeof(context.document) = 'object'
    and context.document->>'phase' in ('baseline', 'pg-net-installed', 'post-cleanup')
    and context.document->>'input_sha256' ~ '^[0-9a-f]{64}$'
    and context.document->>'query_sha256' ~ '^[0-9a-f]{64}$'
    and context.document->>'source_commit' ~ '^[0-9a-f]{40}$'
    and context.document->>'source_commit' = context.document->'target'->>'releaseCommit'
    and context.document->'target'->>'projectRef' ~ '^[a-z]{20}$'
    and context.document->'target'->>'projectRef' not in ('bynsjjxzatxndzjkogim', 'cyppqpprkygjloyfvvvj')
    and context.document->'target'->>'nonce' ~ '^[0-9a-f]{32}$'
    and context.document->'target'->>'backupSha256' ~ '^[0-9a-f]{64}$'
    and context.document->'target'->>'database' = current_database()
    and context.document->'target'->>'sessionUser' = session_user
  ) is true,
  'observed_at', clock_timestamp(),
  'producer', jsonb_build_object('database', current_database(),
    'database_oid', (select oid from producing_database), 'session_user', session_user,
    'effective_user', current_user, 'selected_role', current_setting('role'),
    'effective_superuser', (select rolsuper from pg_catalog.pg_roles where rolname = current_user),
    'server_version', current_setting('server_version'), 'server_version_num', current_setting('server_version_num'),
    'transaction_read_only', current_setting('transaction_read_only')),
  'role', jsonb_build_object('expected_name', 'supabase_functions_admin', 'exists', exists(select 1 from target),
    'attributes', (select jsonb_build_object('oid', oid, 'name', rolname, 'login', rolcanlogin,
      'createrole', rolcreaterole, 'inherit', rolinherit, 'superuser', rolsuper, 'bypassrls', rolbypassrls,
      'createdb', rolcreatedb, 'replication', rolreplication, 'connection_limit', rolconnlimit, 'valid_until', rolvaliduntil) from target),
    'password_configured', (select rolpassword is not null from pg_catalog.pg_authid where rolname = 'supabase_functions_admin')),
  'memberships', case when exists(select 1 from target) then (
    select coalesce(jsonb_agg(jsonb_build_object('oid', m.oid, 'role_oid', m.roleid,
      'role', pg_get_userbyid(m.roleid), 'member_oid', m.member, 'member', pg_get_userbyid(m.member),
      'grantor_oid', m.grantor, 'grantor', pg_get_userbyid(m.grantor), 'admin', m.admin_option,
      'set', m.set_option, 'inherit', m.inherit_option) order by m.roleid, m.member, m.grantor), '[]'::jsonb)
    from pg_catalog.pg_auth_members m join target t on t.oid in (m.roleid, m.member, m.grantor)) else null end,
  'shared_dependencies', case when exists(select 1 from target) then (
    select coalesce(jsonb_agg(jsonb_build_object('database_oid', d.dbid, 'database', db.datname,
      'scope', case when d.dbid = 0 then 'cluster-shared' when d.dbid = producing_database.oid then 'producing-database' else 'other-database' end,
      'catalog_oid', d.classid, 'catalog', d.classid::regclass::text, 'object_oid', d.objid, 'subobject', d.objsubid,
      'referenced_catalog_oid', d.refclassid, 'referenced_object_oid', d.refobjid, 'dependency_type', d.deptype,
      'object_description', case when d.dbid in (0, producing_database.oid) then pg_describe_object(d.classid, d.objid, d.objsubid) else null end)
      order by d.dbid, d.classid, d.objid, d.objsubid, d.deptype), '[]'::jsonb)
    from pg_catalog.pg_shdepend d join target t on d.refobjid = t.oid
    left join pg_catalog.pg_database db on db.oid = d.dbid cross join producing_database
    where d.refclassid = 'pg_catalog.pg_authid'::regclass) else null end,
  'settings', case when exists(select 1 from target) then (
    select jsonb_build_object('row_count', count(*), 'rows', coalesce(jsonb_agg(jsonb_build_object(
      'database_oid', s.setdatabase, 'database', db.datname, 'setting_count', cardinality(s.setconfig),
      'setting_names', (select jsonb_agg(split_part(v, '=', 1) order by split_part(v, '=', 1)) from unnest(s.setconfig) v))
      order by s.setdatabase), '[]'::jsonb))
    from pg_catalog.pg_db_role_setting s join target t on s.setrole = t.oid
    left join pg_catalog.pg_database db on db.oid = s.setdatabase) else null end,
  'session_count', case when exists(select 1 from target) then (
    select count(*) from pg_catalog.pg_stat_activity a join target t on a.usesysid = t.oid) else null end,
  'expected_role_set_checks', (select jsonb_agg(jsonb_build_object('expected_role', e.name,
    'exists', r.oid is not null, 'oid', r.oid,
    'can_set_managed_role', case when r.oid is not null and exists(select 1 from target) then pg_has_role(r.oid, (select oid from target), 'SET') else null end,
    'managed_can_set_role', case when r.oid is not null and exists(select 1 from target) then pg_has_role((select oid from target), r.oid, 'SET') else null end)
    order by e.name) from expected_roles e left join pg_catalog.pg_roles r on r.rolname = e.name),
  'public_derived_access', jsonb_build_object('scope', 'producing database and public application schema; PUBLIC routine EXECUTE remains in separate application ACL snapshot',
    'database', (select jsonb_build_object('name', db.datname, 'privileges',
      (select coalesce(jsonb_agg(jsonb_build_object('privilege', a.privilege_type, 'grant_option', a.is_grantable,
        'grantor', pg_get_userbyid(a.grantor)) order by a.privilege_type, a.grantor), '[]'::jsonb)
       from aclexplode(coalesce(db.datacl, acldefault('d', db.datdba))) a where a.grantee = 0)) from producing_database db),
    'public_schema', (select jsonb_build_object('exists', true, 'owner', pg_get_userbyid(n.nspowner), 'privileges',
      (select coalesce(jsonb_agg(jsonb_build_object('privilege', a.privilege_type, 'grant_option', a.is_grantable,
        'grantor', pg_get_userbyid(a.grantor)) order by a.privilege_type, a.grantor), '[]'::jsonb)
       from aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a where a.grantee = 0))
      from pg_catalog.pg_namespace n where n.nspname = 'public')),
  'pg_net', jsonb_build_object('exists', exists(select 1 from pg_catalog.pg_extension where extname = 'pg_net'),
    'metadata', (select jsonb_build_object('oid', e.oid, 'version', e.extversion, 'owner', pg_get_userbyid(e.extowner),
      'schema', n.nspname) from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_net')),
  'platform_hook', jsonb_build_object('expected_identity', 'extensions.grant_pg_net_access()',
    'exists', exists(select 1 from hook), 'metadata', (select jsonb_build_object('oid', h.oid,
      'owner', pg_get_userbyid(h.proowner), 'security_definer', h.prosecdef, 'definition', pg_get_functiondef(h.oid)) from hook h),
    'event_triggers', (select coalesce(jsonb_agg(jsonb_build_object('oid', e.oid, 'name', e.evtname,
      'owner', pg_get_userbyid(e.evtowner), 'event', e.evtevent, 'enabled', e.evtenabled, 'tags', e.evttags,
      'function_oid', e.evtfoid) order by e.evtname), '[]'::jsonb) from pg_catalog.pg_event_trigger e join hook h on h.oid = e.evtfoid)),
  'authentication_boundary', 'Loaded HBA not inspected; no test login. Conditional policy relies on documented managed customer password/SCRAM paths, not exclusion of privileged internal platform access.'
) as managed_role_receipt from context;
