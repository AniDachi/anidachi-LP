import type { MonthlyPrice } from "./billing-view";
export type PricingPrices = Record<"plus" | "pro", MonthlyPrice>;

export type PricingOffer = {
	ownerUserId: string | null;
	paidHostingActive: boolean;
	validForMs: number;
	action: "sign_in" | "trial" | "subscribe" | "manage";
	prices: PricingPrices;
};
