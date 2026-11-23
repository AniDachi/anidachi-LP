import { stripPrimeNavigation } from "@anidachi/protocol";
/** Old strict v3 clients opt in independently of providerVersion. */
export function primeNavigationResponse<T>(
	request: { headers: Headers },
	value: T,
): T {
	return request.headers.get("x-anidachi-prime-navigation") === "1"
		? value
		: stripPrimeNavigation(value);
}
