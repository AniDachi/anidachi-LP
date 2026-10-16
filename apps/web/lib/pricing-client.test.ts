import { dom } from "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { Pricing } from "../components/pricing";
let root: Root | null = null;
const originalFetch = globalThis.fetch;
const yearlyPrices = {
	plus: { unitAmount: 7670, currency: "usd" },
	pro: { unitAmount: 14390, currency: "usd" },
};
const offer = {
	ownerUserId: "owner",
	paidHostingActive: true,
	trialAvailable: true,
	action: "trial",
	validForMs: 60000,
	yearlyPrices,
	prices: {
		plus: { unitAmount: 799, currency: "usd" },
		pro: { unitAmount: 1499, currency: "usd" },
	},
};
afterEach(async () => {
	await act(async () => root?.unmount());
	root = null;
	document.body.innerHTML = "";
	globalThis.fetch = originalFetch;
	dom.happyDOM.setURL("http://localhost/pricing");
});
test("an open pricing tab retires pre-cutover hosting at the server deadline", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
	let requests = 0;
	globalThis.fetch = async () =>
		Response.json({
			...offer,
			paidHostingActive: ++requests > 1,
			validForMs: 1000,
		});
	const el = await mount();
	assert.match(el.textContent!, /30 min/);
	await act(async () => t.mock.timers.tick(1000));
	assert.equal(requests, 1, "expiry retires display without polling");
	assert.doesNotMatch(el.textContent!, /30 min|4 people/);
});
async function mount(
	props: NonNullable<Parameters<typeof Pricing>[0]> = {},
	preflight?: (value: typeof offer) => Response | Promise<Response>,
) {
	const providedFetch = globalThis.fetch;
	let latestOffer = offer;
	globalThis.fetch = async (url, init) => {
		if (String(url) === "/api/billing/trial/context")
			return Response.json({
				state: "ready",
				ownerUserId: latestOffer.ownerUserId,
				challenge: "a".repeat(180) + "." + "b".repeat(43),
				extensionId: null,
			});
		if (String(url) === "/api/billing/trial/offer")
			return (
				preflight?.(latestOffer) ??
				Response.json({
					state: "ready",
					ownerUserId: latestOffer.ownerUserId,
					offer: latestOffer,
				})
			);
		const response = await providedFetch(url, init);
		if (String(url) === "/api/billing/offer" && response.ok)
			latestOffer = await response.clone().json();
		return response;
	};

	const el = document.createElement("div");
	document.body.append(el);
	root = createRoot(el);
	await act(async () =>
		root!.render(
			React.createElement<NonNullable<Parameters<typeof Pricing>[0]>>(Pricing, {
				...props,
			}),
		),
	);
	return el;
}
test("eligible Free sees card-required trial and cannot mistake Free for hosting", async () => {
	globalThis.fetch = async () => Response.json(offer);
	const el = await mount();
	assert.equal(
		[...el.querySelectorAll("button")].filter((b) =>
			b.textContent?.includes("Start 3-day free trial"),
		).length,
		2,
	);
	assert.match(el.textContent!, /Card required/);
	assert.doesNotMatch(el.textContent!, /30 min|4 people/);
});

test("cardless pricing explains no automatic payment and opens explicit trial confirmation", async () => {
	let posts = 0;
	globalThis.fetch = async (_url, init) => {
		if (init?.method === "POST") posts++;
		return Response.json({
			...offer,
			trialMode: "cardless",
			trialOfferRevision: "v1",
		});
	};
	const el = await mount();
	assert.match(el.textContent!, /No card required/i);
	assert.match(el.textContent!, /No automatic charge/i);
	assert.doesNotMatch(
		el.textContent!,
		/then .* automatically|Cancel before your trial ends/i,
	);
	await act(async () => plusButton(el).click());
	assert.equal(posts, 0);
	assert.equal(window.location.pathname, "/checkout");
	assert.equal(window.location.search, "?plan=plus&billing=yearly");
});

test("a signed-out cardless offer remains conditional on eligibility after login", async () => {
	globalThis.fetch = async () =>
		Response.json({
			...offer,
			ownerUserId: null,
			action: "sign_in",
			trialMode: "cardless",
		});
	const el = await mount();
	assert.doesNotMatch(
		el.textContent!,
		/No card required|Start 3-day free trial/i,
	);
	assert.doesNotMatch(el.textContent!, /automatically/);
	await act(async () => plusButton(el).click());
	assert.equal(window.location.pathname, "/login");
	assert.equal(
		new URLSearchParams(window.location.search).get("next"),
		"/checkout?plan=plus&billing=yearly",
	);
});
test("used trial and current subscribers get paid or management actions", async () => {
	for (const action of ["subscribe", "manage"]) {
		globalThis.fetch = async () =>
			Response.json({ ...offer, action, trialAvailable: false });
		const el = await mount();
		assert.doesNotMatch(
			el.textContent!,
			/Start 3-day free trial|Try 3 days free/,
		);
		assert.match(
			el.textContent!,
			action === "manage" ? /Manage subscription/ : /Subscribe to Plus/,
		);
		await act(async () => root?.unmount());
		root = null;
		el.remove();
	}
});
test("authority outage does not invent trial eligibility", async () => {
	globalThis.fetch = async () =>
		Response.json({ error: "unavailable" }, { status: 503 });
	const el = await mount();
	assert.doesNotMatch(
		el.textContent!,
		/Start 3-day free trial|Try 3 days free|30 min/,
	);
	assert.match(plusButton(el).textContent!, /Choose Plus/);
	assert.equal(plusButton(el).disabled, false);
	assert.equal(el.querySelector('[role="alert"]'), null);
});

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
function plusButton(el: HTMLElement) {
	const button = el.querySelector<HTMLButtonElement>(
		'[aria-labelledby="pricing-plus-title"] .pricing-plans__button',
	);
	assert.ok(button, "Plus purchase button must stay rendered");
	return button;
}

test("public monthly and annual plans render without any server catalog", async () => {
	const html = renderToStaticMarkup(React.createElement(Pricing));
	assert.match(html, /\$76\.70/);
	assert.match(html, /\$143\.90/);
	assert.match(html, /Yearly/);
	assert.match(html, /Choose Plus/);
	assert.doesNotMatch(
		html,
		/Try 3 days free|One trial per account|Card required/,
	);
	assert.match(html, /Renews at \$76\.70\/year/);
	globalThis.fetch = async () => Response.json({}, { status: 503 });
	const el = await mount();
	assert.equal(el.querySelector('[role="alert"]'), null);
	assert.equal(plusButton(el).disabled, false);
	await act(async () => periodButton(el, "Monthly").click());
	assert.match(el.textContent!, /\$7\.99/);
	assert.match(el.textContent!, /\$14\.99/);
	assert.match(el.textContent!, /Choose Plus/);
	assert.match(el.textContent!, /Renews at \$7\.99\/month/);
});

test("guest pricing advertises a trial only while the server offers it", async () => {
	for (const [paidHostingActive, trialAvailable, available] of [
		[false, false, false],
		[false, true, false],
		[true, false, false],
		[true, undefined, false],
		[true, true, true],
	] as const) {
		globalThis.fetch = async () =>
			Response.json({
				...offer,
				ownerUserId: null,
				action: "sign_in",
				paidHostingActive,
				trialAvailable,
			});
		const el = await mount();
		assert.match(
			plusButton(el).textContent!,
			available ? /Try 3 days free/ : /Choose Plus/,
		);
		assert.equal(!!el.querySelector("#pricing-trial-terms"), available);
		for (const id of plusButton(el)
			.getAttribute("aria-describedby")!
			.split(" ")) {
			assert.ok(el.querySelector(`#${id}`), `Missing terms element: ${id}`);
		}
		assert.match(el.textContent!, /\$76\.70/);
		assert.equal(plusButton(el).disabled, false);
		await act(async () => root?.unmount());
		root = null;
		el.remove();
	}
});

test("a public trial click cannot silently start a paid subscription for an ineligible account", async () => {
	const lookup = deferred<Response>();
	let checkouts = 0;
	const requests: Record<string, unknown>[] = [];
	globalThis.fetch = async (url, init) => {
		if (String(url) === "/api/billing/offer") return lookup.promise;
		checkouts++;
		requests.push(JSON.parse(String(init?.body)));
		return Response.json({
			url: "https://checkout.stripe.com/explicit-paid-choice",
		});
	};
	const el = await mount();
	assert.match(plusButton(el).textContent!, /Choose Plus/);
	await act(async () => plusButton(el).click());
	lookup.resolve(
		Response.json({ ...offer, action: "subscribe", trialAvailable: false }),
	);
	await act(async () => {});
	assert.equal(checkouts, 0);
	assert.match(
		el.textContent!,
		/A free trial is not available for this account/,
	);
	assert.match(plusButton(el).textContent!, /Subscribe to Plus/);
	assert.doesNotMatch(el.textContent!, /Try 3 days free/);
	await act(async () => plusButton(el).click());
	assert.equal(checkouts, 1);
	assert.equal(requests[0].expectedTrialOffered, false);
});

test("availability errors appear only after purchase intent and can be retried", async () => {
	let available = false;
	let checkouts = 0;
	globalThis.fetch = async (url) => {
		if (String(url) === "/api/billing/offer")
			return available
				? Response.json({ ...offer, yearlyPrices })
				: Response.json({}, { status: 503 });
		checkouts++;
		return Response.json({ url: "https://checkout.stripe.com/recovered" });
	};
	const el = await mount();
	assert.equal(el.querySelector('[role="alert"]'), null);
	await act(async () => plusButton(el).click());
	assert.equal(checkouts, 0);
	assert.match(
		el.querySelector('[role="alert"]')?.textContent ?? "",
		/Checkout is temporarily unavailable/,
	);
	assert.match(el.textContent!, /\$76\.70/);
	available = true;
	const retry = el.querySelector<HTMLButtonElement>('[role="alert"] button');
	assert.ok(retry);
	await act(async () => retry.click());
	assert.equal(checkouts, 1);
	assert.equal(window.location.href, "https://checkout.stripe.com/recovered");
});

test("a click during a slow account lookup keeps prices and shares one lookup", async () => {
	const lookup = deferred<Response>();
	const urls: string[] = [];
	globalThis.fetch = async (url) => {
		urls.push(String(url));
		return String(url) === "/api/billing/offer"
			? lookup.promise
			: Response.json({ url: "https://checkout.stripe.com/slow-lookup" });
	};
	const el = await mount();
	assert.match(el.textContent!, /\$76\.70/);
	assert.equal(plusButton(el).disabled, false);
	await act(async () => {
		plusButton(el).click();
		plusButton(el).click();
	});
	assert.deepEqual(urls, ["/api/billing/offer"]);
	assert.ok(plusButton(el).disabled);
	lookup.resolve(Response.json({ ...offer, yearlyPrices }));
	await act(async () => {});
	assert.deepEqual(urls, [
		"/api/billing/offer",
		"/api/create-checkout-session",
	]);
});

test("a remote price cannot replace or charge a different published amount", async () => {
	let checkouts = 0;
	globalThis.fetch = async (url) => {
		if (String(url) !== "/api/billing/offer") {
			checkouts++;
			throw Error("unexpected checkout");
		}
		return Response.json({
			...offer,
			yearlyPrices: {
				...yearlyPrices,
				plus: { unitAmount: 9999, currency: "usd" },
			},
		});
	};
	const el = await mount();
	assert.match(el.textContent!, /\$76\.70/);
	assert.doesNotMatch(el.textContent!, /\$99\.99/);
	assert.equal(el.querySelector('[role="alert"]'), null);
	await act(async () => plusButton(el).click());
	assert.equal(checkouts, 0);
	assert.match(
		el.textContent!,
		/Checkout for this price is temporarily unavailable/,
	);
});

test("an expired offer refresh cannot turn a trial click into a paid subscription", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
	const refresh = deferred<Response>();
	let reads = 0;
	let checkouts = 0;
	globalThis.fetch = async (url) => {
		if (String(url) === "/api/billing/offer")
			return ++reads === 1 ? Response.json(offer) : refresh.promise;
		checkouts++;
		throw Error("unexpected checkout");
	};
	const el = await mount();
	await act(async () => t.mock.timers.tick(60_000));
	assert.doesNotMatch(plusButton(el).textContent!, /Start 3-day free trial/);
	await act(async () => plusButton(el).click());
	refresh.resolve(Response.json({ ...offer, action: "subscribe" }));
	await act(async () => {});
	assert.equal(checkouts, 0);
	assert.match(el.textContent!, /Review the subscription terms/);
	assert.match(plusButton(el).textContent!, /Subscribe to Plus/);
});

test("server-rendered pricing shows published prices before the account request", () => {
	const html = renderToStaticMarkup(
		React.createElement<NonNullable<Parameters<typeof Pricing>[0]>>(
			Pricing,
			{},
		),
	);
	assert.match(html, /\$76\.70/);
	assert.match(html, /\$143\.90/);
	assert.match(html, /Choose Plus/);
	assert.doesNotMatch(html, /Start 3-day free trial|Try 3 days free/);
	assert.match(html, /Yearly|Save 20%/);
});

test("published yearly pricing is present in server HTML before account availability loads", () => {
	const html = renderToStaticMarkup(
		React.createElement<NonNullable<Parameters<typeof Pricing>[0]>>(
			Pricing,
			{},
		),
	);
	assert.match(html, /\$76\.70/);
	assert.match(html, /\$143\.90/);
	assert.match(html, /Choose Plus/);
	assert.doesNotMatch(html, /Start 3-day free trial|Try 3 days free/);
});

test("returning to the tab keeps prices visible while account availability is rechecked", async () => {
	const refresh = deferred<Response>();
	let reads = 0;
	globalThis.fetch = async () =>
		++reads === 1 ? Response.json(offer) : refresh.promise;
	const el = await mount();
	await act(async () => window.dispatchEvent(new Event("focus")));
	assert.match(el.textContent!, /\$76\.70/);
	assert.match(el.textContent!, /\$143\.90/);
	assert.doesNotMatch(plusButton(el).textContent!, /Start 3-day free trial/);
	assert.equal(plusButton(el).disabled, false);
	refresh.resolve(
		Response.json({ ...offer, ownerUserId: "other", action: "subscribe" }),
	);
	await act(async () => {});
	assert.match(plusButton(el).textContent!, /Subscribe to Plus/);
});

test("expired availability disables stale trial and hosting promises without erasing prices", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
	let reads = 0;
	globalThis.fetch = async () =>
		++reads === 1
			? Response.json({ ...offer, paidHostingActive: false, validForMs: 1000 })
			: new Promise<Response>(() => {});
	const el = await mount();
	assert.match(el.textContent!, /30 min/);
	await act(async () => t.mock.timers.tick(1000));
	assert.match(el.textContent!, /\$76\.70/);
	assert.doesNotMatch(el.textContent!, /Start 3-day free trial|30 min/);
	assert.equal(plusButton(el).disabled, false);
});

test("purchase immediately posts the displayed offer once without a second pricing request", async () => {
	const urls: string[] = [];
	const request: { body?: Record<string, unknown> } = {};
	const checkout = deferred<Response>();
	globalThis.fetch = async (url, init) => {
		urls.push(String(url));
		if (String(url) === "/api/billing/offer") return Response.json(offer);
		assert.equal(String(url), "/api/create-checkout-session");
		request.body = JSON.parse(String(init?.body));
		return checkout.promise;
	};
	const el = await mount();
	await act(async () => {
		plusButton(el).click();
		plusButton(el).click();
	});
	assert.deepEqual(urls, [
		"/api/billing/offer",
		"/api/create-checkout-session",
	]);
	assert.equal(request.body?.expectedOwnerUserId, "owner");
	assert.equal(request.body?.expectedTrialOffered, true);
	assert.deepEqual(request.body?.expectedPrice, {
		unitAmount: 7670,
		currency: "usd",
	});
	checkout.resolve(
		Response.json({
			url: "https://checkout.stripe.com/test-pricing",
			kind: "checkout",
		}),
	);
	await act(async () => {});
	assert.equal(
		window.location.href,
		"https://checkout.stripe.com/test-pricing",
	);
});

test("periodic offer expiry does not discard an in-flight checkout response", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
	const checkout = deferred<Response>();
	globalThis.fetch = async (url) =>
		String(url) === "/api/billing/offer"
			? Response.json({ ...offer, validForMs: 1000 })
			: checkout.promise;
	const el = await mount();
	await act(async () => plusButton(el).click());
	await act(async () => t.mock.timers.tick(1000));
	checkout.resolve(
		Response.json({
			url: "https://checkout.stripe.com/test-pricing",
			kind: "checkout",
		}),
	);
	await act(async () => {});
	assert.equal(
		window.location.href,
		"https://checkout.stripe.com/test-pricing",
	);
});

test("an account change while checkout is pending cannot redirect the replacement account", async () => {
	let reads = 0;
	const checkout = deferred<Response>();
	globalThis.fetch = async (url) =>
		String(url) === "/api/billing/offer"
			? Response.json({
					...offer,
					ownerUserId: ++reads === 1 ? "owner" : "other",
				})
			: checkout.promise;
	const el = await mount();
	await act(async () => plusButton(el).click());
	await act(async () => window.dispatchEvent(new Event("focus")));
	checkout.resolve(
		Response.json({
			url: "https://checkout.stripe.com/old-account",
			kind: "checkout",
		}),
	);
	await act(async () => {});
	assert.equal(window.location.origin, "http://localhost");
});

function periodButton(el: HTMLElement, period: "Monthly" | "Yearly") {
	const button = [
		...el.querySelectorAll<HTMLButtonElement>(
			'[aria-label="Billing period"] button',
		),
	].find((entry) => entry.textContent?.startsWith(period));
	assert.ok(button);
	return button;
}

test("annual checkout defaults to yearly and submits the verified full yearly amount", async () => {
	const requests: Record<string, unknown>[] = [];
	globalThis.fetch = async (url, init) => {
		if (String(url) === "/api/billing/offer")
			return Response.json({ ...offer, yearlyPrices });
		requests.push(JSON.parse(String(init?.body)));
		return Response.json({ url: "https://checkout.stripe.com/yearly" });
	};
	const el = await mount({
		showPlanMatrix: true,
	});
	assert.equal(periodButton(el, "Yearly").getAttribute("aria-pressed"), "true");
	assert.match(el.textContent!, /−20%/);
	assert.match(el.textContent!, /\$6\.39/);
	assert.match(el.textContent!, /\$11\.99/);
	assert.match(el.textContent!, /\$76\.70 \/ year/);
	assert.match(
		el.textContent!,
		/3 days free, then \$76\.70\/year automatically/,
	);
	assert.match(el.textContent!, /\$143\.90\/year/);
	assert.doesNotMatch(el.textContent!, /preview|coming soon/i);
	await act(async () => plusButton(el).click());
	assert.equal(requests.length, 1);
	assert.equal(requests[0].billingPeriod, "yearly");
	assert.deepEqual(requests[0].expectedPrice, yearlyPrices.plus);
	assert.equal(window.location.href, "https://checkout.stripe.com/yearly");
});

test("published amounts remain visible without granting trial during an outage", async () => {
	globalThis.fetch = async () =>
		Response.json({ error: "unavailable" }, { status: 503 });
	const el = await mount({});
	assert.match(el.textContent!, /\$76\.70/);
	await act(async () => periodButton(el, "Monthly").click());
	assert.match(el.textContent!, /\$7\.99/);
	assert.doesNotMatch(el.textContent!, /Start 3-day free trial/);
	assert.equal(plusButton(el).disabled, false);
});

test("switching to monthly uses verified prices and locks the period during checkout", async () => {
	const checkout = deferred<Response>();
	const requests: Record<string, unknown>[] = [];
	globalThis.fetch = async (url, init) => {
		if (String(url) === "/api/billing/offer")
			return Response.json({ ...offer, yearlyPrices });
		requests.push(JSON.parse(String(init?.body)));
		return checkout.promise;
	};
	const el = await mount({});
	await act(async () => periodButton(el, "Monthly").click());
	assert.match(el.textContent!, /Card required/);
	await act(async () => plusButton(el).click());
	assert.ok(periodButton(el, "Yearly").disabled);
	await act(async () => periodButton(el, "Yearly").click());
	assert.equal(
		periodButton(el, "Monthly").getAttribute("aria-pressed"),
		"true",
	);
	assert.equal(requests.length, 1);
	assert.deepEqual(requests[0].expectedPrice, offer.prices.plus);
	checkout.resolve(
		Response.json({ url: "https://checkout.stripe.com/monthly" }),
	);
	await act(async () => {});
	assert.equal(window.location.href, "https://checkout.stripe.com/monthly");
});

test("monthly sign-in carries the selected plan and period into checkout", async () => {
	globalThis.fetch = async () =>
		Response.json({
			...offer,
			yearlyPrices,
			ownerUserId: null,
			action: "sign_in",
		});
	const el = await mount({});
	await act(async () => periodButton(el, "Monthly").click());
	const signIn = plusButton(el);
	assert.match(signIn.textContent!, /Try 3 days free/);
	await act(async () => signIn.click());
	const next = new URL(window.location.href).searchParams.get("next");
	assert.equal(next, "/checkout?plan=plus&billing=monthly");
	assert.equal(new URL(window.location.href).pathname, "/login");
});

test("an existing subscriber can still open account management from yearly pricing", async () => {
	globalThis.fetch = async () =>
		Response.json({ ...offer, yearlyPrices, action: "manage" });
	const el = await mount({});
	const manage = [...el.querySelectorAll("button")].find((button) =>
		button.textContent?.includes("Manage subscription"),
	);
	assert.ok(manage);
	await act(async () => manage.click());
	assert.equal(window.location.pathname, "/account/billing");
	assert.equal(window.location.search, "?manage=1");
});

test("losing annual availability does not silently submit a monthly checkout", async () => {
	let reads = 0;
	let checkout = 0;
	globalThis.fetch = async (url) => {
		if (String(url) !== "/api/billing/offer") {
			checkout++;
			throw Error("unexpected checkout");
		}
		return Response.json({
			...offer,
			yearlyPrices: ++reads === 1 ? yearlyPrices : null,
		});
	};
	const el = await mount({});
	await act(async () => window.dispatchEvent(new Event("focus")));
	assert.equal(periodButton(el, "Yearly").getAttribute("aria-pressed"), "true");
	assert.equal(el.querySelector('[role="alert"]'), null);
	assert.match(el.textContent!, /\$76\.70/);
	const button = el.querySelector<HTMLButtonElement>(
		'[aria-labelledby="pricing-plus-title"] .pricing-plans__button',
	)!;
	assert.equal(button.disabled, false);
	await act(async () => button.click());
	assert.match(
		el.textContent!,
		/Checkout for this price is temporarily unavailable/,
	);
	assert.equal(checkout, 0);
});

test("a session that expires after choosing Pro still returns to monthly Pro checkout", async () => {
	globalThis.fetch = async (url) =>
		String(url) === "/api/billing/offer"
			? Response.json(offer)
			: Response.json({ loginUrl: "/login?next=%2F" }, { status: 401 });
	const el = await mount();
	await act(async () => periodButton(el, "Monthly").click());
	const pro = el.querySelector<HTMLButtonElement>(
		'[aria-describedby^="pricing-pro-terms"]',
	);
	assert.ok(pro);
	await act(async () => pro.click());
	assert.equal(
		new URL(window.location.href).searchParams.get("next"),
		"/checkout?plan=pro&billing=monthly",
	);
});

test("cardless pricing waits for browser verdict, then shows purchase without a failed free-trial click", async () => {
	const verdict = deferred<Response>();
	let mutations = 0;
	globalThis.fetch = async (url) => {
		if (String(url) !== "/api/billing/offer") mutations++;
		return Response.json({ ...offer, trialMode: "cardless" });
	};
	const el = await mount({}, () => verdict.promise);
	assert.doesNotMatch(el.textContent!, /Start 3-day free trial/);
	verdict.resolve(
		Response.json({
			state: "ready",
			ownerUserId: "owner",
			offer: {
				...offer,
				action: "subscribe",
				trialMode: "cardless",
				trialAvailable: false,
			},
		}),
	);
	await act(async () => {});
	assert.match(plusButton(el).textContent!, /Subscribe to Plus/);
	assert.equal(mutations, 0);
});
test("cardless pricing cannot turn a marker lookup outage into a paid offer", async () => {
	globalThis.fetch = async () =>
		Response.json({ ...offer, trialMode: "cardless" });
	const el = await mount({}, () =>
		Response.json(
			{ state: "unavailable", ownerUserId: "owner" },
			{ status: 503 },
		),
	);
	assert.doesNotMatch(
		plusButton(el).textContent!,
		/Start 3-day free trial|Subscribe to Plus/,
	);
	await act(async () => plusButton(el).click());
	assert.match(el.textContent!, /temporarily unavailable/);
});

test("a replaced account response cannot start a stale browser preflight", async () => {
	const old = deferred<Response>();
	let gets = 0;
	let preflights = 0;
	globalThis.fetch = async () =>
		++gets === 1
			? old.promise
			: Response.json({
					...offer,
					ownerUserId: "new-owner",
					action: "subscribe",
					trialAvailable: false,
					trialMode: "cardless",
				});
	const el = await mount({}, (value) => {
		preflights++;
		return Response.json({
			state: "ready",
			ownerUserId: value.ownerUserId,
			offer: value,
		});
	});
	await act(async () => window.dispatchEvent(new Event("focus")));
	await act(async () =>
		old.resolve(Response.json({ ...offer, trialMode: "cardless" })),
	);
	assert.equal(
		preflights,
		0,
		"retired account must not prepare or check browser markers",
	);
	assert.match(plusButton(el).textContent!, /Subscribe to Plus/);
});
