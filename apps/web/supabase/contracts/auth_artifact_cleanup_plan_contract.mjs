import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const container = process.env.AUTH_ARTIFACT_CLEANUP_DB_CONTAINER;
assert.ok(container, "AUTH_ARTIFACT_CLEANUP_DB_CONTAINER is required");

const fixtureUserId = "8f000000-0000-4000-8000-000000000006";
const oldestAbsoluteFamilyId = "8f300000-0000-4000-8000-000000000001";
const lockApplicationName = "auth_artifact_cleanup_plan_lock";
const psqlArgs = [
  "exec",
  container,
  "psql",
  "-v",
  "ON_ERROR_STOP=1",
  "-U",
  "postgres",
  "-d",
  "postgres",
  "-qAt",
];

function query(sql) {
  return execFileSync("docker", [...psqlArgs, "-c", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function start(sql) {
  const child = spawn("docker", [...psqlArgs, "-c", sql], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const completion = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
  return { completion };
}

async function waitForLock() {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const count = query(`
      select pg_catalog.count(*)
      from pg_catalog.pg_stat_activity
      where application_name = '${lockApplicationName}'
        and wait_event_type = 'Timeout'
        and wait_event = 'PgSleep'
    `);
    if (count === "1") return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail("the lineage plan lock did not reach PgSleep");
}

function extractStatement(source, name) {
  const startMarker = `-- plan-contract:${name}:start`;
  const endMarker = `-- plan-contract:${name}:end`;
  assert.equal(
    source.split(startMarker).length - 1,
    1,
    `${name} must have exactly one start marker`,
  );
  assert.equal(
    source.split(endMarker).length - 1,
    1,
    `${name} must have exactly one end marker`,
  );

  const startIndex = source.indexOf(startMarker) + startMarker.length;
  const endIndex = source.indexOf(endMarker, startIndex);
  const statement = source.slice(startIndex, endIndex).trim();
  assert.match(statement, /^with\s/u, `${name} must start with WITH`);
  assert.match(statement, /delete from public\./u, `${name} must execute DELETE`);
  assert.ok(statement.endsWith(";"), `${name} must end with a semicolon`);

  return statement.replaceAll(/\bv_now\b/gu, "current_timestamp");
}

function explain(statement) {
  const raw = query(`
    begin;
    reset all;
    explain (analyze, buffers, costs off, format json)
    ${statement}
    rollback;
  `);
  const parsed = JSON.parse(raw);
  assert.equal(parsed.length, 1, "EXPLAIN must return one JSON plan");
  return parsed[0];
}

function flattenPlan(node, result = []) {
  result.push(node);
  for (const child of node.Plans ?? []) flattenPlan(child, result);
  return result;
}

function findSubplan(nodes, name) {
  const node = nodes.find((candidate) => candidate["Subplan Name"] === `CTE ${name}`);
  assert.ok(node, `missing CTE plan for ${name}`);
  return node;
}

function actualVisits(node) {
  return node["Actual Rows"] * node["Actual Loops"];
}

function assertPlan(planResult, {
  name,
  branchNames,
  candidatePoolCap,
  globalCandidateName,
  globalCandidateCap,
}) {
  const root = planResult.Plan;
  const nodes = flattenPlan(root);
  assert.equal(root["Node Type"], "ModifyTable", `${name} must explain a DELETE`);
  assert.equal(root.Operation, "Delete", `${name} must retain DELETE semantics`);

  for (const branchName of branchNames) {
    const branch = findSubplan(nodes, branchName);
    assert.ok(
      actualVisits(branch) <= 100,
      `${name} ${branchName} visited more than 100 rows`,
    );
  }

  const candidatePool = findSubplan(nodes, "candidate_pool");
  assert.ok(
    actualVisits(candidatePool) <= candidatePoolCap,
    `${name} candidate_pool exceeded ${candidatePoolCap} rows`,
  );

  if (globalCandidateName) {
    const globalCandidates = findSubplan(nodes, globalCandidateName);
    assert.ok(
      actualVisits(globalCandidates) <= globalCandidateCap,
      `${name} ${globalCandidateName} exceeded ${globalCandidateCap} rows`,
    );
  }

  const indexes = new Set(
    nodes.map((node) => node["Index Name"]).filter(Boolean),
  );
  for (const indexName of [
    "refresh_token_families_revoked_cleanup_idx",
    "refresh_token_families_absolute_cleanup_idx",
    "refresh_token_families_idle_cleanup_idx",
    "refresh_token_families_pkey",
    "refresh_token_lineage_family_idx",
  ]) {
    assert.ok(
      indexes.has(indexName),
      `${name} did not use ${indexName}; used ${[...indexes].sort().join(", ")}`,
    );
  }

  const forbiddenSeqScans = nodes.filter(
    (node) =>
      node["Node Type"] === "Seq Scan" &&
      ["refresh_token_families", "refresh_token_lineage"].includes(
        node["Relation Name"],
      ),
  );
  assert.deepEqual(
    forbiddenSeqScans,
    [],
    `${name} must not sequentially scan family or lineage authority`,
  );

  const sorts = nodes.filter((node) => node["Node Type"] === "Sort");
  assert.ok(sorts.length > 0, `${name} must expose bounded sort evidence`);
  for (const sort of sorts) {
    assert.ok(
      actualVisits(sort) <= 300,
      `${name} sort exceeded the three-branch 300-row cap`,
    );
  }

  const candidatePoolSorts = flattenPlan(candidatePool, []).filter(
    (node) => node["Node Type"] === "Sort",
  );
  for (const sort of candidatePoolSorts) {
    assert.ok(
      actualVisits(sort) <= candidatePoolCap,
      `${name} candidate-pool sort exceeded ${candidatePoolCap} rows`,
    );
  }

  let globalCandidateSorts = [];
  if (globalCandidateName) {
    const globalCandidates = findSubplan(nodes, globalCandidateName);
    globalCandidateSorts = flattenPlan(globalCandidates, []).filter(
      (node) => node["Node Type"] === "Sort",
    );
    for (const sort of globalCandidateSorts) {
      assert.ok(
        actualVisits(sort) <= globalCandidateCap,
        `${name} global-candidate sort exceeded ${globalCandidateCap} rows`,
      );
    }
  }

  return {
    executionTimeMs: planResult["Execution Time"],
    sharedHits: root["Shared Hit Blocks"] ?? 0,
    branchRows: Object.fromEntries(
      branchNames.map((branchName) => [
        branchName,
        actualVisits(findSubplan(nodes, branchName)),
      ]),
    ),
    candidatePoolRows: actualVisits(candidatePool),
    globalCandidateRows: globalCandidateName
      ? actualVisits(findSubplan(nodes, globalCandidateName))
      : null,
    maxSortRows: Math.max(...sorts.map(actualVisits)),
    candidatePoolMaxSortRows: candidatePoolSorts.length
      ? Math.max(...candidatePoolSorts.map(actualVisits))
      : 0,
    globalCandidateMaxSortRows: globalCandidateSorts.length
      ? Math.max(...globalCandidateSorts.map(actualVisits))
      : null,
    indexes: [...indexes].sort(),
  };
}

const migration = readFileSync(
  new URL("../migrations/20260820040229_auth_artifact_cleanup.sql", import.meta.url),
  "utf8",
);
const lineageDelete = extractStatement(
  migration,
  "auth-artifact-lineage-delete",
);
const familyDelete = extractStatement(
  migration,
  "auth-artifact-family-delete",
);

let lockProcess;
try {
  query(`
    delete from public.users where id = '${fixtureUserId}'::uuid;
    insert into public.users (id, email, display_name)
    values (
      '${fixtureUserId}',
      'auth-cleanup-plan-contract@example.test',
      'Auth Cleanup Plan Contract'
    );

    insert into public.refresh_token_families (
      id, user_id, channel, current_token_hash, created_at, last_used_at,
      absolute_expires_at, revoked_at
    )
    select
      ('8f200000-0000-4000-8000-' || lpad(item::text, 12, '0'))::uuid,
      '${fixtureUserId}', 'extension',
      repeat(md5('plan-revoked-family-' || item), 2),
      current_timestamp - interval '30 days',
      current_timestamp - interval '20 days',
      current_timestamp + interval '335 days',
      current_timestamp - interval '10 days'
    from generate_series(1, 120) as item;

    insert into public.refresh_token_families (
      id, user_id, channel, current_token_hash, created_at, last_used_at,
      absolute_expires_at, revoked_at
    )
    select
      ('8f300000-0000-4000-8000-' || lpad(item::text, 12, '0'))::uuid,
      '${fixtureUserId}', 'website',
      repeat(md5('plan-absolute-family-' || item), 2),
      current_timestamp - interval '400 days',
      current_timestamp - interval '1 day',
      current_timestamp - interval '35 days', null
    from generate_series(1, 120) as item;

    insert into public.refresh_token_families (
      id, user_id, channel, current_token_hash, created_at, last_used_at,
      absolute_expires_at, revoked_at
    )
    select
      ('8f400000-0000-4000-8000-' || lpad(item::text, 12, '0'))::uuid,
      '${fixtureUserId}', 'website',
      repeat(md5('plan-idle-family-' || item), 2),
      current_timestamp - interval '200 days',
      current_timestamp - interval '100 days',
      current_timestamp + interval '165 days', null
    from generate_series(1, 120) as item;

    insert into public.refresh_token_families (
      id, user_id, channel, current_token_hash, created_at, last_used_at,
      absolute_expires_at, revoked_at
    )
    select
      ('8f500000-0000-4000-8000-' || lpad(item::text, 12, '0'))::uuid,
      '${fixtureUserId}', 'website',
      repeat(md5('plan-active-family-' || item), 2),
      current_timestamp - interval '1 day',
      current_timestamp,
      current_timestamp + interval '364 days', null
    from generate_series(1, 10000) as item;

    insert into public.refresh_token_lineage (
      token_hash, family_id, successor_token_hash, used_at
    )
    select
      repeat(md5('plan-lineage-' || family.id::text), 2),
      family.id,
      family.current_token_hash,
      family.last_used_at
    from public.refresh_token_families as family
    where family.user_id = '${fixtureUserId}'::uuid;

    insert into public.refresh_token_lineage (
      token_hash, family_id, successor_token_hash, used_at
    )
    select
      repeat(md5('plan-extra-lineage-' || item), 2),
      '${oldestAbsoluteFamilyId}',
      repeat(md5('plan-absolute-family-1'), 2),
      current_timestamp - interval '19 days'
    from generate_series(1, 4999) as item;

    analyze public.refresh_token_families;
    analyze public.refresh_token_lineage;
  `);

  lockProcess = start(`
    begin;
    set application_name = '${lockApplicationName}';
    update public.refresh_token_lineage
    set used_at = used_at
    where token_hash = (
      select lineage.token_hash
      from public.refresh_token_lineage as lineage
      where lineage.family_id = '${oldestAbsoluteFamilyId}'::uuid
      order by lineage.used_at, lineage.token_hash
      limit 1
    );
    select pg_catalog.pg_sleep(30);
    commit;
  `);
  await waitForLock();

  const lineagePlan = explain(lineageDelete);
  const lineageSummary = assertPlan(lineagePlan, {
    name: "lineage DELETE",
    branchNames: [
      "revoked_candidates",
      "absolute_candidates",
      "idle_candidates",
    ],
    candidatePoolCap: 300,
    globalCandidateName: "bounded_candidates",
    globalCandidateCap: 100,
  });

  query(`
    select pg_catalog.pg_terminate_backend(pid)
    from pg_catalog.pg_stat_activity
    where application_name = '${lockApplicationName}'
  `);
  await lockProcess.completion;
  lockProcess = undefined;

  query(`
    delete from public.refresh_token_lineage
    where family_id = '${oldestAbsoluteFamilyId}'::uuid
  `);
  const familyPlan = explain(familyDelete);
  const familySummary = assertPlan(familyPlan, {
    name: "family DELETE",
    branchNames: [
      "revoked_candidate",
      "absolute_candidate",
      "idle_candidate",
    ],
    candidatePoolCap: 3,
    globalCandidateName: null,
    globalCandidateCap: null,
  });

  console.log("Auth artifact cleanup production-plan contract passed");
  console.log(JSON.stringify({ lineage: lineageSummary, family: familySummary }));
} finally {
  try {
    query(`
      select pg_catalog.pg_terminate_backend(pid)
      from pg_catalog.pg_stat_activity
      where application_name = '${lockApplicationName}'
    `);
  } catch {}
  if (lockProcess) await lockProcess.completion.catch(() => undefined);
  try {
    query(`delete from public.users where id = '${fixtureUserId}'::uuid`);
  } catch {}
}
