import { WEB_HTTP_BASE } from "./constants";

/** Navigation only: the website checks eligibility and confirms a cardless trial. */
export function getHostingOfferUrl(offer: "trial" | "plans"): string {
	const path = offer === "trial"
		? "/checkout?plan=plus&billing=monthly&confirm=trial"
		: "/pricing";
	return new URL(path, WEB_HTTP_BASE).href;
}
