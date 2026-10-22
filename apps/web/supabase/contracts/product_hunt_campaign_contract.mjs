// Explicitly disposable local target only; accepts no database URL or credentials.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const container=process.env.PRODUCT_HUNT_TEST_CONTAINER;
assert.ok(container?.startsWith("anidachi-promo-"),"Explicit disposable target required");
const run=(args,input)=>{
 const r=spawnSync("docker",args,{input,encoding:"utf8",timeout:30000});
 assert.ifError(r.error);assert.equal(r.status,0,r.stderr);return r.stdout;
};
const info=JSON.parse(run(["inspect",container]))[0];
assert.equal(info.Config.Labels["anidachi.disposable"],"true");
assert.equal(info.Config.Labels["anidachi.task"],"product-hunt");
assert.equal(info.HostConfig.NetworkMode,"none");
assert.equal(Object.keys(info.HostConfig.PortBindings??{}).length,0);
const args=["exec","-i",container,"psql","-h","/tmp","-U","postgres","-d","postgres","-XqAt","-v","ON_ERROR_STOP=1"];
const sql=input=>run(args,input);
const tap=sql(readFileSync(fileURLToPath(new URL("../tests/product_hunt_campaign.test.sql",import.meta.url)),"utf8"));
assert.doesNotMatch(tap,/not ok \d/);assert.match(tap,/1\.\.11/);
const owner="af000000-0000-4000-8000-000000000099";
sql(`insert into public.users(id,email,display_name) values('${owner}','race@example.test','Race');
 insert into public.billing_customers values('${owner}','cus_promo_race');`);
function concurrentClaim() {
 return new Promise((resolve,reject)=>{
  const p=spawn("docker",args,{stdio:["pipe","pipe","pipe"],timeout:15000});let out="",err="";
  p.stdout.on("data",d=>out+=d);p.stderr.on("data",d=>err+=d);p.on("error",reject);
  p.on("close",code=>code===0?resolve(out.trim()):reject(new Error(err)));
  p.stdin.end(`begin;set local role service_role;select public.claim_product_hunt_promotion_v1('${owner}','cus_promo_race','coupon_race')->>'id';select pg_sleep(0.1);commit;`);
 });
}
try {
 const ids=await Promise.all(Array.from({length:8},concurrentClaim));
 assert.equal(new Set(ids).size,1);assert.match(ids[0],/^[0-9a-f-]{36}$/);
 assert.equal(sql(`select count(*) from public.subscription_campaign_bindings where user_id='${owner}';`).trim(),"1");
 console.log("PASS: 11 SQL security/retry/deletion assertions; eight concurrent claims return one binding.");
} finally {
 sql(`delete from public.subscription_campaign_bindings where user_id='${owner}';delete from public.users where id='${owner}';`);
}
