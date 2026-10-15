import type { NextRequest } from "next/server";
import type { PricingOffer } from "../pricing-offer";
import {
	createTrialAbuseTokens,
	trialBrowserCookieName,
	trialDenialCookieName,
} from "./trial-abuse";
export function browserTrialDenied(
	request: NextRequest,
	owner: string,
): boolean {
	const origin = request.nextUrl.origin;
	const denial = request.cookies.get(trialDenialCookieName(origin))?.value;
	if (!denial) return false;
	return createTrialAbuseTokens(
		process.env.ANIDACHI_JWT_SECRET ?? "",
		origin,
	).isDenied(
		request.cookies.get(trialBrowserCookieName(origin))?.value,
		denial,
		owner,
	);
}
export function restrictTrialOffer(
	offer: PricingOffer,
	denied: boolean,
): PricingOffer {
	return denied && offer.action === "trial"
		? { ...offer, action: "subscribe", trialAvailable: false }
		: offer;
}
