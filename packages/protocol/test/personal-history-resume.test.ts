import { describe, expect, it } from "vitest";
import {
	buildPersonalHistoryResumeUrl,
	parsePersonalHistoryResumeUrl,
	PersonalHistoryResumeSchema,
} from "../src/personal-history-resume";
const sourceUrl = "https://www.crunchyroll.com/watch/EPISODE1";
const ownerUserId = "00000000-0000-4000-8000-000000000001";
describe("personal Resume launch contract", () => {
	it.each([
		"0FX1R3RCDS4LZSFJ9KPUBXJFAA",
		"B".repeat(26),
	])("opens Prime player %s while binding only canonical intent", async (id) => {
		const sourceUrl = `https://www.primevideo.com/detail/${id}`;
		const intentId = "00000000-0000-4000-8000-000000000002";
		const url = new URL(
			await buildPersonalHistoryResumeUrl({
				ownerUserId,
				accountGeneration: 2,
				provider: "primevideo",
				sourceUrl,
				currentTime: 42,
				now: 1000,
				intentId,
			}),
		);
		expect(url.search).toBe("?autoplay=1");
		const intent = parsePersonalHistoryResumeUrl(url.href, 1000);
		expect(intent).toMatchObject({
			sourceUrl,
			provider: "primevideo",
			accountGeneration: 2,
			currentTime: 42,
			intentId,
			issuedAt: 1000,
			expiresAt: 301000,
			ownerBinding: "6895929d1e3a197f62ecb76af6d66b4748e415181bf389b47e20669f458b1dfd",
		});
		expect(url.href).not.toContain(ownerUserId);
		url.search = "?ref_=atv_plr_detail_play";
		expect(parsePersonalHistoryResumeUrl(url.href, 1000)).toEqual(intent);
		url.pathname = `/detail/${"C".repeat(26)}`;
		expect(parsePersonalHistoryResumeUrl(url.href, 1000)).toBeNull();
		url.pathname = `/detail/${id}`;
		url.hostname = "www.netflix.com";
		expect(parsePersonalHistoryResumeUrl(url.href, 1000)).toBeNull();
	});
	it("normalizes decorated Prime input into canonical intent and preserves room exclusion", async () => {
		const sourceUrl = `https://www.primevideo.com/detail/${"A".repeat(26)}`;
		const input = {
			ownerUserId,
			accountGeneration: 1,
			provider: "primevideo" as const,
			currentTime: 42,
			now: 1000,
		};
		const url = new URL(
			await buildPersonalHistoryResumeUrl({
				...input,
				sourceUrl: `${sourceUrl}/?autoplay=0&ref_=history#other=preserved`,
			}),
		);
		expect(url.searchParams.getAll("autoplay")).toEqual(["1"]);
		expect(new URLSearchParams(url.hash.slice(1)).get("other")).toBe(
			"preserved",
		);
		expect(parsePersonalHistoryResumeUrl(url.href, 1000)?.sourceUrl).toBe(
			sourceUrl,
		);
		expect(parsePersonalHistoryResumeUrl(url.href, 999)).toBeNull();
		expect(parsePersonalHistoryResumeUrl(url.href, 301000)).toBeNull();
		const room = new URL(
			await buildPersonalHistoryResumeUrl({
				...input,
				sourceUrl: `${sourceUrl}#anidachiRoom=room-a&other=preserved`,
			}),
		);
		expect(room.search).toBe("?autoplay=1");
		expect(new URLSearchParams(room.hash.slice(1)).get("anidachiRoom")).toBe(
			"room-a",
		);
		expect(parsePersonalHistoryResumeUrl(room.href, 1000)).toBeNull();
	});
	it.each([
		"http://www.primevideo.com/detail/AAAAAAAAAAAAAAAAAAAAAAAAAA",
		"https://user:pass@www.primevideo.com/detail/AAAAAAAAAAAAAAAAAAAAAAAAAA",
		"https://www.primevideo.com:443/detail/AAAAAAAAAAAAAAAAAAAAAAAAAA",
		"https://www.primevideo.com/other/../detail/AAAAAAAAAAAAAAAAAAAAAAAAAA",
		"https://www.primevideo.com/detail/aaaaaaaaaaaaaaaaaaaaaaaaaa",
		"https://www.primevideo.com/detail/SHORT",
		"https://www.primevideo.com.evil.test/detail/AAAAAAAAAAAAAAAAAAAAAAAAAA",
		"https://www.netflix.com/watch/12345678",
	])("rejects unsafe or mismatched raw Prime source %s", async (sourceUrl) => {
		await expect(
			buildPersonalHistoryResumeUrl({
				ownerUserId,
				accountGeneration: 1,
				provider: "primevideo",
				sourceUrl,
				currentTime: 1,
			}),
		).rejects.toThrow();
	});
	it.each([
		["crunchyroll", "https://www.crunchyroll.com/watch/EPISODE1"],
		["youtube", "https://www.youtube.com/watch?v=abcdefghijk"],
		["netflix", "https://www.netflix.com/watch/12345678"],
	] as const)("preserves %s navigation and canonical intent", async (provider, sourceUrl) => {
		const url = new URL(
			await buildPersonalHistoryResumeUrl({
				ownerUserId,
				accountGeneration: 1,
				provider,
				sourceUrl,
				currentTime: 42,
				now: 1000,
			}),
		);
		expect(parsePersonalHistoryResumeUrl(url.href, 1000)?.sourceUrl).toBe(
			sourceUrl,
		);
		url.hash = "";
		expect(url.href).toBe(sourceUrl);
	});
	it("strictly binds a single safe source, owner digest, generation and bounded lifetime", async () => {
		const url = await buildPersonalHistoryResumeUrl({
			ownerUserId,
			accountGeneration: 2,
			provider: "crunchyroll",
			sourceUrl,
			currentTime: 123,
			now: 1000,
		});
		const parsed = parsePersonalHistoryResumeUrl(url, 1000)!;
		expect(parsed).toMatchObject({
			accountGeneration: 2,
			sourceUrl,
			currentTime: 123,
			expiresAt: 301000,
		});
		expect(url).not.toContain(ownerUserId);
		expect(
			PersonalHistoryResumeSchema.safeParse({ ...parsed, secret: "unknown" })
				.success,
		).toBe(false);
		expect(
			PersonalHistoryResumeSchema.safeParse({ ...parsed, expiresAt: 301001 })
				.success,
		).toBe(false);
		expect(
			parsePersonalHistoryResumeUrl(
				url.replace("EPISODE1#", "EPISODE2#"),
				1000,
			),
		).toBeNull();
		expect(parsePersonalHistoryResumeUrl(url, 301000)).toBeNull();
	});
	it("normalizes provider locale, slug, query redirects while preserving content variant", async () => {
		const url = await buildPersonalHistoryResumeUrl({
			ownerUserId,
			accountGeneration: 1,
			provider: "crunchyroll",
			sourceUrl: `${sourceUrl}#other=preserved`,
			currentTime: 10,
			now: 1000,
		});
		const redirect = new URL(url);
		redirect.pathname = "/en-US/watch/EPISODE1/localized-title";
		redirect.search = "?ref=home";
		expect(
			parsePersonalHistoryResumeUrl(redirect.toString(), 1000)?.sourceUrl,
		).toBe(sourceUrl);
		redirect.pathname = "/en-US/watch/OTHER_DUB/localized-title";
		expect(parsePersonalHistoryResumeUrl(redirect.toString(), 1000)).toBeNull();
		redirect.hostname = "youtube.com";
		expect(parsePersonalHistoryResumeUrl(redirect.toString(), 1000)).toBeNull();
	});
	it.each([
		"http://www.crunchyroll.com/watch/EPISODE1",
		"https://attacker.test/watch/EPISODE1",
		"https://user:pass@www.crunchyroll.com/watch/EPISODE1",
	])("rejects unsafe source %s", async (sourceUrl) => {
		await expect(
			buildPersonalHistoryResumeUrl({
				ownerUserId,
				accountGeneration: 1,
				provider: "crunchyroll",
				sourceUrl,
				currentTime: 1,
			}),
		).rejects.toThrow();
	});
});
