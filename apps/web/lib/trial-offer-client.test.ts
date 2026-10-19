import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { resolveBrowserTrialOffer } from "./trial-offer-client";
import type { PricingOffer } from "./pricing-offer";
const offer: PricingOffer = {
	ownerUserId: "owner",
	action: "trial",
	trialMode: "cardless",
	trialAvailable: true,
	paidHostingActive: true,
	validForMs: 60000,
	prices: {
		plus: { unitAmount: 799, currency: "usd" },
		pro: { unitAmount: 1499, currency: "usd" },
	},
};
const saved = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = saved;
});
test("one context and one marker check before returning a trial; never starts it", async () => {
	const paths: string[] = [];
	globalThis.fetch = async (url, init) => {
		paths.push(String(url));
		const body = JSON.parse(String(init?.body));
		assert.equal(body.requestId, "request");
		return Response.json(
			String(url).endsWith("context")
				? {
						state: "ready",
						ownerUserId: "owner",
						challenge: "a".repeat(180) + "." + "b".repeat(43),
						extensionId: null,
					}
				: { state: "ready", ownerUserId: "owner", offer },
		);
	};
	const result = await resolveBrowserTrialOffer(
		offer,
		new AbortController().signal,
		"request",
	);
	assert.equal(result.offer.action, "trial");
	assert.ok(result.context);
	assert.equal(result.extensionProof, undefined);
	assert.deepEqual(paths, [
		"/api/billing/trial/context",
		"/api/billing/trial/offer",
	]);
});
test("used changes display to explicit subscribe; busy/outage/malformed result never does", async () => {
	for (const state of [
		"used",
		"trial_busy",
		"unavailable",
		"invalid",
		"wrong_owner",
	]) {
		globalThis.fetch = async (url) =>
			Response.json(
				String(url).endsWith("context")
					? {
							state: "ready",
							ownerUserId: "owner",
							challenge: "a".repeat(180) + "." + "b".repeat(43),
							extensionId: null,
						}
					: state === "used"
						? {
								state: "ready",
								ownerUserId: "owner",
								offer: { ...offer, action: "subscribe", trialAvailable: false },
							}
						: state === "wrong_owner"
							? {
									state: "ready",
									ownerUserId: "owner",
									offer: { ...offer, ownerUserId: "other" },
								}
							: { state, ownerUserId: "owner" },
			);
		if (state === "used")
			assert.equal(
				(await resolveBrowserTrialOffer(offer, new AbortController().signal))
					.offer.action,
				"subscribe",
			);
		else
			await assert.rejects(() =>
				resolveBrowserTrialOffer(offer, new AbortController().signal),
			);
	}
});
test("current access, pending activation, signed-out, ordinary purchase and legacy trial skip marker checks", async () => {
	globalThis.fetch = async () => {
		throw Error("must not request");
	};
	for (const value of [
		{ ...offer, action: "manage" },
		{ ...offer, action: "sign_in", ownerUserId: null },
		{ ...offer, action: "subscribe" },
		{ ...offer, trialMode: "card_required" },
	] as PricingOffer[]) {
		assert.equal(
			(await resolveBrowserTrialOffer(value, new AbortController().signal))
				.offer,
			value,
		);
	}
});
test("canceled response cannot publish an offer or start the next phase", async () => {
	const controller = new AbortController();
	let calls = 0;
	globalThis.fetch = async () => {
		calls++;
		controller.abort();
		return Response.json({
			state: "ready",
			ownerUserId: "owner",
			challenge: "a".repeat(180) + "." + "b".repeat(43),
			extensionId: null,
		});
	};
	await assert.rejects(() =>
		resolveBrowserTrialOffer(offer, controller.signal),
	);
	assert.equal(calls, 1);
});
