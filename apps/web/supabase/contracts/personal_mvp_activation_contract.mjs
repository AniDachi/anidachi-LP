import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { requireDisposableTarget, proofPsqlArgs } from './watch_history_v3_disposable_target.mjs';

assert.equal(process.env.DOCKER_HOST, 'unix:///Users/vladyslavhulyi/.colima/anidachi-personal-mvp/docker.sock');
const target = requireDisposableTarget();
assert.equal(target.project, 'anidachi-personal-mvp-20260908');
assert.equal(target.hostPort, 55582);
const args = proofPsqlArgs(target.container);
const owner = 'af111111-1111-4111-8111-111111111111';
const readme = readFileSync(new URL('../../../../docs/releases/personal-history-mvp/README.md', import.meta.url), 'utf8');
// Execute the exact owner transaction, except rollback its successful activation.
const activation = readme.match(/```sql\n(begin;\nset local lock_timeout[\s\S]*?)\n```/)[1].replace(/commit;\s*$/, 'rollback;');
function sql(input, failure = false) {
  const r = spawnSync('docker', args, { input, encoding: 'utf8', timeout: 20000 });
  assert.ifError(r.error);
  if (!failure) assert.equal(r.status, 0, r.stderr);
  return r;
}
function session(input) {
  const p = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  p.stdout.on('data', d => { stdout += d; });
  p.stderr.on('data', d => { stderr += d; });
  const done = new Promise(resolve => p.on('close', status => resolve({ status, stdout, stderr })));
  p.stdin.write(input);
  return { p, done, output: () => stdout };
}
const delay = () => new Promise(r => setTimeout(r, 30));
async function until(check) {
  const deadline = Date.now() + 4000;
  while (!check()) { assert.ok(Date.now() < deadline, 'Interleaving barrier timed out'); await delay(); }
}
const policy = () => sql('select active from public.personal_history_policy;').stdout.trim();
assert.equal(policy(), 'f');
assert.equal(sql('select count(*) from supabase_migrations.schema_migrations;').stdout.trim(), '55');
assert.equal(sql("select count(*) from public.rooms where status <> 'ended' and media_lease is null;").stdout.trim(), '0', 'Requires initially drained disposable fixture');
assert.equal(sql(`select count(*) from public.users where id='${owner}';`).stdout.trim(), '0');
let creator;
try {
  creator = session(`begin; set local statement_timeout='15s'; set local idle_in_transaction_session_timeout='15s';
    insert into public.users(id,email,display_name,plan) values('${owner}','activation-fixture@example.test','Synthetic activation','free');
    select outcome from public.create_room_with_active_session_v2('${owner}','activation-fixture',null,null,null,null,null,null,null,'activation-fixture','free',4,4,false,false,1);
    \\echo CREATE_READY
`);
  await until(() => creator.output().includes('CREATE_READY'));
  assert.match(creator.output(), /claimed/);
  // The inventory cannot see the uncommitted room. Actual create holds policy SHARE.
  assert.equal(sql("select count(*) from public.rooms where status <> 'ended' and media_lease is null;").stdout.trim(), '0');
  const activating = session("set application_name='mvp_activation_race';\n" + activation + '\n');
  activating.p.stdin.end();
  await until(() => sql("select count(*) from pg_stat_activity where application_name='mvp_activation_race' and wait_event_type='Lock';").stdout.trim() === '1');
  creator.p.stdin.end('commit;\n');
  assert.equal((await creator.done).status, 0);
  const raced = await activating.done;
  assert.notEqual(raced.status, 0, 'A create committed while activation waited must reject activation');
  assert.match(raced.stderr, /Legacy rooms remain/);
  assert.equal(policy(), 'f');
  console.log('PASS racing real legacy create: exclusive activation waited, then rejected newly committed lobby');
  const room = sql(`select room_id from public.rooms where host_user_id='${owner}';`).stdout.trim();
  assert.match(room, /^[a-zA-Z0-9-]+$/);
  sql(`update public.rooms set created_at=now()-interval '30 days' where room_id='${room}';`);
  // Actual room statuses are lobby/live/ended. Ended or physically deleted rows stop counting.
  for (const status of ['lobby', 'live']) {
    sql(`update public.rooms set status='${status}' where room_id='${room}';`);
    assert.match(sql(activation, true).stderr, /Legacy rooms remain/);
  }
  sql(`update public.rooms set status='ended' where room_id='${room}';`);
  assert.match(sql(activation).stdout, /t/);
  assert.equal(policy(), 'f');
  console.log('PASS lobby/live reject; ended room permits transaction activation with rollback');
} finally {
  creator?.p.stdin.end('rollback;\n');
  if (creator) await creator.done;
  sql(`begin; delete from public.rooms where host_user_id='${owner}'; delete from public.users where id='${owner}'; commit;`);
}
assert.match(sql(activation).stdout, /t/);
assert.equal(policy(), 'f');
assert.equal(sql(`select count(*) from public.users where id='${owner}';`).stdout.trim(), '0');
assert.equal(sql('select count(*) from supabase_migrations.schema_migrations;').stdout.trim(), '55');
console.log('PASS deleted fixture / drained state activates inside rollback; schema55 and policyfalse retained');
