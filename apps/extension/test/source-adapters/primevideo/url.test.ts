import { describe, expect, it } from "vitest";
import {
	parsePrimePageUrl,
	primeObservedLink,
	hasPrimeBrowserHost,
	PRIME_CONTENT_MATCHES,
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

// Synthetic DNS fixtures exercise the bounded families; no live-host support claim.
const families = [
	"primevideo.com",
	"amazon.com",
	"amazon.co.uk",
	"amazon.de",
	"amazon.co.jp",
	"amazon.ca",
	"amazon.in",
	"amazon.com.mx",
];
const familyRoutes = families.flatMap((root) =>
	[root, `www.${root}`, `synthetic-2.edge3.${root}`].flatMap((host) =>
		root === "primevideo.com"
			? [
					`https://${host}/detail/${id}`,
					`https://${host}/region/eu/-/de_DE/detail/${id}`,
				]
			: [
					`https://${host}/gp/video/detail/B0FX33MPNX`,
					`https://${host}/-/de_DE/gp/video/detail/B0FX33MPNX`,
					`https://${host}/Title/dp/B0FX33MPNX`,
				],
	),
);
function matchesPrimeContentScript(value: string) {
	const url = new URL(value);
	// Chrome's *.root host covers the apex and dot-separated subdomains.
	return PRIME_CONTENT_MATCHES.some((pattern) => {
		const match = /^https:\/\/([^/]+)(\/.*)$/.exec(pattern)!;
		const root = match[1]!.replace(/^\*\./, "");
		const hostMatches = match[1]!.startsWith("*.")
			? url.hostname === root || url.hostname.endsWith(`.${root}`)
			: url.hostname === root;
		const path = new RegExp(
			`^${match[2]!
				.split("*")
				.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
				.join(".*")}$`,
		);
		return hostMatches && path.test(url.pathname);
	});
}
it.each(familyRoutes)("recognizes the official DNS family and permits script injection at %s", (value) => {
	expect(parsePrimePageUrl(value)).not.toBeNull();
	expect(matchesPrimeContentScript(value)).toBe(true);
});

it.each([
	["https://www.amazon.com/Amazon-Video/b/?node=2858778011", true],
	["https://www.amazon.de/-/en/Amazon-Video/b?node=123", true],
	["https://www.amazon.com/Books/b/?node=283155", false],
	["https://www.amazon.com/b/?node=2858778011", false],
])("keeps catalogue bootstrap separate from playable URLs at %s", (url, enabled) => {
	expect(matchesPrimeContentScript(url)).toBe(enabled);
	expect(parsePrimePageUrl(url)).toBeNull();
});
it("normalizes hostname case without accepting non-DNS authority syntax", () => {
	expect(
		parsePrimePageUrl(`https://Synthetic-2.EDGE3.PrimeVideo.COM/detail/${id}`)
			?.url.hostname,
	).toBe("synthetic-2.edge3.primevideo.com");
	for (const host of [
		"evilprimevideo.com",
		"primevideo.com.evil",
		"amazon.com.evil",
		"notamazon.com",
		".primevideo.com",
		"a..primevideo.com",
		"-a.primevideo.com",
		"a-.primevideo.com",
		"a_b.primevideo.com",
		"primevideo.com.",
		`${"x".repeat(64)}.primevideo.com`,
		`${("x".repeat(60) + ".").repeat(4)}primevideo.com`,
		"%77ww.primevideo.com",
		"www%2eprimevideo.com",
		"u@primevideo.com",
		"primevideo.com:443",
		"primevideo.com:0443",
		"primevideo.com:80",
	]) {
		expect(parsePrimePageUrl(`https://${host}/detail/${id}`), host).toBeNull();
	}
	expect(
		parsePrimePageUrl(`https://synthetic-2.amazon.com/detail/${id}`),
	).toBeNull();
	expect(
		parsePrimePageUrl(
			`https://synthetic-2.primevideo.com/gp/video/detail/${id}`,
		),
	).toBeNull();
	expect(
		hasPrimeBrowserHost(`http://synthetic-2.edge3.primevideo.com/not-a-detail`),
	).toBe(true);
	expect(
		parsePrimePageUrl(`http://synthetic-2.edge3.primevideo.com/detail/${id}`),
	).toBeNull();
});
it("keeps same-origin observations inside a synthetic subdomain", () => {
	const origin = "https://synthetic-2.edge3.primevideo.com";
	expect(primeObservedLink(`/region/na/detail/${id}?ref_=x`, origin)).toBe(
		`${origin}/region/na/detail/${id}`,
	);
	for (const host of [
		"primevideo.com",
		"www.primevideo.com",
		"sibling.edge3.primevideo.com",
		"synthetic-2.edge3.amazon.com",
	])
		expect(
			primeObservedLink(`https://${host}/detail/${id}`, origin),
		).toBeNull();
	for (const origin of [
		"https://synthetic-2.primevideo.com:443",
		"https://synthetic-2.primevideo.com.",
		"https://u@synthetic-2.primevideo.com",
	])
		expect(primeObservedLink(`/detail/${id}`, origin)).toBeNull();
});
