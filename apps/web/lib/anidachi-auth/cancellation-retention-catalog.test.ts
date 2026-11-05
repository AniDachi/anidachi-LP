import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { verifyCancellationCatalog } from "./cancellation-retention-catalog";

function fixture() {
	const monthly = ["price_plus_month", "price_pro_month"];
	const yearly = ["price_plus_year", "price_pro_year"];
	const prices = [...monthly, ...yearly].map((id, index) => ({
		id,
		object: "price",
		active: true,
		livemode: false,
		product: ["prod_plus", "prod_pro", "prod_plus_annual", "prod_pro_annual"][
			index
		],
		type: "recurring",
		currency: "usd",
		billing_scheme: "per_unit",
		unit_amount: [799, 1499, 7670, 14390][index],
		transform_quantity: null,
		recurring: {
			interval: index < 2 ? "month" : "year",
			interval_count: 1,
			usage_type: "licensed",
		},
	})) as Stripe.Price[];
	const byId = new Map(prices.map((price) => [price.id, price]));
	const inventories = new Map([
		["prod_plus", { data: [prices[0]], has_more: false }],
		["prod_pro", { data: [prices[1]], has_more: false }],
	]);
	const reads: string[] = [];
	const stripe = {
		prices: {
			retrieve: async (id: string) => {
				reads.push(id);
				const result = byId.get(id);
				if (!result) throw new Error("Unknown price");
				return result;
			},
			list: async (params: Stripe.PriceListParams) => {
				// A type/interval filter here would hide unsafe alternate prices.
				assert.deepEqual(params, {
					active: true,
					product: params.product,
					limit: 100,
				});
				reads.push(params.product!);
				return inventories.get(params.product!);
			},
		},
	} as unknown as Stripe;
	return { prices, inventories, stripe, reads };
}

async function configured(
	run: (f: ReturnType<typeof fixture>) => Promise<void>,
) {
	const settings = {
		VERCEL_ENV: "preview",
		STRIPE_PRICE_ID_PLUS_TEST: "price_plus_month",
		STRIPE_PRICE_ID_PRO_TEST: "price_pro_month",
		STRIPE_PRICE_ID_PLUS_YEARLY_TEST: "price_plus_year",
		STRIPE_PRICE_ID_PRO_YEARLY_TEST: "price_pro_year",
	};
	const saved = new Map(
		Object.keys(settings).map((key) => [key, process.env[key]]),
	);
	Object.assign(process.env, settings);
	try {
		await run(fixture());
	} finally {
		for (const [key, value] of saved) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
}

test("verified TEST catalog returns only distinct monthly coupon products and prices", async () => {
	await configured(async (f) => {
		assert.deepEqual(await verifyCancellationCatalog(f.stripe), {
			productIds: ["prod_plus", "prod_pro"],
			monthlyPriceIds: ["price_plus_month", "price_pro_month"],
		});
		assert.deepEqual(
			new Set(f.reads),
			new Set([
				"price_plus_month",
				"price_pro_month",
				"price_plus_year",
				"price_pro_year",
				"prod_plus",
				"prod_pro",
			]),
		);
	});
});

test("catalog rejects live mode before provider access", async () => {
	await configured(async (f) => {
		process.env.VERCEL_ENV = "production";
		await assert.rejects(() => verifyCancellationCatalog(f.stripe));
		assert.deepEqual(f.reads, []);
	});
});

test("catalog rejects missing or duplicate configured IDs", async () => {
	for (const value of ["", "price_plus_month"]) {
		await configured(async (f) => {
			process.env.STRIPE_PRICE_ID_PRO_YEARLY_TEST = value;
			await assert.rejects(() => verifyCancellationCatalog(f.stripe));
			assert.deepEqual(f.reads, []);
		});
	}
});

test("catalog rejects unsafe retrieved price shapes for either plan or period", async () => {
	const mutations: ((price: Stripe.Price) => void)[] = [
		(p) => {
			p.id = "price_unknown";
		},
		(p) => {
			p.active = false;
		},
		(p) => {
			p.livemode = true;
		},
		(p) => {
			p.currency = "eur";
		},
		(p) => {
			p.type = "one_time";
		},
		(p) => {
			p.recurring!.interval =
				p.recurring!.interval === "month" ? "year" : "month";
		},
		(p) => {
			p.recurring!.interval_count = 2;
		},
		(p) => {
			p.recurring!.usage_type = "metered";
		},
		(p) => {
			p.billing_scheme = "tiered";
		},
		(p) => {
			p.transform_quantity = { divide_by: 2, round: "up" };
		},
		(p) => {
			p.unit_amount = 0;
		},
		(p) => {
			p.unit_amount = 0.5;
		},
		(p) => {
			p.product = "";
		},
	];
	for (const index of [0, 1, 2, 3]) {
		for (const mutate of mutations) {
			await configured(async (f) => {
				mutate(f.prices[index]);
				await assert.rejects(() => verifyCancellationCatalog(f.stripe));
			});
		}
	}
});

test("catalog rejects shared monthly/annual products and ambiguous plan mapping", async () => {
	for (const [target, source] of [
		[1, 0],
		[2, 0],
		[2, 1],
		[3, 0],
		[3, 1],
		[3, 2],
	]) {
		await configured(async (f) => {
			f.prices[target].product = f.prices[source].product;
			await assert.rejects(() => verifyCancellationCatalog(f.stripe));
		});
	}
	await configured(async (f) => {
		const key = "STRIPE_PRICE_IDS_PLUS_YEARLY_LEGACY_TEST";
		const old = process.env[key];
		process.env[key] = "price_pro_year";
		try {
			await assert.rejects(() => verifyCancellationCatalog(f.stripe));
		} finally {
			if (old === undefined) delete process.env[key];
			else process.env[key] = old;
		}
	});
});

test("catalog fails closed on missing, ambiguous, paginated or alternate active prices", async () => {
	for (const product of ["prod_plus", "prod_pro"]) {
		for (const kind of [
			"missing",
			"empty",
			"duplicate",
			"paginated",
			"annual",
			"monthly",
			"one_time",
			"wrong_product",
			"inactive",
		]) {
			await configured(async (f) => {
				const inventory = f.inventories.get(product)!;
				const current = inventory.data[0];
				if (kind === "missing") f.inventories.delete(product);
				if (kind === "empty") inventory.data = [];
				if (kind === "duplicate") inventory.data.push(current);
				if (kind === "paginated") inventory.has_more = true;
				if (["annual", "monthly", "one_time"].includes(kind))
					inventory.data.push({
						...current,
						id: "price_alternate",
						type: kind === "one_time" ? "one_time" : "recurring",
						recurring: {
							...current.recurring!,
							interval: kind === "annual" ? "year" : "month",
						},
					});
				if (kind === "wrong_product")
					inventory.data = [{ ...current, product: "prod_other" }];
				if (kind === "inactive")
					inventory.data = [{ ...current, active: false }];
				await assert.rejects(
					() => verifyCancellationCatalog(f.stripe),
					`${product}: ${kind}`,
				);
			});
		}
	}
});
