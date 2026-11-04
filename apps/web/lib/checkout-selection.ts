import { AUTH_REFRESH_PATH } from "./anidachi-auth/session-refresh";
import type { BillingPeriod } from "./billing-view";
import type { CheckoutTier } from "./pricing-tiers";
import { OnboardingTokenSchema } from "@anidachi/protocol";

export type CheckoutSelection = {
	plan: CheckoutTier;
	billing: BillingPeriod;
	/** An extension trial offer must show website terms before any checkout action. */
	confirmTrial?: true;
	onboarding?: string;
};

/** Selection and confirmation intent survive auth. Price and eligibility stay server-owned. */
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
	const confirm = url.searchParams.get("confirm");
	const onboarding = url.searchParams.get("onboarding");
	if (
		url.searchParams.getAll("plan").length !== 1 ||
		url.searchParams.getAll("billing").length !== 1 ||
		url.searchParams.getAll("confirm").length > 1 ||
		url.searchParams.getAll("onboarding").length > 1 ||
		(onboarding !== null && !OnboardingTokenSchema.safeParse(onboarding).success) ||
		(confirm !== null && confirm !== "trial")
	)
		return null;
	if (
		(plan !== "plus" && plan !== "pro") ||
		(billing !== "monthly" && billing !== "yearly")
	)
		return null;
	return { plan, billing, ...(confirm === "trial" ? { confirmTrial: true as const } : {}), ...(onboarding ? { onboarding } : {}) };
}

export function checkoutReturnPath({
	plan,
	billing,
	confirmTrial,
	onboarding,
}: CheckoutSelection): string {
	return `/checkout?plan=${plan}&billing=${billing}${confirmTrial ? "&confirm=trial" : ""}${onboardingQuery(onboarding)}`;
}

export function onboardingQuery(token?: string): string {
	return token && OnboardingTokenSchema.safeParse(token).success ? `&onboarding=${token}` : "";
}

export function checkoutPlansPath(selection: CheckoutSelection): string {
	return `/pricing?plan=${selection.plan}&billing=${selection.billing}${onboardingQuery(selection.onboarding)}`;
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
	// Uninstall selection carries intent only, never an automatic billing action.
	const uninstall = uninstallReturnPath(returnTo);
	if (uninstall) return `/login?error=${encodeURIComponent(error)}&next=${encodeURIComponent(uninstall)}`;
	return `/login?error=${encodeURIComponent(error)}${selection ? `&next=${encodeURIComponent(checkoutReturnPath(selection))}` : ""}`;
}

/** Strict local continuation: preserve only the approved monthly plan choice. */
export function uninstallReturnPath(path: string | null | undefined): string | null {
	if (!path || !/^\/uninstall(?:\?|$)/.test(path)) return null;
	const url = new URL(path, "https://uninstall-intent.invalid");
	if (url.origin !== "https://uninstall-intent.invalid" || url.pathname !== "/uninstall" || url.hash) return null;
	if (!url.search) return "/uninstall";
	const plan = url.searchParams.get("plan");
	if (url.searchParams.size !== 1 || (plan !== "plus" && plan !== "pro")) return null;
	return `/uninstall?plan=${plan}`;
}
