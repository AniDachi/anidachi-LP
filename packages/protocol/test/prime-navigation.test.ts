import { describe, it, expect } from "vitest";
import * as protocol from "../src/index";
const id = "0IUGS56V361WRU60PCC5XH5D8Z";
const source = {
	provider: "primevideo",
	sourceUrl: `https://www.primevideo.com/detail/${id}`,
	canonicalUrl: `https://www.primevideo.com/detail/${id}`,
	videoFingerprint: `primevideo|detail/${id}`,
};
const navigation = {
	contentId: id,
	routes: [
		{
			url: "https://www.amazon.com/gp/video/detail/B0FX2ZCPFK",
			observedAt: "2026-11-16T00:00:00Z",
		},
	],
};
describe("Prime navigation contract", () => {
	it("preserves exact observed Amazon route alongside canonical identity", () => {
		expect(
			protocol.RoomSourceDescriptorSchema.safeParse({
				...source,
				primeNavigation: navigation,
			}),
		).toEqual({
			success: true,
			data: { ...source, primeNavigation: navigation },
		});
	});
	it("rejects wrong content binding, non-Prime and unsafe raw routes", () => {
		for (const url of [
			"https://www.amazon.com:443/gp/video/detail/B0FX2ZCPFK",
			"https://www.amazon.com/gp/video/../video/detail/B0FX2ZCPFK",
			"https://www.amazon.com.evil.test/gp/video/detail/B0FX2ZCPFK",
			"https://www.amazon.com/gp/video/detail/B0FX2ZCPFK?token=secret",
			"https://www.amazon.com/gp/video/detail/B0FX2ZCPFK#secret",
		])
			expect(
				protocol.RoomSourceDescriptorSchema.safeParse({
					...source,
					primeNavigation: {
						...navigation,
						routes: [{ url, observedAt: "2026-11-16T00:00:00Z" }],
					},
				}).success,
			).toBe(false);
		expect(
			protocol.RoomSourceDescriptorSchema.safeParse({
				...source,
				primeNavigation: {
					...navigation,
					contentId: "0GS9E1N0I97ENRMJPEH38ZYO1J",
				},
			}).success,
		).toBe(false);
	});
	it.each(
		protocol.PRIME_VIDEO_DOMAIN_ROOTS,
	)("opens the supplied %s route directly", (domain) => {
		const url =
			domain === "primevideo.com"
				? `https://www.${domain}/region/na/detail/${id}`
				: `https://www.${domain}/-/de/gp/video/detail/B0FX2ZCPFK`;
		expect(
			protocol.resolvePrimeLaunch({
				contentId: id,
				navigation: {
					contentId: id,
					routes: [{ url, observedAt: "2026-11-16T00:00:00Z" }],
				},
			}),
		).toEqual({ status: "ready", url });
	});
	it("uses canonical Prime only without an observed route and rejects a different episode", () => {
		expect(protocol.resolvePrimeLaunch({ contentId: id })).toEqual({
			status: "ready",
			url: source.sourceUrl,
		});
		expect(() =>
			protocol.resolvePrimeLaunch({
				contentId: "0GS9E1N0I97ENRMJPEH38ZYO1J",
				navigation,
			}),
		).toThrow("Prime navigation identity mismatch");
	});
	it("preserves the supplied primary route instead of inferring one from observation dates", () => {
		const multiple = {
			...navigation,
			routes: [
				...navigation.routes,
				{
					url: source.sourceUrl,
					observedAt: "2026-11-17T00:00:00Z",
				},
			],
		};
		expect(
			protocol.resolvePrimeLaunch({ contentId: id, navigation: multiple }).url,
		).toBe(navigation.routes[0]!.url);
		const reordered = { ...multiple, routes: [...multiple.routes].reverse() };
		expect(
			protocol.resolvePrimeLaunch({ contentId: id, navigation: reordered }).url,
		).toBe(source.sourceUrl);
		expect(protocol.samePrimeNavigation(multiple, reordered)).toBe(false);
	});
});

it("bounds hints, binds compact routes and treats timestamps as observation metadata", () => {
	expect(
		protocol.PrimeNavigationSchema.safeParse({
			...navigation,
			routes: [
				{
					...navigation.routes[0],
					url: `https://www.primevideo.com/detail/${"A".repeat(26)}`,
				},
			],
		}).success,
	).toBe(false);
	expect(
		protocol.PrimeNavigationSchema.safeParse({
			...navigation,
			routes: Array(9).fill(navigation.routes[0]),
		}).success,
	).toBe(false);
	expect(
		protocol.PrimeNavigationSchema.safeParse({
			...navigation,
			routes: [
				{
					...navigation.routes[0],
					url: "https://www.amazon.com/" + "x".repeat(2048) + "/dp/B0FX2ZCPFK",
				},
			],
		}).success,
	).toBe(false);
	expect(
		protocol.RoomSourceDescriptorSchema.safeParse({
			provider: "netflix",
			sourceUrl: "https://www.netflix.com/watch/1234",
			canonicalUrl: "https://www.netflix.com/watch/1234",
			videoFingerprint: "netflix|watch/1234",
			primeNavigation: navigation,
		}).success,
	).toBe(false);
	expect(
		protocol.samePrimeNavigation(navigation, {
			...navigation,
			routes: [
				{ ...navigation.routes[0]!, observedAt: "2026-11-17T00:00:00Z" },
			],
		}),
	).toBe(true);
});
