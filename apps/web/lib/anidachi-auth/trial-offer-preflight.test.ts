import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { createTrialOfferHandler } from "./trial-offer-preflight";
import {
	createTrialAbuseTokens,
	trialBrowserCookieName,
	trialDenialCookieName,
} from "./trial-abuse";
import type { PricingOffer } from "../pricing-offer";
const origin = "https://staging.anidachi.app";
const owner = "ab000000-0000-4000-8000-000000000001";
const requestId = "ac000000-0000-4000-8000-000000000001";
const tokens = createTrialAbuseTokens("test-only", origin);
const cookie = tokens.issueCookie();
const offer: PricingOffer = {
	ownerUserId: owner,
	action: "trial",
	trialMode: "cardless",
	trialOfferRevision: "3",
	trialAvailable: true,
	paidHostingActive: true,
	validForMs: 60000,
	prices: {
		plus: { unitAmount: 799, currency: "usd" },
		pro: { unitAmount: 1499, currency: "usd" },
	},
};
function request(
	body: unknown = { requestId },
	headers: Record<string, string> = {},
) {
	return new NextRequest(origin + "/api/billing/trial/offer", {
		method: "POST",
		headers: {
			origin,
			"content-type": "application/json",
			"X-Anidachi-Billing-Owner": owner,
			cookie: trialBrowserCookieName(origin) + "=" + cookie,
			...headers,
		},
		body: JSON.stringify(body),
	});
}
const deps = {
	getUser: async () => ({ id: owner }),
	getOffer: async () => offer,
	allowRequest: async () => true,
	tokens: () => tokens,
};
test("fresh cookie-only preflight returns an offer without activation or a denial receipt", async () => {
	let reads = 0;
	const response = await createTrialOfferHandler({
		...deps,
		readMarkers: async (user, markers) => {
			reads++;
			assert.equal(user, owner);
			assert.equal(markers.browser, tokens.readCookie(cookie));
			assert.equal(markers.installation, undefined);
			return "available";
		},
	})(request());
	assert.equal(response.status, 200);
	assert.equal((await response.json()).offer.action, "trial");
	assert.equal(reads, 1);
	assert.equal(response.headers.get("set-cookie"), null);
	assert.equal(response.headers.get("cache-control"), "private, no-store");
});
test("consumed marker returns ordinary purchase and a bound receipt; busy is retry, never purchase", async () => {
	for (const state of ["used", "busy"] as const) {
		const response = await createTrialOfferHandler({
			...deps,
			readMarkers: async () => state,
		})(request());
		const body = await response.json();
		assert.equal(body.ownerUserId, owner);
		if (state === "used") {
			assert.equal(body.state, "ready");
			assert.equal(body.offer.action, "subscribe");
			assert.equal(body.offer.trialAvailable, false);
			assert.ok(
				tokens.isDenied(
					cookie,
					response.cookies.get(trialDenialCookieName(origin))?.value,
					owner,
				),
			);
		} else {
			assert.equal(response.status, 409);
			assert.equal(body.state, "trial_busy");
			assert.equal(body.offer, undefined);
			assert.equal(response.headers.get("set-cookie"), null);
		}
	}
});
test("active or own pending activation takes priority even with missing cookie and invalid supplied proof", async () => {
	for (const pending of [false, true]) {
		const active = {
			...offer,
			action: "manage" as const,
			...(pending
				? {
						pendingTrialActivation: {
							id: requestId,
							state: "pending" as const,
						},
					}
				: {}),
		} as PricingOffer;
		const response = await createTrialOfferHandler({
			...deps,
			getOffer: async () => active,
			readMarkers: async () => {
				throw Error("must not read");
			},
		})(request({ requestId, extensionProof: {} }, { cookie: "" }));
		assert.equal(response.status, 200);
		assert.equal((await response.json()).offer.action, "manage");
	}
});
test("marker/account race refreshes authority rather than misreporting another activation", async () => {
	let reads = 0;
	const response = await createTrialOfferHandler({
		...deps,
		getOffer: async () =>
			++reads === 1 ? offer : { ...offer, action: "manage" },
		readMarkers: async () => "account_changed",
	})(request());
	assert.equal((await response.json()).offer.action, "manage");
	assert.equal(reads, 2);
});
test("missing cookie, supplied invalid proof, ledger outage and invalid response never invent purchase", async () => {
	for (const [body, headers, status] of [
		[{ requestId }, { cookie: "" }, 409],
		[{ requestId, extensionProof: {} }, {}, 409],
		[{ requestId }, {}, 503],
	] as const) {
		const response = await createTrialOfferHandler({
			...deps,
			readMarkers: async () => {
				throw Error("outage");
			},
		})(request(body, headers));
		assert.equal(response.status, status);
		assert.equal((await response.json()).offer, undefined);
		assert.equal(response.headers.get("set-cookie"), null);
	}
});
test("same-origin, owner, session, bounded body and rate limits protect the marker lookup", async () => {
	let reads = 0;
	const handler = createTrialOfferHandler({
		...deps,
		readMarkers: async () => {
			reads++;
			return "available";
		},
	});
	assert.equal(
		(await handler(request(undefined, { origin: "https://evil.test" }))).status,
		403,
	);
	assert.equal(
		(await handler(request(undefined, { "X-Anidachi-Billing-Owner": "wrong" })))
			.status,
		409,
	);
	assert.equal((await handler(request({ requestId: "bad" }))).status, 400);
	assert.equal(
		(await handler(request({ requestId, padding: "x".repeat(7000) }))).status,
		400,
	);
	assert.equal(
		(
			await createTrialOfferHandler({ ...deps, getUser: async () => null })(
				request(),
			)
		).status,
		401,
	);
	assert.equal(
		(
			await createTrialOfferHandler({
				...deps,
				allowRequest: async () => false,
			})(request())
		).status,
		429,
	);
	assert.equal(reads, 0);
});
