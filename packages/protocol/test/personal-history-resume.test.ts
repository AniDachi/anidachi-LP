import { describe, expect, it } from "vitest";
import {
	buildPersonalHistoryResumeUrl,
	parsePersonalHistoryResumeUrl,
	PersonalHistoryResumeSchema,
} from "../src/personal-history-resume";
const sourceUrl = "https://www.crunchyroll.com/watch/EPISODE1";
const ownerUserId = "00000000-0000-4000-8000-000000000001";
describe("personal Resume launch contract", () => {
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
