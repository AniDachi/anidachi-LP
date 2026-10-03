import type { MonthlyPrice } from "./billing-view";
export type PricingPrices = Record<"plus" | "pro", MonthlyPrice>;

export type PricingOffer = {
	ownerUserId: string | null;
	paidHostingActive: boolean;
	/** Missing in older responses means the trial offer is unconfirmed. */
	trialAvailable?: boolean;
	validForMs: number;
	action: "sign_in" | "trial" | "subscribe" | "manage";
	prices: PricingPrices;
	yearlyPrices?: PricingPrices | null;
};

export function hasConfirmedTrialOffer(offer: PricingOffer | null): boolean {
	return (
		offer?.action === "trial" ||
		(offer?.action === "sign_in" &&
			offer.paidHostingActive === true &&
			offer.trialAvailable === true)
	);
}
