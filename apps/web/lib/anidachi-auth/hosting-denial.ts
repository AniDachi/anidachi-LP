import { HOST_SUBSCRIPTION_REQUIRED } from "@anidachi/protocol";

export function hostingDeniedResponse(
	pricingUrl = "https://www.anidachi.app/pricing",
	isHost = true,
) {
	const message = isHost
		? "You can join a room for free. To create your own room, choose Plus or Pro on the plans page."
		: "This host's room is closing. You can join another room hosted on Plus or Pro for free.";
	return {
		code: HOST_SUBSCRIPTION_REQUIRED,
		error: message,
		message,
		pricingUrl,
	};
}
