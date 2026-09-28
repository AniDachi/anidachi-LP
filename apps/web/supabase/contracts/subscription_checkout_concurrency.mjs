// Uses a labeled local Docker database only, never a remote database URL.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const context = process.env.PAID_HOSTING_DOCKER_CONTEXT;
const container = process.env.PAID_HOSTING_TEST_CONTAINER;
assert.ok(context && container?.startsWith("anidachi-paid-hosting-"));
function docker(args, input = "") {
	return new Promise((resolve, reject) => {
		const p = spawn("docker", ["--context", context, ...args], {
			stdio: ["pipe", "pipe", "pipe"],
			timeout: 30000,
		});
		let out = "",
			err = "";
		p.stdout.on("data", (v) => {
			out += v;
		});
		p.stderr.on("data", (v) => {
			err += v;
		});
		p.on("error", reject);
		p.on("close", (code) =>
			code === 0 ? resolve(out) : reject(new Error(err)),
		);
		p.stdin.end(input);
	});
}
const inspected = JSON.parse(await docker(["inspect", container]))[0];
assert.equal(inspected.Config.Labels["anidachi.disposable"], "true");
assert.equal(inspected.Config.Labels["anidachi.task"], "paid-hosting");
const sql = (input) =>
	docker(
		[
			"exec",
			"-i",
			container,
			"psql",
			"-U",
			"postgres",
			"-d",
			"postgres",
			"-XqAt",
			"-v",
			"ON_ERROR_STOP=1",
		],
		input,
	);
const user = randomUUID();
try {
	await sql(`insert into public.users(id,email,display_name) values('${user}','${user}@example.test','Checkout concurrency');
 insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_code,status,current_period_end)
 values('${user}','cus_${user}','sub_${user}','price_test','plus','active',now()+interval '7 days');`);
	const reserve = (plan) => `begin;set local role service_role;
 select public.reserve_subscription_checkout_v1('${user}','${plan}','price_${plan}','https://anidachi.test','${randomUUID()}','{}')->>'id';
 select pg_sleep(0.2);commit;`;
	const results = await Promise.all([
		sql(reserve("plus")),
		sql(reserve("pro")),
	]);
	const ids = results.map((r) => r.trim());
	assert.match(ids[0], /^[0-9a-f-]{36}$/);
	assert.equal(
		ids[0],
		ids[1],
		"Concurrent service-role transactions must share one reservation",
	);
	assert.equal(
		(
			await sql(
				`select count(*) from public.subscription_checkout_reservations where user_id='${user}';`,
			)
		).trim(),
		"1",
	);
	const finish = (state) =>
		`set role service_role;select public.complete_subscription_checkout_reservation_v1('${user}','${ids[0]}','cs_${user}','${state}',${state === "complete" ? "'sub_" + user + "'" : "null"});`;
	const race = await Promise.allSettled([
		sql(finish("complete")),
		sql(finish("expired")),
	]);
	assert.equal(
		race.filter((r) => r.status === "fulfilled").length,
		1,
		"One terminal outcome must win",
	);
	const loser = race.find((r) => r.status === "rejected");
	assert.match(loser.reason.message, /CHECKOUT_RESERVATION_TERMINAL/);
	const winner = (
		await sql(
			`select state from public.subscription_checkout_reservations where user_id='${user}';`,
		)
	).trim();
	assert.ok(["complete", "expired"].includes(winner));
	console.log(
		"PASS: concurrent reservations share one ID; complete/expire cannot both commit.",
	);
} finally {
	await sql(`delete from public.users where id='${user}';`);
}
