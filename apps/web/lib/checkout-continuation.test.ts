import { dom } from "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CheckoutContinuation } from "../app/checkout/checkout-continuation";
import { checkoutSelectionFromPath } from "./checkout-selection";
import { getLoginContext } from "./login-context";

const offer = {
	ownerUserId: "owner-a",
	action: "trial",
	paidHostingActive: true,
	validForMs: 60000,
	prices: {
		plus: { unitAmount: 799, currency: "usd" },
		pro: { unitAmount: 1499, currency: "usd" },
	},
	yearlyPrices: {
		plus: { unitAmount: 7670, currency: "usd" },
		pro: { unitAmount: 14390, currency: "usd" },
	},
};
const originalFetch = globalThis.fetch;
let root: Root | null = null;
afterEach(async () => {
	await act(async () => root?.unmount());
	root = null;
	globalThis.fetch = originalFetch;
	document.body.innerHTML = "";
	dom.happyDOM.setURL("http://localhost/checkout?plan=plus&billing=yearly");
});
async function mount(
	plan: "plus" | "pro" = "plus",
	billing: "monthly" | "yearly" = "yearly",
	strict = false,
) {
	const el = document.createElement("div");
	document.body.append(el);
	root = createRoot(el);
	const child = React.createElement(CheckoutContinuation, {
		selection: { plan, billing },
	});
	await act(async () =>
		root!.render(
			strict ? React.createElement(React.StrictMode, null, child) : child,
		),
	);
	return el;
}
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((r) => {
		resolve = r;
	});
	return { resolve, promise };
}
function button(el: HTMLElement, label: RegExp) {
	const found = [...el.querySelectorAll("button")].find((x) =>
		label.test(x.textContent ?? ""),
	);
	assert.ok(found);
	return found;
}

test("the login context names the selected plan and billing period", () => {
	const context = getLoginContext("/checkout?plan=pro&billing=monthly");
	assert.match(context.headline, /Pro/);
	assert.match(context.subtitle, /monthly/i);
});

test("checkout selection rejects foreign, malformed and duplicate targets", () => {
	assert.deepEqual(
		checkoutSelectionFromPath("/checkout?plan=plus&billing=yearly"),
		{ plan: "plus", billing: "yearly" },
	);
	for (const path of [
		"https://evil.example/checkout?plan=plus&billing=yearly",
		"//evil.example/checkout?plan=plus&billing=yearly",
		"/checkout?plan=free&billing=yearly",
		"/checkout?plan=pro&billing=weekly",
		"/checkout?plan=plus&plan=pro&billing=yearly",
		"/checkout?plan=pro",
		"/pricing?plan=pro&billing=yearly",
	]) {
		assert.equal(checkoutSelectionFromPath(path), null, path);
	}
});

for (const [plan, billing, cents] of [
	["plus", "yearly", 7670],
	["pro", "monthly", 1499],
] as const) {
	test(`resumes ${plan} ${billing} exactly once, including StrictMode`, async () => {
		const bodies: Record<string, unknown>[] = [];
		globalThis.fetch = async (url, init) => {
			if (String(url) === "/api/billing/offer") return Response.json(offer);
			bodies.push(JSON.parse(String(init?.body)));
			return Response.json({
				kind: "checkout",
				url: "https://checkout.stripe.com/selected",
			});
		};
		await mount(plan, billing, true);
		assert.equal(bodies.length, 1);
		assert.equal(bodies[0].planCode, plan);
		assert.equal(bodies[0].billingPeriod, billing);
		assert.equal(bodies[0].expectedOwnerUserId, "owner-a");
		assert.equal(bodies[0].expectedTrialOffered, true);
		assert.deepEqual(bodies[0].expectedPrice, {
			unitAmount: cents,
			currency: "usd",
		});
		assert.equal(window.location.href, "https://checkout.stripe.com/selected");
	});
}

test("a used trial waits for an explicit paid confirmation", async () => {
	const requests: Record<string, unknown>[] = [];
	globalThis.fetch = async (url, init) => {
		if (String(url) === "/api/billing/offer")
			return Response.json({ ...offer, action: "subscribe" });
		requests.push(JSON.parse(String(init?.body)));
		return Response.json({ url: "https://checkout.stripe.com/paid" });
	};
	const el = await mount();
	assert.equal(requests.length, 0);
	assert.match(el.textContent!, /no free trial/i);
	assert.match(el.textContent!, /\$76\.70/);
	assert.match(el.textContent!, /billed now/i);
	await act(async () => button(el, /Subscribe to Plus/).click());
	assert.equal(requests.length, 1);
	assert.equal(requests[0].expectedTrialOffered, false);
});

test("a paid confirmation never carries over to a different account", async () => {
	let reads = 0,
		posts = 0;
	globalThis.fetch = async (url) => {
		if (String(url) === "/api/billing/offer")
			return Response.json({
				...offer,
				action: "subscribe",
				ownerUserId: ++reads === 1 ? "owner-a" : "owner-b",
			});
		posts++;
		return Response.json({ url: "https://checkout.stripe.com/wrong-owner" });
	};
	const el = await mount();
	await act(async () => button(el, /Subscribe to Plus/).click());
	assert.equal(posts, 0);
	assert.match(el.textContent!, /account.*changed/i);
});

test("an existing subscription goes to management without creating checkout", async () => {
	const urls: string[] = [];
	globalThis.fetch = async (url) => {
		urls.push(String(url));
		return Response.json({ ...offer, action: "manage" });
	};
	await mount();
	assert.deepEqual(urls, ["/api/billing/offer"]);
	assert.equal(new URL(window.location.href).pathname, "/account/billing");
});

test("session expiry at checkout keeps the selected plan for sign-in", async () => {
	globalThis.fetch = async (url) =>
		String(url) === "/api/billing/offer"
			? Response.json(offer)
			: Response.json({ loginUrl: "/login?next=%2F" }, { status: 401 });
	await mount("pro", "monthly");
	assert.equal(
		new URL(window.location.href).searchParams.get("next"),
		"/checkout?plan=pro&billing=monthly",
	);
});

test("unavailable or mismatched annual prices never fall back to a monthly charge", async () => {
	for (const yearlyPrices of [
		null,
		{ ...offer.yearlyPrices, plus: { unitAmount: 8000, currency: "usd" } },
	]) {
		let posts = 0;
		globalThis.fetch = async (url) => {
			if (String(url) === "/api/billing/offer")
				return Response.json({ ...offer, yearlyPrices });
			posts++;
			return Response.json({});
		};
		const el = await mount();
		assert.equal(posts, 0);
		assert.ok(el.querySelector('[role="alert"]'));
		await act(async () => root!.unmount());
		root = null;
	}
});

test("timeout retry reuses the request id and double clicks cannot duplicate checkout", async () => {
	const ids: unknown[] = [];
	const second = deferred<Response>();
	globalThis.fetch = async (url, init) => {
		if (String(url) === "/api/billing/offer") return Response.json(offer);
		ids.push(JSON.parse(String(init?.body)).requestId);
		if (ids.length === 1) throw new Error("timeout");
		return second.promise;
	};
	const el = await mount();
	const retry = button(el, /Try again/);
	await act(async () => {
		retry.click();
		retry.click();
	});
	assert.equal(ids.length, 2);
	assert.equal(ids[0], ids[1]);
	second.resolve(Response.json({ url: "https://checkout.stripe.com/reused" }));
	await act(async () => {});
	assert.equal(window.location.href, "https://checkout.stripe.com/reused");
});

test("returning from another tab retires an old checkout response", async () => {
	const response = deferred<Response>();
	globalThis.fetch = async (url) =>
		String(url) === "/api/billing/offer"
			? Response.json(offer)
			: response.promise;
	const el = await mount();
	await act(async () => {
		window.dispatchEvent(new Event("blur"));
		window.dispatchEvent(new Event("focus"));
	});
	response.resolve(Response.json({ url: "https://checkout.stripe.com/stale" }));
	await act(async () => {});
	assert.notEqual(window.location.href, "https://checkout.stripe.com/stale");
	assert.ok(el.querySelector('[role="alert"]'));
});

test("an offer that expires while loading cannot open checkout", async () => {
	let posts = 0;
	globalThis.fetch = async (url) => {
		if (String(url) === "/api/billing/offer")
			return Response.json({ ...offer, validForMs: 0 });
		posts++;
		return Response.json({});
	};
	const el = await mount();
	assert.equal(posts, 0);
	assert.match(el.textContent!, /expired/i);
});

test("if trial eligibility changes on the server, retry requires paid confirmation", async () => {
	let reads = 0,
		posts = 0;
	globalThis.fetch = async (url) => {
		if (String(url) === "/api/billing/offer")
			return Response.json({
				...offer,
				action: ++reads === 1 ? "trial" : "subscribe",
			});
		posts++;
		return Response.json(
			{ error: "Your available offer changed." },
			{ status: 409 },
		);
	};
	const el = await mount();
	assert.equal(posts, 1);
	await act(async () => button(el, /Try again/).click());
	assert.equal(posts, 1);
	assert.match(el.textContent!, /no free trial/i);
});

test("a failed offer read can retry without starting checkout prematurely", async () => {
	let available = false,
		posts = 0;
	globalThis.fetch = async (url) => {
		if (String(url) === "/api/billing/offer")
			return available
				? Response.json(offer)
				: Response.json({}, { status: 503 });
		posts++;
		return Response.json({ url: "https://checkout.stripe.com/recovered" });
	};
	const el = await mount();
	assert.equal(posts, 0);
	available = true;
	await act(async () => button(el, /Try again/).click());
	assert.equal(posts, 1);
	assert.equal(window.location.href, "https://checkout.stripe.com/recovered");
});

test("a backgrounded checkout cannot redirect before the user returns", async () => {
	const response = deferred<Response>();
	globalThis.fetch = async (url) =>
		String(url) === "/api/billing/offer"
			? Response.json(offer)
			: response.promise;
	await mount();
	await act(async () => window.dispatchEvent(new Event("blur")));
	response.resolve(
		Response.json({ url: "https://checkout.stripe.com/background-owner" }),
	);
	await act(async () => {});
	assert.notEqual(
		window.location.href,
		"https://checkout.stripe.com/background-owner",
	);
});

test("an invalid refresh session requests a real sign-in even if access JWT is still valid", async () => {
	globalThis.fetch = async () =>
		Response.json({ ...offer, ownerUserId: null, action: "sign_in" });
	await mount("pro", "yearly");
	const redirect = new URL(window.location.href);
	assert.equal(redirect.pathname, "/api/auth/refresh");
	assert.equal(
		redirect.searchParams.get("next"),
		"/checkout?plan=pro&billing=yearly",
	);
});

test("hiding a tab retires the checkout request even without a blur event", async () => {
	const response = deferred<Response>();
	globalThis.fetch = async (url) =>
		String(url) === "/api/billing/offer"
			? Response.json(offer)
			: response.promise;
	await mount();
	try {
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "hidden",
		});
		await act(async () =>
			document.dispatchEvent(new Event("visibilitychange")),
		);
		response.resolve(
			Response.json({ url: "https://checkout.stripe.com/hidden-owner" }),
		);
		await act(async () => {});
		assert.notEqual(
			window.location.href,
			"https://checkout.stripe.com/hidden-owner",
		);
	} finally {
		Reflect.deleteProperty(document, "visibilityState");
	}
});
