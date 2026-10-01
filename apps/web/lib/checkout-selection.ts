import { AUTH_REFRESH_PATH } from "./anidachi-auth/session-refresh";
import type { BillingPeriod } from "./billing-view";
import type { CheckoutTier } from "./pricing-tiers";

export type CheckoutSelection = { plan: CheckoutTier; billing: BillingPeriod };

/** Only the plan/period are carried through auth. Price and eligibility stay server-owned. */
export function checkoutSelectionFromPath(
	path: string | null | undefined,
): CheckoutSelection | null {
	if (!path?.startsWith("/checkout?")) return null;
	const url = new URL(path, "https://checkout-intent.invalid");
	if (
		url.origin !== "https://checkout-intent.invalid" ||
		url.pathname !== "/checkout" ||
		url.hash
	)
		return null;
	const plan = url.searchParams.get("plan");
	const billing = url.searchParams.get("billing");
	if (
		url.searchParams.getAll("plan").length !== 1 ||
		url.searchParams.getAll("billing").length !== 1
	)
		return null;
	if (
		(plan !== "plus" && plan !== "pro") ||
		(billing !== "monthly" && billing !== "yearly")
	)
		return null;
	return { plan, billing };
}

export function checkoutReturnPath({
	plan,
	billing,
}: CheckoutSelection): string {
	return `/checkout?plan=${plan}&billing=${billing}`;
}

export function checkoutLoginPath(selection: CheckoutSelection): string {
	return `/login?next=${encodeURIComponent(checkoutReturnPath(selection))}`;
}

/** Refresh or clear stale cookies before login, avoiding a valid-JWT/invalid-refresh redirect loop. */
export function checkoutSessionRecoveryPath(
	selection: CheckoutSelection,
): string {
	return `${AUTH_REFRESH_PATH}?next=${encodeURIComponent(checkoutReturnPath(selection))}`;
}

/** A verified OAuth transaction may restore checkout on retry, but never a foreign destination. */
export function checkoutLoginErrorPath(
	error: string,
	returnTo?: string | null,
): string {
	const selection = checkoutSelectionFromPath(returnTo);
	return `/login?error=${encodeURIComponent(error)}${selection ? `&next=${encodeURIComponent(checkoutReturnPath(selection))}` : ""}`;
}
