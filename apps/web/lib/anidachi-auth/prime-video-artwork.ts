/** Exact observed Prime artwork hosts. Source URL admission is independent. */
export function isPrimeVideoArtworkUrl(value: string | null): boolean {
	if (value === null) return true;
	if (
		value.length > 2048 ||
		!/^https:\/\/(?:images-na\.ssl-images-amazon\.com|m\.media-amazon\.com)\/images\/[^#\s\\]*$/.test(
			value,
		)
	)
		return false;
	if (/(%2e|\/[.]{1,2}(\/|[?]|$))/i.test(value)) return false;
	try {
		const url = new URL(value);
		return (
			url.protocol === "https:" &&
			!url.username &&
			!url.password &&
			!url.port &&
			["images-na.ssl-images-amazon.com", "m.media-amazon.com"].includes(
				url.hostname,
			) &&
			url.pathname.startsWith("/images/") &&
			!url.hash
		);
	} catch {
		return false;
	}
}
