import type { MonthlyPrice } from "./billing-view";
export type PricingOffer = {
	ownerUserId: string | null;
	paidHostingActive: boolean;
	validForMs: number;
	action: "sign_in" | "trial" | "subscribe" | "manage";
	prices: Record<"plus" | "pro", MonthlyPrice>;
};
