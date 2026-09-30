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
const offer = {
	ownerUserId: "owner",
	paidHostingActive: true,
	trialAvailable: true,
	action: "trial",
	validForMs: 60000,
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
	assert.equal(requests, 2);
	assert.doesNotMatch(el.textContent!, /30 min|4 people/);
});
async function mount(props: NonNullable<Parameters<typeof Pricing>[0]> = {}) {
	const el = document.createElement("div");
	document.body.append(el);
	root = createRoot(el);
	await act(async () =>
		root!.render(
			React.createElement<NonNullable<Parameters<typeof Pricing>[0]>>(Pricing, {
				annualPreview: false,
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
test("used trial and current subscribers get paid or management actions", async () => {
	for (const action of ["subscribe", "manage"]) {
		globalThis.fetch = async () =>
			Response.json({ ...offer, action, trialAvailable: false });
		const el = await mount();
		assert.doesNotMatch(el.textContent!, /Start 3-day free trial/);
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
	assert.doesNotMatch(el.textContent!, /Start 3-day free trial|30 min/);
	assert.ok([...el.querySelectorAll("button")].some((b) => b.disabled));
	assert.match(el.textContent!, /try again/i);
});

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
function plusButton(el: HTMLElement) {
	const button = [...el.querySelectorAll("button")].find((b) =>
		/Start 3-day free trial|Subscribe to Plus|Choose Plus/.test(
			b.textContent ?? "",
		),
	);
	assert.ok(button, "Plus purchase button must stay rendered");
	return button;
}

test("server-rendered pricing shows verified catalog prices before the account request", () => {
	const html = renderToStaticMarkup(
		React.createElement<NonNullable<Parameters<typeof Pricing>[0]>>(Pricing, {
			annualPreview: false,
			initialPrices: offer.prices,
		}),
	);
	assert.match(html, /\$7\.99/);
	assert.match(html, /\$14\.99/);
	assert.match(html, /Choose Plus/);
	assert.doesNotMatch(html, /Start 3-day free trial/);
	assert.doesNotMatch(html, /Yearly|Save 20%/);
});

test("the local yearly design is present in server HTML before account availability loads", () => {
	const html = renderToStaticMarkup(
		React.createElement<NonNullable<Parameters<typeof Pricing>[0]>>(Pricing, {
			annualPreview: true,
		}),
	);
	assert.match(html, /\$76\.70/);
	assert.match(html, /\$143\.90/);
	assert.match(html, /Yearly coming soon/);
	assert.doesNotMatch(html, /Start 3-day free trial/);
});

test("returning to the tab keeps prices visible while account availability is rechecked", async () => {
	const refresh = deferred<Response>();
	let reads = 0;
	globalThis.fetch = async () =>
		++reads === 1 ? Response.json(offer) : refresh.promise;
	const el = await mount();
	await act(async () => window.dispatchEvent(new Event("focus")));
	assert.match(el.textContent!, /\$7\.99/);
	assert.match(el.textContent!, /\$14\.99/);
	assert.ok(
		plusButton(el).disabled,
		"Old account eligibility must not remain actionable on focus",
	);
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
	assert.match(el.textContent!, /\$7\.99/);
	assert.doesNotMatch(el.textContent!, /Start 3-day free trial|30 min/);
	assert.ok(plusButton(el).disabled);
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
		unitAmount: 799,
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

test("local annual preview defaults to yearly, shows the full charge, and never starts monthly checkout", async () => {
	const urls: string[] = [];
	globalThis.fetch = async (url) => {
		urls.push(String(url));
		return Response.json(offer);
	};
	const el = await mount({
		annualPreview: true,
		initialPrices: offer.prices,
		showPlanMatrix: true,
	});
	assert.equal(periodButton(el, "Yearly").getAttribute("aria-pressed"), "true");
	assert.match(el.textContent!, /Save 20%/);
	assert.match(el.textContent!, /\$6\.39/);
	assert.match(el.textContent!, /\$11\.99/);
	assert.match(el.textContent!, /\$76\.70 \/ year/);
	assert.match(el.textContent!, /\$143\.90 \/ year/);
	assert.match(el.textContent!, /\$76\.70\/year \(preview\)/);
	assert.match(el.textContent!, /Yearly subscriptions are not available yet/);
	assert.doesNotMatch(el.textContent!, /Start 3-day free trial/);
	const buttons = [...el.querySelectorAll("button")].filter(
		(button) => button.textContent === "Yearly coming soon",
	);
	assert.equal(buttons.length, 2);
	await act(async () => {
		for (const button of buttons) {
			assert.ok(button.disabled);
			// Even a forced event on an enabled DOM element must not reach monthly checkout.
			button.disabled = false;
			button.click();
		}
	});
	assert.deepEqual(urls, ["/api/billing/offer"]);
});

test("local design amounts remain visible without granting trial or checkout during an outage", async () => {
	globalThis.fetch = async () =>
		Response.json({ error: "unavailable" }, { status: 503 });
	const el = await mount({ annualPreview: true });
	assert.match(el.textContent!, /\$76\.70/);
	await act(async () => periodButton(el, "Monthly").click());
	assert.match(el.textContent!, /\$7\.99/);
	assert.doesNotMatch(el.textContent!, /Start 3-day free trial/);
	assert.ok(plusButton(el).disabled);
});

test("switching to monthly uses verified prices and locks the period during checkout", async () => {
	const checkout = deferred<Response>();
	const requests: Record<string, unknown>[] = [];
	globalThis.fetch = async (url, init) => {
		if (String(url) === "/api/billing/offer") return Response.json(offer);
		requests.push(JSON.parse(String(init?.body)));
		return checkout.promise;
	};
	const el = await mount({ annualPreview: true });
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

test("monthly sign-in preserves the selected period on the pricing return", async () => {
	globalThis.fetch = async () =>
		Response.json({ ...offer, ownerUserId: null, action: "sign_in" });
	const el = await mount({ annualPreview: true });
	await act(async () => periodButton(el, "Monthly").click());
	const signIn = [...el.querySelectorAll("button")].find((button) =>
		button.textContent?.includes("Sign in to choose"),
	);
	assert.ok(signIn);
	await act(async () => signIn.click());
	const next = new URL(window.location.href).searchParams.get("next");
	assert.equal(next, "/pricing?plan=plus&billing=monthly");
	await act(async () => root?.unmount());
	root = null;
	dom.happyDOM.setURL(`http://localhost${next}`);
	const returned = await mount({ annualPreview: true });
	assert.equal(
		periodButton(returned, "Monthly").getAttribute("aria-pressed"),
		"true",
	);
});

test("an existing subscriber can still open account management from the annual preview", async () => {
	globalThis.fetch = async () => Response.json({ ...offer, action: "manage" });
	const el = await mount({ annualPreview: true });
	const manage = [...el.querySelectorAll("button")].find((button) =>
		button.textContent?.includes("Manage subscription"),
	);
	assert.ok(manage);
	await act(async () => manage.click());
	assert.equal(window.location.pathname, "/account/billing");
});
