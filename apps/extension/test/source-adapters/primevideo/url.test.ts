import { describe, expect, it } from "vitest";
import {
	parsePrimePageUrl,
	primeObservedLink,
	PRIME_VIDEO_HOSTS,
} from "../../../src/source-adapters/primevideo/url";
const id = "0GS9E1N0I97ENRMJPEH38ZYO1J";
describe("Prime browser routes without canonical identity assumptions", () => {
	it.each([
		`https://www.primevideo.com/region/na/detail/${id}?jic=x&ref_=a`,
		`https://www.primevideo.com/en_US/detail/a-title/${id}/ref=abc`,
		...[
			"www.amazon.com",
			"www.amazon.co.uk",
			"www.amazon.de",
			"www.amazon.co.jp",
			"www.amazon.ca",
			"www.amazon.in",
			"www.amazon.com.mx",
		].flatMap((host) => [
			`https://${host}/gp/video/detail/B0FX33MPNX`,
			`https://${host}/Hunting-Season/dp/B0FX33MPNX/ref=abc`,
		]),
	])("recognizes supported detail route %s", (url) =>
		expect(parsePrimePageUrl(url)).not.toBeNull());
	it.each([
		`http://www.primevideo.com/detail/${id}`,
		`https://www.primevideo.com:443/detail/${id}`,
		`https://u@www.primevideo.com/detail/${id}`,
		`https://www.amazon.com.evil/gp/video/detail/B0FX33MPNX`,
		`https://www.amazon.com/product-reviews/B0FX33MPNX`,
		`https://www.primevideo.com/foo/../detail/${id}`,
		`https://www.primevideo.com/%2e%2e/detail/${id}`,
		`https://www.primevideo.com/detail/${id}/${id}`,
		`https://www.primevideo.com/detail/${id}?titleId=other`,
		`https://www.amazon.fr/gp/video/detail/B0FX33MPNX`,
	])("rejects unsafe or unknown route %s", (url) =>
		expect(parsePrimePageUrl(url)).toBeNull());
	it("preserves observed same-origin transport while removing decorations", () => {
		expect(
			primeObservedLink(
				`/region/na/detail/${id}/ref=x?autoplay=1#x`,
				"https://www.primevideo.com",
			),
		).toBe(`https://www.primevideo.com/region/na/detail/${id}`);
		expect(
			primeObservedLink(
				"/gp/video/detail/B0FX33MPNX?ref_=x",
				"https://www.amazon.com",
			),
		).toBe("https://www.amazon.com/gp/video/detail/B0FX33MPNX");
		for (const value of [
			`//www.primevideo.com/detail/${id}`,
			`https://www.primevideo.com/detail/${id}`,
			`/foo/../detail/${id}`,
		])
			expect(primeObservedLink(value, "https://www.amazon.com")).toBeNull();
		expect(PRIME_VIDEO_HOSTS).toHaveLength(8);
	});
});
it.each([
	`https://www.primevideo.com/-/en/detail/${id}`,
	`https://www.primevideo.com/region/eu/-/de_DE/detail/${id}`,
	"https://www.amazon.de/-/de_DE/gp/video/detail/B0FX33MPNX",
])("supports bounded language routes %s", (value) =>
	expect(parsePrimePageUrl(value)).not.toBeNull());
it("accepts an encoded international title slug without normalizing encoded traversal", () => {
	expect(
		parsePrimePageUrl(`https://www.primevideo.com/detail/%C3%89pisode/${id}`)
			?.token,
	).toBe(id);
	for (const path of [
		`/detail/%2e%2e/${id}`,
		`/detail/%252e%252e/${id}`,
		`/detail/a%2Fb/${id}`,
		`/detail/${id}/extra`,
	])
		expect(parsePrimePageUrl(`https://www.primevideo.com${path}`)).toBeNull();
});
it("does not label ordinary shopping video as a Prime source", async () => {
	const { sourceProviderFromUrl } = await import(
		"../../../src/source-adapters/core/source-url"
	);
	expect(
		sourceProviderFromUrl("https://www.amazon.com/product-reviews/B0FX33MPNX"),
	).toBeNull();
	expect(
		sourceProviderFromUrl("https://www.amazon.com/gp/video/detail/B0FX33MPNX"),
	).toBe("primevideo");
});
