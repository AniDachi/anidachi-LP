import { WEB_HTTP_BASE } from "./constants";
import type { HostingDisplayState } from "./use-hosting-access";

export type HostingEntry = "trial" | "plans" | "check";
/** Account eligibility is an invitation to confirm, not a browser-marker verdict. */
export function getHostingEntry(state?: HostingDisplayState): HostingEntry {
	const access = state?.access;
	if (
		access?.hosting?.trialEligibility === "eligible" &&
		access.hostingOffer?.trialMode === "cardless"
	)
		return "trial";
	if (
		access?.hosting &&
		["used", "existing_account", "unavailable"].includes(
			access.hosting.trialEligibility,
		)
	)
		return "plans";
	return "check";
}

/** Navigation only: the website checks eligibility and confirms a cardless trial. */
export function getHostingOfferUrl(offer: HostingEntry): string {
	const path =
		offer !== "plans"
			? "/checkout?plan=plus&billing=monthly&confirm=trial"
			: "/pricing?plan=plus&billing=monthly";
	return new URL(path, WEB_HTTP_BASE).href;
}
