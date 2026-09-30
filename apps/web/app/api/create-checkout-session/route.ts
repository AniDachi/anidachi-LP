import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { subscriptionCheckoutService } from "@/lib/anidachi-auth/subscription-checkout-server";
import { SubscriptionCheckoutError } from "@/lib/anidachi-auth/subscription-trial";
import { getSession } from "@/lib/anidachi-auth/session";
import {
	checkoutInputToPaidPlanCode,
	type LegacyCheckoutTier,
} from "@/lib/anidachi-auth/plan-entitlements";
import { stripePriceIdForPlanCode } from "@/lib/anidachi-auth/stripe-plans";
import { createStripeClient } from "@/lib/anidachi-auth/stripe-env";

function loginUrlForRequest(request: NextRequest): string {
	let next = "/";
	const referer = request.headers.get("referer");
	if (referer) {
		try {
			const refererUrl = new URL(referer);
			if (refererUrl.origin === request.nextUrl.origin) {
				next = `${refererUrl.pathname}${refererUrl.search}`;
			}
		} catch {
			next = "/";
		}
	}
	return `/login?next=${encodeURIComponent(next)}`;
}

export type CheckoutTier = LegacyCheckoutTier;

export async function POST(request: NextRequest) {
	try {
		const authSession = await getSession();
		if (!authSession) {
			return NextResponse.json(
				{
					error: "Sign in required before starting checkout",
					loginUrl: loginUrlForRequest(request),
				},
				{ status: 401 },
			);
		}

		let stripe: Stripe;
		try {
			stripe = createStripeClient();
		} catch (error) {
			// Fail closed on missing/mismatched keys (e.g. a live key in a test env).
			console.error(
				"[create-checkout-session] Stripe is not configured:",
				error,
			);
			return NextResponse.json(
				{ error: "Stripe checkout is not configured" },
				{ status: 500 },
			);
		}

		const body = (await request.json()) as {
			tier?: CheckoutTier;
			planCode?: unknown;
			billingPeriod?: unknown;
			requestId?: unknown;
			expectedOwnerUserId?: unknown;
			expectedTrialOffered?: unknown;
			expectedPrice?: unknown;
			/** First-touch SEO/acquisition landing path (session-scoped). */
			seoLandingPath?: unknown;
			/** Path where checkout was started. */
			checkoutPagePath?: unknown;
			seoReferrer?: unknown;
			seoUtm?: unknown;
		};
		if (
			body.expectedOwnerUserId !== undefined &&
			body.expectedOwnerUserId !== authSession.userId
		) {
			return NextResponse.json(
				{
					error:
						"Your signed-in account changed. Reload the plans before continuing.",
				},
				{ status: 409 },
			);
		}

		const planCode = checkoutInputToPaidPlanCode(body);
		if (!planCode) {
			return NextResponse.json(
				{ error: "Missing paid plan (expected planCode or tier)" },
				{ status: 400 },
			);
		}

		const billingPeriod =
			body.billingPeriod === undefined ? "monthly" : body.billingPeriod;
		if (billingPeriod !== "monthly" && billingPeriod !== "yearly")
			return NextResponse.json(
				{ error: "Select monthly or yearly billing." },
				{ status: 400 },
			);
		if (billingPeriod === "yearly" && body.expectedPrice === undefined)
			return NextResponse.json(
				{ error: "Review the yearly price before checkout." },
				{ status: 400 },
			);
		const priceId = stripePriceIdForPlanCode(planCode, billingPeriod);
		if (!priceId) {
			return NextResponse.json(
				{ error: "This plan is not configured for checkout yet." },
				{ status: 400 },
			);
		}

		if (
			body.requestId !== undefined &&
			(typeof body.requestId !== "string" ||
				!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
					body.requestId,
				))
		) {
			return NextResponse.json(
				{ error: "Invalid checkout request ID" },
				{ status: 400 },
			);
		}

		const seoLandingPath =
			typeof body.seoLandingPath === "string"
				? body.seoLandingPath.slice(0, 200)
				: undefined;
		const checkoutPagePath =
			typeof body.checkoutPagePath === "string"
				? body.checkoutPagePath.slice(0, 200)
				: undefined;
		const seoReferrer =
			typeof body.seoReferrer === "string"
				? body.seoReferrer.slice(0, 500)
				: undefined;
		const seoUtm =
			typeof body.seoUtm === "string" ? body.seoUtm.slice(0, 400) : undefined;

		const attributionMeta: Record<string, string> = {
			userId: authSession.userId,
			planCode,
			billingPeriod,
		};
		if (seoLandingPath) attributionMeta.seoLandingPath = seoLandingPath;
		if (checkoutPagePath) attributionMeta.checkoutPagePath = checkoutPagePath;
		if (seoReferrer) attributionMeta.seoReferrer = seoReferrer;
		if (seoUtm) attributionMeta.seoUtm = seoUtm;

		const result = await subscriptionCheckoutService(
			stripe,
		).prepareSubscriptionCheckout({
			userId: authSession.userId,
			email: authSession.email,
			planCode,
			priceId,
			billingPeriod,
			...(body.expectedPrice !== undefined
				? {
						displayedOffer: {
							trial: body.expectedTrialOffered,
							price: body.expectedPrice,
						},
					}
				: {}),
			origin: request.nextUrl.origin,
			requestId:
				typeof body.requestId === "string" ? body.requestId : randomUUID(),
			attribution: attributionMeta,
		});
		if (
			typeof body.expectedTrialOffered === "boolean" &&
			result.kind === "checkout" &&
			result.trialOffered !== body.expectedTrialOffered
		) {
			return NextResponse.json(
				{
					error:
						"Your trial availability changed. Reload the plans and review the current offer.",
				},
				{ status: 409 },
			);
		}
		return NextResponse.json(result);
	} catch (error) {
		console.error("Error creating checkout session:", error);
		if (error instanceof SubscriptionCheckoutError) {
			return NextResponse.json(
				{
					error:
						error.status === 409
							? "Your price or available offer changed. Review the current plans before continuing."
							: error.status === 400
								? "Invalid checkout offer. Reload the plans and try again."
								: "We could not confirm your checkout yet. Please retry; an existing checkout will be reused.",
				},
				{ status: error.status },
			);
		}
		const message =
			error instanceof Stripe.errors.StripeInvalidRequestError
				? error.message
				: "Error creating checkout session";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
