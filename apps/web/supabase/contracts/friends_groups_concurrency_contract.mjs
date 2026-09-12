import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
// This contract must never connect to a linked/remote project or an existing
// developer database. Start a separate disposable container with this exact name.
const container = process.argv[2];
assert.equal(container, 'anidachi-friends-editor-test', 'Use the dedicated disposable local container');
const owner='fc111111-1111-4111-8111-111111111111';
const a='fc222222-2222-4222-8222-222222222222';
const b='fc333333-3333-4333-8333-333333333333';
const group='fc444444-4444-4444-8444-444444444444';
function sql(text) {
  return new Promise(resolve=>{
    const p=spawn('docker',['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-At']);
    let out='',err=''; p.stdout.on('data',c=>out+=c);p.stderr.on('data',c=>err+=c);
    p.on('close',code=>resolve({code,out,err}));
    p.stdin.end("set statement_timeout='20s';set lock_timeout='10s';\n"+text);
  });
}
async function ok(text){const result=await sql(text);assert.equal(result.code,0,result.err);return result.out;}
const cleanup=`delete from public.users where id in ('${owner}','${a}','${b}');`;
await ok(cleanup);
try {
  await ok(`insert into public.users(id,email,display_name) values ('${owner}','concurrency-owner@example.test','Owner'),('${a}','concurrency-a@example.test','A'),('${b}','concurrency-b@example.test','B'); insert into public.friend_invite_links(sender_user_id,token_hash) values('${owner}',repeat('d',64));`);
  const accept=await Promise.all([a,b].map(id=>sql(`select public.accept_friend_link_v1(repeat('d',64),'${id}');`)));
  assert.equal(accept.filter(r=>r.code===0).length,1,'exactly one concurrent link recipient wins');
  assert.match(accept.find(r=>r.code!==0).err,/friend_link_used/);
  assert.match(await ok(`select count(*) from public.friendships where requester_user_id='${owner}' and status='accepted';`),/\n1\n$/);
  console.log('PASS concurrent one-time acceptance: one recipient and one friendship');
  await ok(`insert into public.friendships(requester_user_id,addressee_user_id,status) values('${owner}','${a}','accepted'),('${owner}','${b}','accepted') on conflict do nothing;`);
  const create=(id)=>`select public.save_friend_group_v1('${owner}','${id}','Circle',array['${a}'::uuid],null,true,1);`;
  const creation=await Promise.all([group,'fc555555-5555-4555-8555-555555555555'].map(id=>sql(create(id))));
  assert.equal(creation.filter(r=>r.code===0).length,1,'concurrent creation cannot exceed plan quota');
  assert.match(creation.find(r=>r.code!==0).err,/group_limit_reached/);
  console.log('PASS concurrent group creation respects quota');
  const savedGroup=(await ok(`select id from public.friend_groups where owner_user_id='${owner}' and archived_at is null;`)).trim().split('\n').at(-1);
  const revision=(await ok(`select updated_at from public.friend_groups where id='${savedGroup}';`)).trim().split('\n').at(-1);
  const edits=await Promise.all(['First edit','Second edit'].map(name=>sql(`select public.save_friend_group_v1('${owner}','${savedGroup}','${name}',array['${a}'::uuid],'${revision}',false,1);`)));
  assert.equal(edits.filter(r=>r.code===0).length,1,'same-revision concurrent edits have exactly one winner');
  assert.match(edits.find(r=>r.code!==0).err,/group_edit_conflict/);
  console.log('PASS concurrent edits reject the stale save');
  const rev=(await ok(`select updated_at from public.friend_groups where id='${savedGroup}';`)).trim().split('\n').at(-1);
  const removeAndSave=await Promise.all([
    sql(`begin; update public.friendships set status='removed' where requester_user_id='${owner}' and addressee_user_id='${b}'; select pg_sleep(0.2); commit;`),
    sql(`select public.save_friend_group_v1('${owner}','${savedGroup}','Circle with B',array['${a}'::uuid,'${b}'::uuid],'${rev}',false,1);`)
  ]);
  assert.equal(removeAndSave[0].code,0,removeAndSave[0].err);
  if(removeAndSave[1].code!==0)assert.match(removeAndSave[1].err,/group_friend_unavailable|group_edit_conflict/);
  assert.match(await ok(`select count(*) from public.friend_group_members where group_id='${savedGroup}' and friend_user_id='${b}';`),/\n0\n$/);
  console.log('PASS concurrent unfriend never leaves a stale group membership');
} finally { await ok(cleanup); }
