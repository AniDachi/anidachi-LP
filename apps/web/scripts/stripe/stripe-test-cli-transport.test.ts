import assert from "node:assert/strict";
import test from "node:test";
import {
	buildTestCliArguments,
	parseTestCliResponse,
} from "./stripe-test-cli-transport";

test("CLI transport always selects test profile and pinned API while preserving nested form fields", () => {
	const args = buildTestCliArguments(
		"anidachi-cardless-proof",
		"https://api.stripe.com/v1/subscriptions",
		{
			method: "POST",
			headers: {
				"Stripe-Version": "2025-08-27.basil",
				"Idempotency-Key": "proof:create",
				Authorization: "Bearer not-forwarded",
			},
			body: "customer=cus_synthetic&items%5B0%5D%5Bprice%5D=price_synthetic&cancel_at_period_end=true",
		},
	);
	assert.ok(args.includes("--live=false"));
	assert.equal(
		args[args.indexOf("--project-name") + 1],
		"anidachi-cardless-proof",
	);
	assert.equal(args[args.indexOf("--stripe-version") + 1], "2025-08-27.basil");
	assert.equal(args[args.indexOf("--idempotency") + 1], "proof:create");
	assert.ok(args.includes("items[0][price]=price_synthetic"));
	assert.ok(args.includes("cancel_at_period_end=true"));
	assert.equal(args.join(" ").includes("not-forwarded"), false);
});

test("transport refuses another host, unpinned requests and destructive methods", () => {
	for (const [url, init] of [
		[
			"https://example.com/v1/balance",
			{ method: "GET", headers: { "Stripe-Version": "2025-08-27.basil" } },
		],
		[
			"https://api.stripe.com/v1/balance",
			{ method: "GET", headers: { "Stripe-Version": "2026-09-30.preview" } },
		],
		[
			"https://api.stripe.com/v1/customers/cus_test",
			{ method: "DELETE", headers: { "Stripe-Version": "2025-08-27.basil" } },
		],
	] as const)
		assert.throws(() =>
			buildTestCliArguments("anidachi-cardless-proof", url, init),
		);
});

test("proof uses the response API header, never the CLI request header", async () => {
	const response = parseTestCliResponse(
		'{"livemode":false}',
		"> Stripe-Version: 2025-08-27.basil\n> Authorization: Bearer hidden\n< HTTP 200\n< Stripe-Version: 2025-08-27.basil\n< Request-Id: req_test\n",
	);
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("stripe-version"), "2025-08-27.basil");
	assert.equal(response.headers.has("authorization"), false);
	assert.deepEqual(await response.json(), { livemode: false });
	assert.throws(() =>
		parseTestCliResponse("{}", "> Stripe-Version: 2025-08-27.basil\n"),
	);
	assert.throws(() =>
		parseTestCliResponse(
			"{}",
			"> Stripe-Version: 2025-08-27.basil\n< HTTP 200\n",
		),
	);
});
