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
	it("resolves explicit market without rewriting or guessing a foreign exact link", () => {
		const resolve = protocol.resolvePrimeLaunch;
		expect(
			resolve({ contentId: id, navigation, marketplace: "amazon.com" }),
		).toMatchObject({ status: "ready", url: navigation.routes[0]!.url });
		expect(
			resolve({ contentId: id, navigation, marketplace: "amazon.de" }),
		).toMatchObject({ status: "regional-route-unknown" });
		expect(resolve({ contentId: id, navigation })).toMatchObject({
			status: "choice-required",
		});
		expect(resolve({ contentId: id })).toEqual({
			status: "ready",
			url: source.sourceUrl,
		});
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
