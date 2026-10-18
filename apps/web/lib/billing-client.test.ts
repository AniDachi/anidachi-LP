import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Window } from "happy-dom";
import * as React from "react";
import { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import {
	preloadAccountNavigation,
	clearAccountPreloads,
} from "./account-navigation-preload";
import { BillingClient } from "../app/account/billing/billing-client";
import {
	BILLING_OWNER_HEADER,
	formatBillingTime,
	type BillingOverview,
} from "./billing-view";

(globalThis as typeof globalThis & { React?: typeof React }).React = React;
(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const testWindow = new Window({
	url: "https://staging.anidachi.app/account/billing",
});
for (const [name, value] of Object.entries({
	window: testWindow,
	self: testWindow,
	document: testWindow.document,
	navigator: testWindow.navigator,
	HTMLElement: testWindow.HTMLElement,
	Node: testWindow.Node,
	Event: testWindow.Event,
})) {
	Object.defineProperty(globalThis, name, {
		configurable: true,
		value,
		writable: true,
	});
}
const originalFetch = globalThis.fetch;
let root: Root | null = null;
let container: HTMLDivElement;
const active: BillingOverview = {
	ownerUserId: "owner",
	planCode: "plus",
	serverTime: "2030-01-01T00:00:00Z",
	subscriptions: [
		{
			id: "local-sub",
			planCode: "plus",
			status: "active",
			currentPeriodEnd: "2030-02-01T12:00:00.000Z",
			cancelAtPeriodEnd: false,
			canCancel: true,
		},
	],
};
for (const stage of ["trial", "processing"] as const) {
	test(`a focused billing tab retires ${stage} claims at the server boundary`, async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
		let requests = 0;
		globalThis.fetch = async () =>
			Response.json(
				++requests === 1
					? {
							...active,
							selectedPlanExpiresAt: "2030-01-01T00:00:01Z",
							subscriptions: [
								{
									...active.subscriptions[0],
									canChangeTrialPlan: stage === "trial",
									trial: {
										stage,
										endsAt:
											stage === "trial"
												? "2030-01-01T00:00:01Z"
												: "2029-12-31T22:00:01Z",
										pendingUntil: "2030-01-01T00:00:01Z",
									},
								},
							],
						}
					: { ...active, planCode: "free", subscriptions: [] },
			);
		await mount();
		assert.match(
			container.textContent!,
			stage === "trial" ? /Free trial/ : /First payment processing/,
		);
		await act(async () => t.mock.timers.tick(1000));
		assert.equal(requests, 2);
		assert.doesNotMatch(
			container.textContent!,
			/Free trial|First payment processing|Switch to Pro/,
		);
	});
}
async function mount(
	returnedFromPortal = false,
	initial?: { overview: BillingOverview; remainingMs: number },
	trialSetupReturn?: { operationId: string; canceled: boolean },
	manageRequested = false,
) {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	await act(async () => {
		root?.render(
			React.createElement(BillingClient, {
				ownerUserId: "owner",
				returnedFromPortal,
				initial,
				trialSetupReturn,
				manageRequested,
			}),
		);
	});
}
afterEach(async () => {
	await act(async () => root?.unmount());
	root = null;
	document.body.innerHTML = "";
	globalThis.fetch = originalFetch;
	testWindow.happyDOM.setURL("https://staging.anidachi.app/account/billing");
});

const cardless: BillingOverview = {
	...active,
	subscriptions: [
		{
			...active.subscriptions[0],
			status: "trialing",
			cancelAtPeriodEnd: true,
			canCancel: false,
			price: { unitAmount: 799, currency: "usd", billingPeriod: "monthly" },
			trial: {
				mode: "cardless",
				stage: "trial",
				renewalState: "not_enabled",
				renewalEnabled: false,
				renewalQuoteId: "renewal-quote",
				endsAt: "2030-01-04T00:00:00Z",
				pendingUntil: "2030-01-04T02:00:00Z",
			},
		},
	],
};
function trialButton(label: RegExp) {
	const button = [...container.querySelectorAll("button")].find((b) =>
		label.test(b.textContent ?? ""),
	);
	assert.ok(button, `Missing ${label}`);
	return button;
}
const renewalQuote = {
	state: "quoted",
	ownerUserId: "owner",
	id: "renewal-quote",
	planCode: "plus",
	billingPeriod: "monthly",
	amount: 799,
	currency: "usd",
	firstChargeAt: "2030-01-04T00:00:00Z",
	expiresAt: "2030-01-01T00:05:00Z",
	termsRevision: "cardless-renewal-v1",
};

const renewalPreview = {
	state: "preview",
	ownerUserId: "owner",
	serverTime: cardless.serverTime,
	expiresAt: renewalQuote.expiresAt,
	firstChargeAt: renewalQuote.firstChargeAt,
	savedCard: null,
	options: [
		{
			planCode: "plus",
			billingPeriod: "monthly",
			amount: 799,
			currency: "usd",
		},
		{
			planCode: "plus",
			billingPeriod: "yearly",
			amount: 7670,
			currency: "usd",
		},
		{
			planCode: "pro",
			billingPeriod: "monthly",
			amount: 1499,
			currency: "usd",
		},
		{
			planCode: "pro",
			billingPeriod: "yearly",
			amount: 14390,
			currency: "usd",
		},
	],
};
test("renewal selection is immediate and never reserves a quote or enables renewal", async () => {
	const actions: string[] = [];
	globalThis.fetch = async (path) => {
		if (String(path).includes("/trial/renewal/")) {
			actions.push(String(path));
			return Response.json(renewalPreview);
		}
		return Response.json(cardless);
	};
	await mount(false, undefined, undefined, true);
	await selectProYearly();
	assertProYearlySelection();
	assert.deepEqual(actions, ["/api/billing/trial/renewal/preview"]);
	assert.match(container.textContent!, /143.90/);
	assert.equal(trialButton(/Add card.*enable renewal/i).disabled, false);
});

test("changed price requires another explicit confirmation before card setup", async () => {
	const actions: string[] = [];
	globalThis.fetch = async (path) => {
		const url = String(path);
		if (url.includes("/trial/renewal/")) actions.push(url);
		if (url.endsWith("/preview")) return Response.json(renewalPreview);
		if (url.endsWith("/quote"))
			return Response.json({ ...renewalQuote, amount: 899 });
		if (url.endsWith("/setup"))
			return Response.json({
				state: "setup",
				ownerUserId: "owner",
				url: "https://checkout.stripe.com/setup-card",
			});
		return Response.json(cardless);
	};
	await mount(false, undefined, undefined, true);
	await act(async () => trialButton(/Add card.*enable renewal/i).click());
	assert.deepEqual(actions, [
		"/api/billing/trial/renewal/preview",
		"/api/billing/trial/renewal/quote",
	]);
	assert.match(container.textContent!, /terms changed/);
	assert.match(container.textContent!, /8.99/);
	assert.equal(window.location.pathname, "/account/billing");
	await act(async () => trialButton(/Add card.*enable renewal/i).click());
	assert.equal(actions.at(-1), "/api/billing/trial/renewal/setup");
	assert.equal(window.location.href, "https://checkout.stripe.com/setup-card");
});

for (const newCard of [false, true])
	test(`explicit confirmation ${newCard ? "replaces" : "uses"} the saved card`, async () => {
		const setupBodies: Record<string, unknown>[] = [];
		globalThis.fetch = async (path, init) => {
			const url = String(path);
			if (url.endsWith("/preview"))
				return Response.json({
					...renewalPreview,
					savedCard: { sourceId: "saved-source", brand: "visa", last4: "4242" },
				});
			if (url.endsWith("/quote")) return Response.json(proYearlyQuote);
			if (url.endsWith("/setup")) {
				setupBodies.push(JSON.parse(String(init?.body)));
				return Response.json({ state: "active", ownerUserId: "owner" });
			}
			return Response.json(cardless);
		};
		await mount(false, undefined, undefined, true);
		await selectProYearly();
		assert.equal(setupBodies.length, 0);
		await act(async () =>
			trialButton(
				newCard ? /^Use a different card$/ : /^Enable renewal$/,
			).click(),
		);
		assert.equal(
			setupBodies[0]?.savedCardSourceId,
			newCard ? undefined : "saved-source",
		);
		assert.equal(setupBodies[0]?.quoteId, renewalQuote.id);
		assert.equal(window.location.pathname, "/account/billing");
	});

test("a confirmed renewal refreshes card provenance before another change", async () => {
	let source = "source-1",
		previews = 0;
	const used: string[] = [];
	globalThis.fetch = async (path, init) => {
		const url = String(path);
		if (url.endsWith("/preview")) {
			previews++;
			return Response.json({
				...renewalPreview,
				savedCard: { sourceId: source, brand: "visa", last4: "4242" },
			});
		}
		if (url.endsWith("/quote")) return Response.json(proYearlyQuote);
		if (url.endsWith("/setup")) {
			used.push(JSON.parse(String(init?.body)).savedCardSourceId);
			source = "source-2";
			return Response.json({ state: "active", ownerUserId: "owner" });
		}
		return Response.json({
			...cardless,
			subscriptions: [
				{
					...cardless.subscriptions[0],
					trial: {
						...cardless.subscriptions[0].trial!,
						renewalEnabled: true,
						renewalState: "enabled",
					},
				},
			],
		});
	};
	await mount(false, undefined, undefined, true);
	await selectProYearly();
	await act(async () => trialButton(/^Save changes$/).click());
	assert.equal(
		previews,
		2,
		"same-status refresh must invalidate the previous consent source",
	);
	await act(async () => trialButton(/^Save changes$/).click());
	assert.deepEqual(used, ["source-1", "source-2"]);
});

for (const outcome of [
	"same-owner",
	"replacement-owner",
	"refresh-failed",
] as const) {
	test(`renewal cancellation reconciles a deferred refresh safely: ${outcome}`, async () => {
		const enabled: BillingOverview = {
			...cardless,
			subscriptions: [
				{
					...cardless.subscriptions[0],
					trial: {
						...cardless.subscriptions[0].trial!,
						renewalState: "enabled",
						renewalEnabled: true,
					},
				},
			],
		};
		let resolveRefresh!: (response: Response) => void;
		let cancelPosts = 0;
		globalThis.fetch = async (path) => {
			if (String(path).endsWith("/renewal/cancel")) {
				cancelPosts++;
				return Response.json({ state: "canceled", ownerUserId: "owner" });
			}
			if (String(path).endsWith("/billing/refresh"))
				return new Promise<Response>((resolve) => {
					resolveRefresh = resolve;
				});
			if (String(path).endsWith("/billing/offer"))
				return Response.json({
					ownerUserId: outcome === "replacement-owner" ? "other" : "owner",
					action: "trial",
				});
			return Response.json(enabled);
		};
		await mount();
		await act(async () => trialButton(/^Cancel trial renewal$/).click());
		assert.equal(cancelPosts, 1);
		assert.ok(resolveRefresh);
		await act(async () => {
			window.dispatchEvent(new Event("blur"));
			window.dispatchEvent(new Event("focus"));
		});
		await act(async () =>
			resolveRefresh(
				outcome === "refresh-failed"
					? Response.json({ error: "Refresh unavailable" }, { status: 503 })
					: Response.json(cardless),
			),
		);
		assert.equal(cancelPosts, 1);
		assert.doesNotMatch(container.textContent!, /Renewal is enabled/);
		assert.ok(
			![...container.querySelectorAll("button")].some((button) =>
				/^Cancel trial renewal$/.test(button.textContent ?? ""),
			),
		);
		if (outcome === "same-owner") {
			assert.match(container.textContent!, /Renewal is off/);
			assert.ok(!container.querySelector('[role="alert"]'));
		} else {
			assert.doesNotMatch(
				container.textContent!,
				/Renewal is off\. Your remaining/,
			);
			assert.ok(container.querySelector('[role="alert"]'));
		}
	});
}

test("cardless billing reviews exact renewal terms before explicitly opening card setup", async () => {
	const actions: string[] = [];
	globalThis.fetch = async (path, init) => {
		if (String(path).includes("/trial/renewal/")) {
			actions.push(String(path));
			assert.equal(
				new Headers(init?.headers).get(BILLING_OWNER_HEADER),
				"owner",
			);
			if (String(path).endsWith("/quote")) return Response.json(renewalQuote);
			return Response.json({
				state: "setup",
				ownerUserId: "owner",
				url: "https://checkout.stripe.com/setup-card",
			});
		}
		return Response.json(cardless);
	};
	await mount();
	assert.match(container.textContent!, /Free trial/);
	assert.match(container.textContent!, /No automatic charge/i);
	assert.doesNotMatch(
		container.textContent!,
		/Renewal canceled|Renews automatically after your trial/,
	);
	await act(async () => trialButton(/^Review renewal$/).click());
	assert.deepEqual(actions, ["/api/billing/trial/renewal/quote"]);
	assert.match(container.textContent!, /\$7.99\s*\/\s*month/);
	assert.match(container.textContent!, /First payment/);
	assert.match(container.textContent!, /No payment today/);
	await act(async () => trialButton(/Add card.*enable renewal/i).click());
	assert.equal(actions.length, 2);
	assert.equal(window.location.href, "https://checkout.stripe.com/setup-card");
});

async function selectProYearly() {
	await act(async () => {
		const plan = container.querySelector<HTMLInputElement>(
			'[aria-label="Renewal plan"] input[value="pro"]',
		)!;
		plan.click();
	});
	await act(async () => {
		const period = container.querySelector<HTMLInputElement>(
			'[aria-label="Renewal billing period"] input[value="yearly"]',
		)!;
		period.click();
	});
}
function assertProYearlySelection() {
	assert.equal(
		container.querySelector<HTMLInputElement>(
			'[aria-label="Renewal plan"] input:checked',
		)?.value,
		"pro",
	);
	assert.equal(
		container.querySelector<HTMLInputElement>(
			'[aria-label="Renewal billing period"] input:checked',
		)?.value,
		"yearly",
	);
}
const proYearlyQuote = {
	...renewalQuote,
	planCode: "pro",
	billingPeriod: "yearly",
	amount: 14390,
};

for (const trigger of ["timer", "tab", "refresh"] as const) {
	test(
		"renewal draft and reviewed terms survive same-account " +
			trigger +
			" refresh",
		async (t) => {
			t.mock.timers.enable({
				apis: ["setTimeout", "Date"],
				now: Date.parse(cardless.serverTime!),
			});
			let finishRead: ((response: Response) => void) | undefined;
			globalThis.fetch = async (path, init) => {
				if (String(path).endsWith("/quote")) {
					assert.deepEqual(JSON.parse(String(init?.body)), {
						planCode: "pro",
						billingPeriod: "yearly",
					});
					return Response.json(proYearlyQuote);
				}
				return new Promise((resolve) => {
					finishRead = resolve;
				});
			};
			await mount(false, { overview: cardless, remainingMs: 60_000 });
			await selectProYearly();
			await act(async () => trialButton(/^Review renewal$/).click());
			assert.match(
				container.querySelector('[aria-label="Review renewal terms"]')
					?.textContent ?? "",
				/143\.90\s*\/\s*year/,
			);
			await act(async () => {
				if (trigger === "timer") t.mock.timers.tick(60_000);
				else if (trigger === "tab") {
					window.dispatchEvent(new Event("blur"));
					window.dispatchEvent(new Event("focus"));
				} else trialButton(/^Refresh status$/).click();
			});
			assert.ok(container.querySelector('[aria-label="Review renewal terms"]'));
			assert.ok(finishRead);
			await act(async () =>
				finishRead!(
					Response.json({ ...cardless, serverTime: "2030-01-01T00:01:00Z" }),
				),
			);
			assertProYearlySelection();
			assert.match(
				container.querySelector('[aria-label="Review renewal terms"]')
					?.textContent ?? "",
				/143\.90\s*\/\s*year/,
			);
		},
	);
}

for (const action of ["quote", "setup"] as const) {
	test(
		"billing display expiry does not discard an in-flight renewal " + action,
		async (t) => {
			t.mock.timers.enable({
				apis: ["setTimeout", "Date"],
				now: Date.parse(cardless.serverTime!),
			});
			let finishAction!: (response: Response) => void;
			let reads = 0;
			globalThis.fetch = async (path) => {
				if (String(path).endsWith("/" + action))
					return new Promise((resolve) => {
						finishAction = resolve;
					});
				if (String(path).endsWith("/quote"))
					return Response.json(proYearlyQuote);
				reads++;
				return Response.json({
					...cardless,
					serverTime: "2030-01-01T00:01:00Z",
				});
			};
			await mount(false, { overview: cardless, remainingMs: 60_000 });
			await selectProYearly();
			await act(async () => trialButton(/^Review renewal$/).click());
			if (action === "setup")
				await act(async () => trialButton(/Add card.*enable renewal/i).click());
			await act(async () => t.mock.timers.tick(60_000));
			assert.match(container.textContent!, /Free trial/i);
			assert.ok(
				trialButton(
					action === "setup" ? /Add card.*enable renewal/i : /^Review renewal$/,
				).disabled,
			);
			assert.equal(
				reads,
				0,
				"expiry must retire claims without interrupting the user's request",
			);
			await act(async () =>
				finishAction(
					Response.json(
						action === "quote"
							? proYearlyQuote
							: {
									state: "setup",
									ownerUserId: "owner",
									url: "https://checkout.stripe.com/setup-card",
								},
					),
				),
			);
			if (action === "setup")
				assert.equal(
					window.location.href,
					"https://checkout.stripe.com/setup-card",
				);
			else {
				assertProYearlySelection();
				assert.match(
					container.querySelector('[aria-label="Review renewal terms"]')
						?.textContent ?? "",
					/143\.90\s*\/\s*year/,
				);
			}
		},
	);
}

for (const reason of [
	"quote expired",
	"renewal changed",
	"different subscription",
	"trial ended",
] as const) {
	test("refresh discards reviewed renewal terms when " + reason, async () => {
		let refreshed = cardless;
		globalThis.fetch = async (path) =>
			Response.json(
				String(path).endsWith("/quote") ? proYearlyQuote : refreshed,
			);
		await mount();
		await selectProYearly();
		await act(async () => trialButton(/^Review renewal$/).click());
		refreshed = {
			...cardless,
			serverTime:
				reason === "quote expired"
					? "2030-01-01T00:06:00Z"
					: reason === "trial ended"
						? "2030-01-05T00:00:00Z"
						: cardless.serverTime,
			subscriptions: [
				{
					...cardless.subscriptions[0],
					id:
						reason === "different subscription"
							? "replacement-sub"
							: "local-sub",
					trial: {
						...cardless.subscriptions[0].trial!,
						stage: reason === "trial ended" ? "ended" : "trial",
						renewalEnabled: reason === "renewal changed",
						renewalState:
							reason === "renewal changed" ? "enabled" : "not_enabled",
					},
				},
			],
		};
		await act(async () => window.dispatchEvent(new Event("focus")));
		assert.equal(
			container.querySelector('[aria-label="Review renewal terms"]'),
			null,
		);
		if (reason === "quote expired") assertProYearlySelection();
		if (reason === "different subscription")
			assert.equal(
				container.querySelector<HTMLInputElement>(
					'[aria-label="Renewal plan"] input:checked',
				)?.value,
				"plus",
			);
	});
}

for (const trigger of ["focus", "refresh"] as const) {
	test(
		"restored renewal terms expire at their own boundary after " + trigger,
		async (t) => {
			t.mock.timers.enable({
				apis: ["setTimeout", "Date"],
				now: Date.parse(cardless.serverTime!),
			});
			globalThis.fetch = async (path) =>
				Response.json(
					String(path).endsWith("/quote")
						? proYearlyQuote
						: { ...cardless, serverTime: new Date().toISOString() },
				);
			await mount();
			await selectProYearly();
			await act(async () => trialButton(/^Review renewal$/).click());
			await act(async () => window.dispatchEvent(new Event("blur")));
			await act(async () => t.mock.timers.tick(290_000));
			await act(async () => window.dispatchEvent(new Event("focus")));
			if (trigger === "refresh")
				await act(async () => trialButton(/^Refresh status$/).click());
			assert.ok(container.querySelector('[aria-label="Review renewal terms"]'));
			await act(async () => t.mock.timers.tick(10_001));
			assert.ok(
				!container.querySelector('[aria-label="Review renewal terms"]'),
			);
			assertProYearlySelection();
			assert.ok(trialButton(/^Review renewal$/));
		},
	);
}

for (const latestId of ["another-tabs-quote", undefined]) {
	test(
		"a refreshed overview retires a quote that is no longer the current generation: " +
			latestId,
		async () => {
			let latest = "renewal-quote" as string | undefined;
			globalThis.fetch = async (path) =>
				Response.json(
					String(path).endsWith("/quote")
						? proYearlyQuote
						: {
								...cardless,
								subscriptions: [
									{
										...cardless.subscriptions[0],
										trial: {
											...cardless.subscriptions[0].trial!,
											renewalQuoteId: latest,
										},
									},
								],
							},
				);
			await mount();
			await selectProYearly();
			await act(async () => trialButton(/^Review renewal$/).click());
			assert.ok(container.querySelector('[aria-label="Review renewal terms"]'));
			await act(async () => window.dispatchEvent(new Event("blur")));
			latest = latestId;
			await act(async () => window.dispatchEvent(new Event("focus")));
			assert.ok(
				!container.querySelector('[aria-label="Review renewal terms"]'),
			);
			assertProYearlySelection();
		},
	);
}

test("quote expiry does not abort an already dispatched card setup", async (t) => {
	t.mock.timers.enable({
		apis: ["setTimeout", "Date"],
		now: Date.parse(cardless.serverTime!),
	});
	let finishSetup!: (response: Response) => void;
	let setupSignal: AbortSignal | null | undefined;
	globalThis.fetch = async (path, init) => {
		if (String(path).endsWith("/quote")) return Response.json(proYearlyQuote);
		if (String(path).endsWith("/setup")) {
			setupSignal = init?.signal;
			return new Promise((resolve) => {
				finishSetup = resolve;
			});
		}
		return Response.json({ ...cardless, serverTime: new Date().toISOString() });
	};
	await mount();
	await selectProYearly();
	await act(async () => trialButton(/^Review renewal$/).click());
	await act(async () => window.dispatchEvent(new Event("blur")));
	await act(async () => t.mock.timers.tick(290_000));
	await act(async () => window.dispatchEvent(new Event("focus")));
	await act(async () => trialButton(/Add card.*enable renewal/i).click());
	await act(async () => t.mock.timers.tick(10_001));
	assert.ok(!container.querySelector('[aria-label="Review renewal terms"]'));
	assert.equal(setupSignal?.aborted, false);
	await act(async () =>
		finishSetup(
			Response.json({
				state: "setup",
				ownerUserId: "owner",
				url: "https://checkout.stripe.com/setup-card",
			}),
		),
	);
	assert.equal(window.location.href, "https://checkout.stripe.com/setup-card");
});

test("an account mismatch clears the renewal draft before any later same-owner recovery", async () => {
	let readOwner = "owner";
	globalThis.fetch = async (path) =>
		Response.json(
			String(path).endsWith("/quote")
				? proYearlyQuote
				: { ...cardless, ownerUserId: readOwner },
		);
	await mount();
	await selectProYearly();
	await act(async () => trialButton(/^Review renewal$/).click());
	readOwner = "foreign";
	await act(async () => window.dispatchEvent(new Event("focus")));
	assert.equal(container.querySelector('[aria-label="Renewal plan"]'), null);
	readOwner = "owner";
	await act(async () => window.dispatchEvent(new Event("focus")));
	assert.equal(
		container.querySelector<HTMLInputElement>(
			'[aria-label="Renewal plan"] input:checked',
		)?.value,
		"plus",
	);
	assert.equal(
		container.querySelector('[aria-label="Review renewal terms"]'),
		null,
	);
});

test("a card setup return after expiry offers an explicit paid path without opening checkout", async () => {
	const paths: string[] = [];
	const ended: BillingOverview = {
		...cardless,
		planCode: "free",
		serverTime: "2030-01-05T00:00:00Z",
		subscriptions: [
			{
				...cardless.subscriptions[0],
				status: "canceled",
				trial: { ...cardless.subscriptions[0].trial!, stage: "ended" },
			},
		],
	};
	globalThis.fetch = async (path) => {
		paths.push(String(path));
		return String(path).endsWith("/complete")
			? Response.json(
					{ ownerUserId: "owner", state: "expired" },
					{ status: 409 },
				)
			: Response.json(ended);
	};
	await mount(false, undefined, {
		operationId: "expired-setup",
		canceled: false,
	});
	assert.ok(paths.includes("/api/billing/trial/renewal/complete"));
	assert.ok(paths.includes("/api/billing/refresh"));
	assert.ok(!paths.includes("/api/create-checkout-session"));
	assert.ok(
		[...container.querySelectorAll("a")].some(
			(a) =>
				/Choose a plan/.test(a.textContent ?? "") &&
				a.getAttribute("href") === "/pricing",
		),
	);
	assert.equal(window.location.pathname, "/account/billing");
});

test("foreign renewal quote and a late setup URL are retired before they can redirect", async () => {
	let responseOwner = "foreign";
	let resolveSetup!: (response: Response) => void;
	globalThis.fetch = async (path) => {
		if (String(path).endsWith("/quote"))
			return Response.json({ ...renewalQuote, ownerUserId: responseOwner });
		if (String(path).endsWith("/setup"))
			return new Promise((resolve) => {
				resolveSetup = resolve;
			});
		return Response.json(cardless);
	};
	await mount();
	await act(async () => trialButton(/^Review renewal$/).click());
	assert.match(container.textContent!, /account changed/i);
	assert.ok(
		![...container.querySelectorAll("button")].some((b) =>
			/Add card.*enable renewal/i.test(b.textContent ?? ""),
		),
	);
	responseOwner = "owner";
	await act(async () => trialButton(/^Review renewal$/).click());
	await act(async () => trialButton(/Add card.*enable renewal/i).click());
	await act(async () => window.dispatchEvent(new Event("blur")));
	const previousFetch = globalThis.fetch;
	globalThis.fetch = async (path, init) =>
		String(path) === "/api/billing/offer"
			? Response.json({ ownerUserId: "replacement", action: "subscribe" })
			: previousFetch(path, init);
	await act(async () =>
		resolveSetup(
			Response.json({
				state: "setup",
				ownerUserId: "owner",
				url: "https://checkout.stripe.com/stale",
			}),
		),
	);
	assert.equal(window.location.pathname, "/account/billing");
});

test("a pending cancellation never claims that an already enabled renewal is off", async () => {
	globalThis.fetch = async () =>
		Response.json({
			...cardless,
			subscriptions: [
				{
					...cardless.subscriptions[0],
					trial: {
						...cardless.subscriptions[0].trial,
						renewalState: "pending",
						renewalEnabled: true,
						pendingRenewal: { id: "pending-cancel", action: "cancel" },
					},
				},
			],
		});
	await mount();
	assert.match(
		container.textContent!,
		/Renewal remains enabled until cancellation is confirmed/i,
	);
	assert.doesNotMatch(container.textContent!, /No automatic charge/i);
	const card = container.querySelector(".billing-summary-card")!;
	assert.match(card.textContent!, /Renewal pending|View renewal status/);
	assert.doesNotMatch(card.textContent!, /View plans|Choose a plan/);
});

test("an unresolved renewal remains recoverable after trial expiry instead of offering another purchase", async () => {
	globalThis.fetch = async () =>
		Response.json({
			...cardless,
			planCode: "free",
			serverTime: "2030-01-05T00:00:00Z",
			subscriptions: [
				{
					...cardless.subscriptions[0],
					status: "canceled",
					trial: {
						...cardless.subscriptions[0].trial,
						stage: "ended",
						renewalState: "pending",
						pendingRenewal: { id: "unknown-outcome", action: "enable" },
					},
				},
			],
		});
	await mount();
	assert.ok(trialButton(/Check renewal status/));
	assert.ok(
		![...container.querySelectorAll("a")].some((a) =>
			/Continue with Plus/.test(a.textContent ?? ""),
		),
	);
	assert.ok(
		![...container.querySelectorAll("button")].some((b) =>
			/Resume card setup|Review renewal/.test(b.textContent ?? ""),
		),
	);
});

test("trial shows original deadline and reviewed plan change before confirming", async () => {
	const actions: string[] = [];
	globalThis.fetch = async (path, init) => {
		if (String(path).endsWith("trial-plan")) {
			const body = JSON.parse(String(init?.body));
			actions.push(body.action);
			assert.equal(
				new Headers(init?.headers).get(BILLING_OWNER_HEADER),
				"owner",
			);
			if (body.action === "quote")
				return Response.json({
					ownerUserId: "owner",
					quote: {
						planCode: "pro",
						currentPlanCode: "plus",
						unitAmount: 1499,
						currency: "usd",
						trialEndsAt: "2030-02-01T12:00:00.000Z",
						renewalCanceled: true,
					},
				});
			return Response.json({ ownerUserId: "owner", planCode: "pro" });
		}
		return Response.json({
			...active,
			subscriptions: [
				{
					...active.subscriptions[0],
					status: "trialing",
					cancelAtPeriodEnd: true,
					canCancel: false,
					canChangeTrialPlan: true,
					monthlyPrice: { unitAmount: 799, currency: "usd" },
					trial: {
						endsAt: "2030-02-01T12:00:00.000Z",
						stage: "trial",
						pendingUntil: "2030-02-01T14:00:00.000Z",
					},
				},
			],
		});
	};
	await mount();
	const change = [...container.querySelectorAll("button")].find((b) =>
		b.textContent?.includes("Switch to Pro"),
	);
	assert.ok(change);
	await act(async () => change.click());
	assert.deepEqual(actions, ["quote"]);
	assert.match(container.textContent!, /14.99/);
	assert.match(container.textContent!, /renewal stays canceled/i);
	const confirm = [...container.querySelectorAll("button")].find((b) =>
		b.textContent?.includes("Confirm plan change"),
	);
	assert.ok(confirm);
	await act(async () => confirm.click());
	assert.deepEqual(actions, ["quote", "confirm"]);
});
test("post-cutover Free and pending payment do not advertise free hosting or paid success", async () => {
	globalThis.fetch = async () =>
		Response.json({
			...active,
			planCode: "free",
			serverTime: "2030-02-01T13:00:00Z",
			hosting: {
				hostingActivationAt: "2029-01-01T00:00:00Z",
				trialEligibility: "used",
			},
			subscriptions: [
				{
					...active.subscriptions[0],
					trial: {
						stage: "processing",
						endsAt: "2030-02-01T12:00:00Z",
						pendingUntil: "2030-02-01T14:00:00Z",
					},
				},
			],
		});
	await mount();
	assert.doesNotMatch(container.textContent!, /30 minutes|4 people/);
	assert.match(container.textContent!, /First payment processing/);
});

test("active subscription shows renewal date and explicit cancellation with owner-bound request", async () => {
	const requests: { path: string; init?: RequestInit }[] = [];
	globalThis.fetch = async (path, init) => {
		requests.push({ path: String(path), init });
		if (String(path).endsWith("cancellation-portal"))
			return Response.json(
				{ error: "Subscription cancellation is temporarily unavailable." },
				{ status: 503 },
			);
		return Response.json(active);
	};
	await mount();
	assert.match(container.textContent ?? "", /Plus subscription/);
	assert.equal(container.querySelector("dt")?.textContent, "Renews");
	assert.equal(container.querySelector("dd")?.textContent, "February 1, 2030");
	const button = [...container.querySelectorAll("button")].find((item) =>
		item.textContent?.includes("Cancel renewal"),
	);
	assert.ok(button);
	await act(async () => button.click());
	assert.equal(requests[1]?.path, "/api/billing/cancellation-portal");
	assert.equal(
		new Headers(requests[1]?.init?.headers).get(BILLING_OWNER_HEADER),
		"owner",
	);
	assert.equal(
		requests[1]?.init?.body,
		JSON.stringify({ subscriptionId: "local-sub" }),
	);
	assert.match(
		container.querySelector('[role="alert"]')?.textContent ?? "",
		/temporarily unavailable/,
	);
	assert.equal(button.disabled, false);
});

test("return from Stripe refreshes status and shows scheduled end without another cancellation button", async () => {
	let path: string | undefined;
	let method: string | undefined;
	globalThis.fetch = async (input, init) => {
		path = String(input);
		method = init?.method;
		return Response.json({
			...active,
			subscriptions: [
				{
					...active.subscriptions[0],
					cancelAtPeriodEnd: true,
					canCancel: false,
				},
			],
		});
	};
	await mount(true);
	assert.equal(path, "/api/billing/refresh");
	assert.equal(method, "POST");
	assert.match(container.textContent ?? "", /Renewal off/);
	assert.equal(container.querySelector("dt")?.textContent, "Subscription ends");
	assert.equal(container.querySelector("dd")?.textContent, "February 1, 2030");
	assert.doesNotMatch(container.textContent ?? "", /Cancel renewal/);
});

test("Free account without billing has no cancellation action", async () => {
	globalThis.fetch = async () =>
		Response.json({
			ownerUserId: "owner",
			planCode: "free",
			serverTime: "2030-01-01T00:00:00Z",
			hosting: { hostingActivationAt: null },
			subscriptions: [],
		});
	await mount();
	assert.match(container.textContent ?? "", /30 minutes a day/);
	assert.match(container.textContent ?? "", /Up to 4 people/);
	assert.equal(
		container.querySelector('a[href="/extension#using"]')?.textContent?.trim(),
		"How to watch",
	);
	assert.equal(
		container.querySelector('a[href="/pricing"]')?.textContent?.trim(),
		"View plans",
	);
	assert.doesNotMatch(container.textContent ?? "", /Cancel renewal/);
});

test("Free account with a canceled subscription still shows host limits", async () => {
	globalThis.fetch = async () =>
		Response.json({
			ownerUserId: "owner",
			planCode: "free",
			serverTime: "2030-01-01T00:00:00Z",
			hosting: { hostingActivationAt: null },
			subscriptions: [
				{
					id: "ended-sub",
					planCode: "plus",
					status: "canceled",
					currentPeriodEnd: "2020-02-01T12:00:00.000Z",
					cancelAtPeriodEnd: true,
					canCancel: false,
				},
			],
		});
	await mount();
	assert.match(container.textContent ?? "", /30 minutes a day/);
	assert.match(container.textContent ?? "", /Plus subscription/);
	assert.doesNotMatch(container.textContent ?? "", /No recurring subscription/);
	assert.doesNotMatch(container.textContent ?? "", /Cancel renewal/);
});

test("response for another owner never displays their billing state", async () => {
	globalThis.fetch = async () =>
		Response.json({ ...active, ownerUserId: "another-owner" });
	await mount();
	assert.match(
		container.querySelector('[role="alert"]')?.textContent ?? "",
		/account changed/,
	);
	assert.doesNotMatch(container.textContent ?? "", /Plus subscription/);
});

test("canceled renewal offers restoration through an owner-bound request", async () => {
	const requests: { path: string; init?: RequestInit }[] = [];
	globalThis.fetch = async (path, init) => {
		requests.push({ path: String(path), init });
		if (String(path).endsWith("renewal-portal"))
			return Response.json(
				{ error: "Renewal management is temporarily unavailable." },
				{ status: 503 },
			);
		return Response.json({
			...active,
			subscriptions: [
				{
					...active.subscriptions[0],
					cancelAtPeriodEnd: true,
					canCancel: false,
					canRestoreRenewal: true,
				},
			],
		});
	};
	await mount();
	const button = [...container.querySelectorAll("button")].find((b) =>
		b.textContent?.includes("Restore renewal"),
	);
	assert.ok(button);
	await act(async () => button.click());
	assert.equal(requests[1]?.path, "/api/billing/renewal-portal");
	assert.equal(
		new Headers(requests[1]?.init?.headers).get(BILLING_OWNER_HEADER),
		"owner",
	);
	assert.equal(
		requests[1]?.init?.body,
		JSON.stringify({ subscriptionId: "local-sub" }),
	);
	assert.match(
		container.querySelector('[role="alert"]')?.textContent ?? "",
		/temporarily unavailable/,
	);
	assert.equal(button.disabled, false);
});

test("restoration eligibility disappears at its own deadline even with another longer access grant", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
	let requests = 0;
	globalThis.fetch = async () =>
		Response.json(
			++requests === 1
				? {
						...active,
						selectedPlanExpiresAt: "2030-02-01T00:00:00Z",
						subscriptions: [
							{
								...active.subscriptions[0],
								currentPeriodEnd: "2030-01-01T00:00:01Z",
								cancelAtPeriodEnd: true,
								canCancel: false,
								canRestoreRenewal: true,
							},
						],
					}
				: { ...active, subscriptions: [] },
		);
	await mount();
	assert.match(container.textContent!, /Restore renewal/);
	await act(async () => t.mock.timers.tick(1000));
	assert.equal(requests, 2);
	assert.doesNotMatch(container.textContent!, /Restore renewal/);
});

test("return from renewal restoration rereads Stripe and retains the original trial deadline", async () => {
	let requestedPath: string | undefined;
	let method: string | undefined;
	globalThis.fetch = async (path, init) => {
		requestedPath = String(path);
		method = init?.method;
		return Response.json({
			...active,
			subscriptions: [
				{
					...active.subscriptions[0],
					status: "trialing",
					canRestoreRenewal: false,
					price: { unitAmount: 799, currency: "usd", billingPeriod: "monthly" },
					trial: {
						stage: "trial",
						endsAt: "2030-02-01T12:00:00Z",
						pendingUntil: "2030-02-01T14:00:00Z",
					},
				},
			],
		});
	};
	await mount(true);
	assert.equal(requestedPath, "/api/billing/refresh");
	assert.equal(method, "POST");
	assert.match(container.textContent!, /Free trial/);
	assert.match(container.textContent!, /First monthly payment/);
	assert.equal(
		container.querySelector("dd")?.textContent,
		new Date("2030-02-01T12:00:00Z").toLocaleString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
			timeZoneName: "short",
		}),
	);
	assert.doesNotMatch(
		container.textContent!,
		/Restore renewal|Renewal canceled/,
	);
});

test("yearly billing shows the full yearly trial charge, never a monthly label", async () => {
	globalThis.fetch = async () =>
		Response.json({
			...active,
			subscriptions: [
				{
					...active.subscriptions[0],
					status: "trialing",
					price: { unitAmount: 7670, currency: "usd", billingPeriod: "yearly" },
					trial: {
						stage: "trial",
						endsAt: "2030-01-03T00:00:00Z",
						pendingUntil: "2030-01-03T02:00:00Z",
					},
				},
			],
		});
	await mount();
	assert.match(container.textContent!, /First yearly payment/);
	assert.match(container.textContent!, /\$76\.70\/year/);
	assert.doesNotMatch(
		container.textContent!,
		/\$76\.70\/month|first monthly payment/,
	);
});
test("manual paid conversion uses the dedicated owner-bound yearly portal endpoint", async () => {
	const requests: { path: string; init?: RequestInit }[] = [];
	globalThis.fetch = async (path, init) => {
		requests.push({ path: String(path), init });
		if (String(path).endsWith("yearly-portal"))
			return Response.json(
				{ error: "Fixture stops before Stripe navigation" },
				{ status: 503 },
			);
		return Response.json({
			...active,
			subscriptions: [
				{
					...active.subscriptions[0],
					canSwitchToYearly: true,
					price: { unitAmount: 799, currency: "usd", billingPeriod: "monthly" },
				},
			],
		});
	};
	await mount();
	const button = [...container.querySelectorAll("button")].find((b) =>
		b.textContent?.includes("Switch to yearly billing"),
	)!;
	assert.ok(button);
	assert.match(container.textContent!, /Stripe credits unused monthly time/);
	await act(async () => button.click());
	assert.equal(requests[1].path, "/api/billing/yearly-portal");
	assert.equal(
		new Headers(requests[1].init?.headers).get(BILLING_OWNER_HEADER),
		"owner",
	);
	assert.deepEqual(JSON.parse(String(requests[1].init?.body)), {
		subscriptionId: "local-sub",
	});
});

test("price lookup failure uses neutral trial payment copy, not an invented monthly period", async () => {
	globalThis.fetch = async () =>
		Response.json({
			...active,
			subscriptions: [
				{
					...active.subscriptions[0],
					status: "trialing",
					price: null,
					monthlyPrice: null,
					trial: {
						stage: "trial",
						endsAt: "2030-01-03T00:00:00Z",
						pendingUntil: "2030-01-03T02:00:00Z",
					},
				},
			],
		});
	await mount();
	assert.match(container.textContent!, /First subscription payment/);
	assert.doesNotMatch(
		container.textContent!,
		/first monthly payment|first yearly payment/,
	);
});

test("current trial is separate from collapsed canceled subscription history", async () => {
	globalThis.fetch = async () =>
		Response.json({
			...active,
			subscriptions: [
				{
					...active.subscriptions[0],
					status: "trialing",
					canChangeTrialPlan: true,
					price: { unitAmount: 7670, currency: "usd", billingPeriod: "yearly" },
					trial: {
						stage: "trial",
						endsAt: "2030-02-01T12:00:00Z",
						pendingUntil: "2030-02-01T14:00:00Z",
					},
				},
				{
					...active.subscriptions[0],
					id: "old-sub",
					status: "canceled",
					canCancel: false,
					price: { unitAmount: 799, currency: "usd", billingPeriod: "monthly" },
				},
			],
		});
	await mount();
	const history =
		container.querySelector<HTMLDetailsElement>(".billing-history");
	assert.ok(history);
	assert.equal(history.open, false);
	assert.match(history.textContent!, /Subscription history/);
	assert.match(history.textContent!, /7.99/);
	assert.equal(history.querySelectorAll("button").length, 0);
	const current = container.querySelector('[aria-label="Plus subscription"]')!;
	assert.ok(current && !history.contains(current));
	assert.equal((current.textContent!.match(/76\.70/g) ?? []).length, 1);
	assert.equal((current.textContent!.match(/Trial ends/g) ?? []).length, 1);
	assert.match(current.textContent!, /First yearly payment/);
	assert.match(current.textContent!, /Renews automatically/);
});

test("canceling renewal keeps the trial visible and does not promise a charge", async () => {
	globalThis.fetch = async () =>
		Response.json({
			...active,
			subscriptions: [
				{
					...active.subscriptions[0],
					status: "trialing",
					cancelAtPeriodEnd: true,
					canCancel: false,
					canRestoreRenewal: true,
					price: { unitAmount: 7670, currency: "usd", billingPeriod: "yearly" },
					trial: {
						stage: "trial",
						endsAt: "2030-02-01T12:00:00Z",
						pendingUntil: "2030-02-01T14:00:00Z",
					},
				},
			],
		});
	await mount();
	assert.equal(container.querySelectorAll(".billing-history").length, 0);
	assert.match(container.textContent!, /No payment scheduled/);
	assert.doesNotMatch(
		container.textContent!,
		/First yearly payment|Renews automatically/,
	);
	assert.match(container.textContent!, /Restore renewal/);
});

for (const status of ["past_due", "unpaid", "incomplete", "paused"]) {
	test(`unfinished ${status} subscription remains visible outside history`, async () => {
		globalThis.fetch = async () =>
			Response.json({
				...active,
				subscriptions: [{ ...active.subscriptions[0], status }],
			});
		await mount();
		assert.equal(container.querySelectorAll(".billing-history").length, 0);
		assert.ok(container.querySelector('[aria-label="Plus subscription"]'));
		if (status !== "paused")
			assert.match(container.textContent!, /Complete payment in Stripe/);
	});
}

test("quiet focus refresh keeps the valid subscription visible and does not reconcile Stripe", async () => {
	let finish!: (value: Response) => void;
	const paths: string[] = [];
	globalThis.fetch = async (path) => {
		paths.push(String(path));
		return paths.length === 1
			? Response.json(active)
			: new Promise((resolve) => {
					finish = resolve;
				});
	};
	await mount();
	await act(async () => window.dispatchEvent(new Event("blur")));
	assert.match(container.textContent!, /Plus/);
	await act(async () => window.dispatchEvent(new Event("focus")));
	assert.match(container.textContent!, /Plus/);
	assert.equal(paths[1], "/api/billing/subscription");
	await act(async () => finish(Response.json(active)));
});

test("a pending billing read from before an account switch cannot revive its subscription", async () => {
	let resolve!: (response: Response) => void;
	let reads = 0;
	globalThis.fetch = async () =>
		++reads === 1
			? new Promise<Response>((r) => {
					resolve = r;
				})
			: Response.json(
					{
						error: "Your signed-in account changed. Reload this page.",
						code: "ACCOUNT_CHANGED",
					},
					{ status: 409 },
				);
	await mount();
	await act(async () => {
		window.dispatchEvent(new Event("blur"));
		window.dispatchEvent(new Event("focus"));
	});
	await act(async () => resolve(Response.json(active)));
	assert.equal(reads, 2);
	assert.equal(
		container.querySelector('[aria-label="Plus subscription"]'),
		null,
	);
	assert.match(container.textContent!, /account changed/);
});

test("server billing data is shown without an immediate duplicate request", async () => {
	const calls: string[] = [];
	globalThis.fetch = async (path) => {
		calls.push(String(path));
		return Response.json(active);
	};
	await mount(false, { overview: active, remainingMs: 60_000 });
	assert.match(container.textContent!, /Plus subscription/);
	assert.deepEqual(calls, []);
});
test("Stripe return reconciles even when server billing data is supplied", async () => {
	const calls: string[] = [];
	globalThis.fetch = async (path) => {
		calls.push(String(path));
		return Response.json(active);
	};
	await mount(true, { overview: active, remainingMs: 60_000 });
	assert.deepEqual(calls, ["/api/billing/refresh"]);
});

test("billing consumes its click-time request once and includes navigation time in the lease", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
	let calls = 0;
	globalThis.fetch = async () => {
		calls++;
		return Response.json({
			...active,
			selectedPlanExpiresAt: "2030-01-01T00:00:01Z",
		});
	};
	try {
		preloadAccountNavigation("owner", "/account/billing");
		t.mock.timers.tick(1_100);
		await mount();
		assert.equal(calls, 1);
		assert.doesNotMatch(container.textContent!, /Plus subscription/);
		assert.match(container.textContent!, /Subscription status expired/);
	} finally {
		clearAccountPreloads();
	}
});

test("billing exposes persisted activation recovery before any subscription exists", async () => {
	globalThis.fetch = async () =>
		Response.json({
			...active,
			planCode: "free",
			subscriptions: [],
			pendingTrialActivation: {
				id: "activation-a",
				planCode: "pro",
				billingPeriod: "yearly",
			},
		});
	await mount();
	assert.match(container.textContent!, /Your Pro trial is being prepared/);
	const recovery = [...container.querySelectorAll("a")].find(
		(a) => a.textContent?.trim() === "Check trial status",
	);
	assert.ok(recovery);
	assert.equal(
		recovery.getAttribute("href"),
		"/checkout?plan=pro&billing=yearly",
	);
	assert.equal(
		[...container.querySelectorAll("a")].some(
			(a) => a.textContent?.trim() === "View plans",
		),
		false,
	);
});

for (const stage of ["processing", "payment_required", "ended"] as const) {
	test(`cardless ${stage} details identify the original trial as ended, not the next billing period`, async () => {
		const trial = { ...cardless.subscriptions[0].trial!, stage };
		globalThis.fetch = async () =>
			Response.json({
				...cardless,
				subscriptions: [
					{
						...cardless.subscriptions[0],
						status: "past_due",
						currentPeriodEnd: "2030-02-04T00:00:00Z",
						trial,
					},
				],
			});
		await mount();
		const label = [...container.querySelectorAll("dt")].find(
			(dt) => dt.textContent === "Trial ended",
		);
		assert.ok(label);
		assert.equal(
			label.nextElementSibling?.textContent,
			formatBillingTime(trial.endsAt),
		);
		assert.equal(
			label.parentElement?.querySelector(".billing-timezone")?.textContent,
			"Your local time",
		);
	});
}

for (const cancelAtPeriodEnd of [false, true]) {
	test(`paid cardless billing retains its ${cancelAtPeriodEnd ? "end" : "renewal"} date`, async () => {
		globalThis.fetch = async () =>
			Response.json({
				...active,
				subscriptions: [
					{
						...active.subscriptions[0],
						cancelAtPeriodEnd,
						trial: { ...cardless.subscriptions[0].trial!, stage: "paid" },
					},
				],
			});
		await mount();
		const label = [...container.querySelectorAll("dt")].find(
			(dt) =>
				dt.textContent === (cancelAtPeriodEnd ? "Subscription ends" : "Renews"),
		);
		assert.ok(label);
		assert.equal(
			label.nextElementSibling?.textContent,
			new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(
				new Date(active.subscriptions[0].currentPeriodEnd!),
			),
		);
		assert.equal(container.querySelector(".billing-timezone"), null);
	});
}

test("paid summary opens existing management without creating a payment session", async () => {
	const calls: string[] = [];
	globalThis.fetch = async (input) => {
		calls.push(String(input));
		return Response.json({
			...active,
			subscriptions: [
				{
					...active.subscriptions[0],
					price: {
						unitAmount: 14390,
						currency: "usd",
						billingPeriod: "yearly",
					},
					planCode: "pro",
				},
			],
		});
	};
	await mount();
	assert.match(
		container.querySelector(".billing-summary-card")!.textContent!,
		/Active subscription.*Pro.*143.90.*year/,
	);
	assert.doesNotMatch(
		container.querySelector(".billing-summary-card")!.textContent!,
		/Free trial/,
	);
	const details = container.querySelector(
		".billing-summary-management",
	) as HTMLDetailsElement;
	assert.equal(details.open, false);
	const manage = [...container.querySelectorAll("button")].find((b) =>
		b.textContent?.includes("Manage subscription"),
	);
	assert.ok(manage);
	await act(async () => manage.click());
	assert.equal(details.open, true);
	assert.equal(document.activeElement, details.querySelector("summary"));
	assert.deepEqual(calls, ["/api/billing/subscription"]);
	assert.match(details.textContent!, /Cancel renewal/);
	await act(async () => window.dispatchEvent(new Event("focus")));
	assert.equal(
		(
			container.querySelector(
				".billing-summary-management",
			) as HTMLDetailsElement
		).open,
		true,
	);
});

test("cardless summary opens renewal setup and never promises a paid renewal without consent", async () => {
	globalThis.fetch = async () => Response.json(cardless);
	await mount();
	const card = container.querySelector(".billing-summary-card")!;
	assert.match(card.textContent!, /Free trial.*No automatic charge/);
	assert.equal(card.querySelector("a"), null);
	assert.match(card.querySelector("button")!.textContent!, /Set up renewal/);
	assert.doesNotMatch(card.textContent!, /Renews automatically|Next payment/);
});

test("enabled cardless renewal opens management without offering another plan or card", async () => {
	const actions: string[] = [];
	globalThis.fetch = async (path) => {
		if (String(path).includes("/trial/renewal/")) {
			actions.push(String(path));
			return Response.json({
				...renewalPreview,
				savedCard: {
					sourceId: "saved-operation",
					brand: "visa",
					last4: "4242",
				},
			});
		}
		return Response.json({
			...cardless,
			subscriptions: [
				{
					...cardless.subscriptions[0],
					trial: {
						...cardless.subscriptions[0].trial!,
						renewalState: "enabled",
						renewalEnabled: true,
					},
				},
			],
		});
	};
	await mount();
	const card = container.querySelector(".billing-summary-card")!;
	assert.match(card.textContent!, /Renewal is enabled/);
	assert.doesNotMatch(
		card.textContent!,
		/Choose a plan|View plans|No automatic charge/,
	);
	const details = container.querySelector<HTMLDetailsElement>(
		".billing-summary-management",
	)!;
	await act(async () => {
		details.open = false;
		details.dispatchEvent(new Event("toggle"));
	});
	assert.equal(details.open, false);
	await act(async () => trialButton(/^Manage renewal\s*$/).click());
	assert.equal(details.open, true);
	assert.equal(document.activeElement, details.querySelector("summary"));
	assert.deepEqual(
		actions,
		["/api/billing/trial/renewal/preview"],
		"opening management only reads prices and card",
	);
	assert.doesNotMatch(details.textContent!, /before adding a card/);
	assert.equal(trialButton(/^Renewal is enabled$/).disabled, true);
	await selectProYearly();
	assert.ok(trialButton(/^Save changes$/));
	assert.match(details.textContent!, /VISA.*4242/);
	assert.doesNotMatch(details.textContent!, /Add card & enable renewal/);
	assert.match(details.textContent!, /No payment today/);
	assert.match(details.textContent!, /First payment/);
	assert.ok(trialButton(/^Cancel trial renewal$/));
});

test("canceled paid renewal shows paid-through date rather than a next charge", async () => {
	globalThis.fetch = async () =>
		Response.json({
			...active,
			subscriptions: [
				{
					...active.subscriptions[0],
					cancelAtPeriodEnd: true,
					canCancel: false,
					canRestoreRenewal: true,
				},
			],
		});
	await mount();
	const card = container.querySelector(".billing-summary-card")!;
	assert.match(card.textContent!, /Renewal off.*Paid until/);
	assert.doesNotMatch(card.textContent!, /Next payment|Renews automatically/);
});

test("a new pending renewal reopens controls even after the user collapsed them", async () => {
	let view = cardless;
	globalThis.fetch = async () => Response.json(view);
	await mount();
	let details = container.querySelector(
		".billing-summary-management",
	) as HTMLDetailsElement;
	await act(async () => {
		details.open = true;
		details.dispatchEvent(new Event("toggle"));
	});
	await act(async () => {
		details.open = false;
		details.dispatchEvent(new Event("toggle"));
	});
	assert.equal(details.open, false);
	view = {
		...cardless,
		subscriptions: [
			{
				...cardless.subscriptions[0],
				trial: {
					...cardless.subscriptions[0].trial!,
					renewalState: "pending",
					pendingRenewal: { id: "new-operation", action: "enable" },
				},
			},
		],
	};
	await act(async () => window.dispatchEvent(new Event("focus")));
	details = container.querySelector(
		".billing-summary-management",
	) as HTMLDetailsElement;
	assert.equal(details.open, true);
	assert.match(details.textContent!, /Check renewal status/);
});

test("opening legacy card-required trial management never requests cardless renewal terms", async () => {
	const requests: string[] = [];
	globalThis.fetch = async (path) => {
		requests.push(String(path));
		return Response.json({
			...cardless,
			subscriptions: [
				{
					...cardless.subscriptions[0],
					trial: { ...cardless.subscriptions[0].trial!, mode: "card_required" },
				},
			],
		});
	};
	await mount(false, undefined, undefined, true);
	assert.ok(requests.length > 0);
	assert.equal(requests.filter((path) => path.includes("/renewal/")).length, 0);
	assert.equal(container.querySelector('[aria-label="Trial renewal"]'), null);
});

test("opening renewal setup reviews once, preserves terms on reopen, and never enables renewal", async () => {
	const actions: string[] = [];
	globalThis.fetch = async (path) => {
		if (String(path).endsWith("/preview")) {
			actions.push(String(path));
			return Response.json(renewalPreview);
		}
		return Response.json(cardless);
	};
	await mount();
	assert.equal(actions.length, 0, "the overview performs no quote request");
	await act(async () => trialButton(/^Set up renewal/).click());
	const details = container.querySelector<HTMLDetailsElement>(
		".billing-summary-management",
	)!;
	assert.equal(details.open, true);
	assert.ok(
		container.querySelector<HTMLElement>(".billing-summary-card")!.hidden,
	);
	assert.equal(actions.length, 1);
	assert.ok(trialButton(/^Add card & enable renewal$/));
	await act(async () => trialButton(/^Not now$/).click());
	assert.equal(details.open, false);
	assert.equal(document.activeElement, trialButton(/^Set up renewal/));
	await act(async () => trialButton(/^Set up renewal/).click());
	assert.equal(actions.length, 1, "reopening retains the current quote");
	await act(async () =>
		container
			.querySelector<HTMLInputElement>(
				'[aria-label="Renewal billing period"] input[value="yearly"]',
			)!
			.click(),
	);
	assert.equal(actions.length, 1, "a new selection uses the loaded prices");
	assert.match(
		container.querySelector('[aria-label="Review renewal terms"]')!
			.textContent!,
		/76.70.*year/,
	);
	assert.doesNotMatch(
		container.querySelector('[aria-label="Review renewal terms"]')!
			.textContent!,
		/7.99/,
	);
	assert.equal(window.location.pathname, "/account/billing");
});

test("a failed automatic renewal review offers a retry without a loop or a setup button", async () => {
	let requests = 0;
	globalThis.fetch = async (path) => {
		if (String(path).endsWith("/preview")) {
			requests++;
			return Response.json({ error: "Terms unavailable" }, { status: 503 });
		}
		return Response.json(cardless);
	};
	await mount();
	await act(async () => trialButton(/^Set up renewal/).click());
	assert.equal(requests, 1);
	assert.ok(container.querySelector('[role="alert"]'));
	assert.equal(
		[...container.querySelectorAll("button")].some((b) =>
			/Add card/.test(b.textContent ?? ""),
		),
		false,
	);
	await act(async () => window.dispatchEvent(new Event("focus")));
	assert.equal(requests, 1);
	await act(async () => trialButton(/^Review renewal$/).click());
	assert.equal(requests, 2);
});

test("expired open renewal terms require a fresh explicit review without auto-retrying", async (t) => {
	t.mock.timers.enable({
		apis: ["setTimeout", "Date"],
		now: Date.parse(cardless.serverTime!),
	});
	let quotes = 0;
	globalThis.fetch = async (path) => {
		if (String(path).endsWith("/preview")) {
			quotes++;
			return Response.json({
				...renewalPreview,
				expiresAt: "2030-01-01T00:00:01Z",
			});
		}
		return Response.json(cardless);
	};
	await mount();
	await act(async () => trialButton(/^Set up renewal/).click());
	assert.ok(trialButton(/^Add card & enable renewal$/));
	await act(async () => t.mock.timers.tick(1000));
	assert.equal(quotes, 1);
	assert.equal(
		container.querySelector('[aria-label="Review renewal terms"]'),
		null,
	);
	assert.ok(trialButton(/^Review renewal$/));
});

test("expired trial overview offers paid plans without duplicate Free controls or a repeat trial", async () => {
	globalThis.fetch = async () =>
		Response.json({
			...cardless,
			planCode: "free",
			subscriptions: [
				{
					...cardless.subscriptions[0],
					status: "canceled",
					trial: { ...cardless.subscriptions[0].trial!, stage: "ended" },
				},
			],
		});
	await mount();
	const card = container.querySelector('[aria-label="Trial ended"]')!;
	assert.match(card.textContent!, /Your trial has ended/);
	assert.match(
		card.textContent!,
		/Current planFreeYou can still join friends for free/,
	);
	assert.equal(card.querySelector("a")!.getAttribute("href"), "/pricing");
	assert.equal(container.querySelector('[aria-label="Current access"]'), null);
	assert.doesNotMatch(
		container.textContent!,
		/Try 3 days|Set up renewal|No charges were made/,
	);
	assert.ok(container.querySelector(".billing-history"));
});

// A server in UTC and a browser west of UTC can display different calendar days.
// Recovering by replacing the whole billing tree can reset draft controls.
for (const state of ["trial", "paid", "ended", "processing"] as const) {
	test(`SSR ${state} billing hydrates across time zones without replacing its controls`, async () => {
		const previousZone = process.env.TZ;
		let reads = 0;
		const subscription = {
			...cardless.subscriptions[0],
			status:
				state === "paid"
					? "active"
					: state === "ended"
						? "canceled"
						: "trialing",
			currentPeriodEnd: "2030-01-04T00:00:00Z",
			trial: { ...cardless.subscriptions[0].trial!, stage: state },
		};
		const overview: BillingOverview = {
			...cardless,
			planCode: state === "ended" ? "free" : "plus",
			subscriptions: [subscription],
		};
		globalThis.fetch = async () => {
			reads++;
			return Response.json(overview);
		};
		const view = React.createElement(BillingClient, {
			ownerUserId: "owner",
			returnedFromPortal: false,
			initial: { overview, remainingMs: 60_000 },
		});
		try {
			process.env.TZ = "UTC";
			container = document.createElement("div");
			container.innerHTML = renderToString(view);
			document.body.appendChild(container);
			const serverTree = container.firstElementChild;
			process.env.TZ = "America/Los_Angeles";
			const recoveries: unknown[] = [];
			await act(async () => {
				root = hydrateRoot(container, view, {
					onRecoverableError: (error) => recoveries.push(error),
				});
			});
			assert.deepEqual(recoveries.map(String), []);
			assert.equal(container.firstElementChild, serverTree);
			assert.equal(reads, 0, "local date hydration must not refetch billing");
			assert.match(
				container.textContent!,
				state === "ended"
					? /Your trial has ended/
					: state === "processing"
						? /Jan 3, 2030/
						: /January 3, 2030/,
			);
		} finally {
			if (previousZone === undefined) delete process.env.TZ;
			else process.env.TZ = previousZone;
		}
	});
}
