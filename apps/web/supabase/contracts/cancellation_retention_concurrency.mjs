// Synthetic contracts only, against the explicitly isolated local no-network DB.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
const container = "anidachi-cancel-retention-proof-20261105";
const info = JSON.parse(
	execFileSync("docker", ["inspect", container], { encoding: "utf8" }),
)[0];
assert.equal(info.HostConfig.NetworkMode, "none");
assert.equal(info.Config.Image, "public.ecr.aws/supabase/postgres:17.6.1.156");
const args = [
	"exec",
	"-i",
	container,
	"psql",
	"-XAt",
	"-U",
	"postgres",
	"-d",
	"cancellation_retention_final",
	"-v",
	"ON_ERROR_STOP=1",
];
const sql = (input) =>
	execFileSync("docker", args, { input, encoding: "utf8" }).trim();
const user = "20000000-0000-4000-8000-000000000001";
const native = `select reserve_cancellation_retention_v1('${user}','cus_native_race','sub_native_race','price_plus',array['prod_plus','prod_pro'],4102444800)`;
const first = `select claim_uninstall_first_v1('${user}','cus_native_race','coupon_first')`;
const renewal = `select reserve_uninstall_retention_v1('${user}','cus_native_race','sub_native_race','coupon_renewal',array['prod_plus','prod_pro'],'price_plus','plus',799,4102444800,'review')`;
const clean = () =>
	sql(
		`delete from cancellation_retention_offers where stripe_customer_id='cus_native_race'; delete from uninstall_first_bindings where stripe_customer_id='cus_native_race'; delete from uninstall_retention_claims where stripe_customer_id='cus_native_race'; delete from uninstall_offer_grants where stripe_customer_id='cus_native_race'; delete from subscriptions where stripe_customer_id='cus_native_race'; delete from billing_customers where stripe_customer_id='cus_native_race'; delete from users where id='${user}';`,
	);
function run(input, marker) {
	const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
	let out = "",
		err = "";
	let seen;
	const ready = new Promise((resolve) => {
		seen = resolve;
	});
	child.stdout.on("data", (b) => {
		out += b;
		if (marker && out.includes(marker)) seen();
	});
	child.stderr.on("data", (b) => {
		err += b;
	});
	child.stdin.end(input);
	const done = new Promise((resolve, reject) => {
		child.on("error", reject);
		child.on("close", (code) => {
			seen();
			resolve({ code, out, err });
		});
	});
	return { ready, done };
}
try {
	for (const [label, winner, loser, expected] of [
		["native vs first", native, first, "OFFER_CANCELLATION_PENDING"],
		["native vs renewal", native, renewal, "OFFER_CANCELLATION_PENDING"],
		["first vs native", first, native, "OFFER_LIFETIME_LIMIT"],
		["renewal vs native", renewal, native, "OFFER_LIFETIME_LIMIT"],
		["native duplicate retries", native, native, null],
	]) {
		clean();
		sql(
			`insert into users(id,email,display_name) values('${user}','native-race@example.test','Native race'); insert into billing_customers values('${user}','cus_native_race'); insert into subscriptions(user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_code,status,current_period_end) values('${user}','cus_native_race','sub_native_race','price_plus','plus','active',to_timestamp(4102444800));`,
		);
		const a = run(
			`begin; ${winner}; select 'LOCK_HELD'; select pg_sleep(0.5); commit;`,
			"LOCK_HELD",
		);
		await a.ready;
		const b = run(`${loser};`);
		const [left, right] = await Promise.all([a.done, b.done]);
		assert.equal(left.code, 0, left.err);
		if (expected) {
			assert.notEqual(right.code, 0);
			assert.ok(right.err.includes(expected), right.err);
		} else assert.equal(right.code, 0, right.err);
		assert.equal(
			sql(
				`select (select count(*) from uninstall_offer_grants where stripe_customer_id='cus_native_race')+(select count(*) from cancellation_retention_offers where stripe_customer_id='cus_native_race' and state='pending')`,
			),
			"1",
		);
		console.log(`PASS ${label}: exactly one allowance or pending hold`);
	}
} finally {
	clean();
}
