/** Browser-safe contract. No Stripe identifiers or campaign configuration. */
export const UNINSTALL_OFFER_VALID_FOR_MS = 60_000;
export const UNINSTALL_REASONS = [
	"not_using",
	"technical_issues",
	"too_expensive",
	"missing_features",
	"other",
] as const;
export type UninstallReason = (typeof UNINSTALL_REASONS)[number];
export type UninstallPlan = "plus" | "pro";
export type UninstallPrice = {
	planCode: UninstallPlan;
	currency: "usd";
	billingPeriod: "monthly";
	ordinaryAmount: number;
	discountedAmount: number;
};
type Base = { ownerUserId: string | null; validForMs: number };
export type UninstallOffer = Base &
	(
		| { kind: "sign_in"; loginUrl: string }
		| { kind: "first_month"; prices: UninstallPrice[]; revision: string }
		| {
				kind: "renewal";
				price: UninstallPrice;
				renewsAt: string;
				revision: string;
				manageUrl: string;
		  }
		| {
				kind: "claimed";
				price: UninstallPrice;
				renewsAt: string;
				state: "accepted" | "applied" | "ineligible" | "reconciliation";
				reason: string;
				manageUrl: string;
		  }
		| { kind: "manage"; reason: string; manageUrl: string }
		| { kind: "former" | "disabled" | "unavailable"; reason: string }
	);
export type UninstallCheckoutInput = {
	expectedOwnerUserId: string;
	revision: string;
	planCode: UninstallPlan;
	expectedPrice: UninstallPrice;
	requestId: string;
};
export type UninstallClaimInput = {
	expectedOwnerUserId: string;
	revision: string;
};
export type UninstallCheckoutResult = {
	ownerUserId: string;
	url: string;
	kind: "checkout" | "manage_subscription";
};
export type UninstallFeedbackInput = {
	submissionId: string;
	reason: UninstallReason;
	note?: string;
};
export class UninstallError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
	}
}
export const uninstallDiscount = (amount: number) =>
	amount - Math.round(amount * 0.4);
export function calculateUninstallPrice(
	planCode: UninstallPlan,
	amount: number,
): UninstallPrice {
	if (!Number.isSafeInteger(amount) || amount <= 0)
		throw new Error("Offer price unavailable.");
	return {
		planCode,
		currency: "usd",
		billingPeriod: "monthly",
		ordinaryAmount: amount,
		discountedAmount: uninstallDiscount(amount),
	};
}
