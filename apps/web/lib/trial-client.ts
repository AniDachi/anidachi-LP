import { BILLING_OWNER_HEADER } from "./billing-view";

const states = new Set([
	"ready",
	"trial_used",
	"trial_busy",
	"context_required",
	"active",
	"pending",
	"ineligible",
	"verification_required",
	"offer_changed",
	"unavailable",
	"expired",
	"canceled",
	"superseded",
	"quoted",
	"setup",
]);

// Keep typed business outcomes on HTTP 409, while rejecting stale account responses.
export async function postTrialAction<T extends { state: string }>(
	path: string,
	owner: string,
	body: unknown,
	signal: AbortSignal,
): Promise<T> {
	const response = await fetch(`/api/billing/trial/${path}`, {
		method: "POST",
		cache: "no-store",
		headers: {
			"Content-Type": "application/json",
			[BILLING_OWNER_HEADER]: owner,
		},
		body: JSON.stringify(body),
		signal: AbortSignal.any([signal, AbortSignal.timeout(45_000)]),
	});
	const value = await response.json();
	if (response.status === 401)
		throw new Error("Sign in again to manage your trial.");
	if (value.ownerUserId !== undefined && value.ownerUserId !== owner)
		throw new Error(
			"Your account changed. Reload this page before continuing.",
		);
	if (value.ownerUserId !== owner || !states.has(value.state))
		throw new Error(
			value.error ?? "Your trial could not be confirmed. Please try again.",
		);
	return value as T;
}

export function trialResultMessage(state: string): string {
	const messages: Record<string, string> = {
		trial_used: "A free trial has already been used here",
		trial_busy:
			"Another trial is still being confirmed here. Please try again in a moment.",
		context_required: "Please refresh the trial confirmation and try again.",
		pending:
			"Your trial change is still being confirmed. Check its status before trying again.",
		expired:
			"This trial or confirmation has expired. Refresh your billing status to see the available options.",
		superseded:
			"A newer trial change exists. Refresh your billing status before continuing.",
		offer_changed:
			"The offer changed. Review the current terms before continuing.",
		ineligible:
			"This account has no new free trial available. Review your billing status or choose a plan.",
		verification_required:
			"Sign in again with your verified email to start this trial.",
		unavailable:
			"Your trial could not be confirmed. Check its status or try again in a moment.",
	};
	return messages[state] ?? "Refresh your billing status to continue.";
}

export function secureTrialSetupUrl(value: string): string {
	const url = new URL(value);
	if (
		url.protocol !== "https:" ||
		url.hostname !== "checkout.stripe.com" ||
		url.username ||
		url.password
	)
		throw new Error("Secure card setup is unavailable. Please try again.");
	return url.href;
}
