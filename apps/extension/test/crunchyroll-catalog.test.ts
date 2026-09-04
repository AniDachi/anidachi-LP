import { describe, expect, it } from "vitest";
import { normalizeCrunchyrollCatalog } from "../src/source-adapters/crunchyroll/catalog";
import availabilityFixture from "./fixtures/crunchyroll/catalog-availability.json";
import fixture from "./fixtures/crunchyroll/catalog-complete-multiseason.json";

const NOW = "2026-09-05T12:00:00.000Z";

function input(): any {
	const value = structuredClone(fixture);
	return {
		seriesId: value.seriesId,
		title: "HAIKYU!!",
		region: value.region,
		requestedLocale: "en-US",
		audioLocale: "ja-JP",
		subtitleLocales: ["en-US"],
		observedAt: NOW,
		contextUnchanged: true,
		seasonsResponse: value.seasonsResponse,
		episodeResponses: value.episodeResponses,
	};
}

describe("normalizeCrunchyrollCatalog", () => {
	it("normalizes canonical identities and variants in deterministic provider order", () => {
		const result = normalizeCrunchyrollCatalog(input());
		expect(result.completeness).toBe("complete");
		expect(result.reasons).toEqual([]);
		expect(result.snapshot).toMatchObject({
			provider: "crunchyroll",
			titleKey: `crunchyroll:series:${fixture.seriesId}`,
			context: { region: "VN", requestedLocale: "en-US", observedAt: NOW },
			seasons: [
				{ seasonKey: "crunchyroll:season:GY8VM8MWY|S00111803", order: 0 },
				{
					seasonKey: "crunchyroll:season:GY8VM8MWY|S00111804",
					order: 1,
					episodes: [
						{
							episodeKey: "crunchyroll:episode:GY8VM8MWY|S00111804|E1",
							order: 0,
							watchVariants: [
								{
									providerContentId: "GRP8P9XGR",
									order: 0,
									sourceUrl: "https://www.crunchyroll.com/watch/GRP8P9XGR",
								},
								{
									providerContentId: "GWDU78GG3",
									order: 1,
									sourceUrl: "https://www.crunchyroll.com/watch/GWDU78GG3",
								},
							],
						},
					],
				},
			],
		});
		expect(result.hashInput).toBe(JSON.stringify(result.snapshot));
		expect(
			normalizeCrunchyrollCatalog({
				...input(),
				seasonsResponse: {
					...fixture.seasonsResponse,
					data: [...fixture.seasonsResponse.data].reverse(),
				},
			}).hashInput,
		).toBe(result.hashInput);
	});

	it("checks declared raw totals before canonical collapse", () => {
		const duplicate = fixture.seasonsResponse.data[0]!;
		const result = normalizeCrunchyrollCatalog({
			...input(),
			seasonsResponse: {
				...fixture.seasonsResponse,
				total: 2,
				data: [duplicate, structuredClone(duplicate)],
			},
		});
		expect(result.completeness).toBe("complete");
		expect(result.snapshot.seasons).toHaveLength(1);

		const mismatch = normalizeCrunchyrollCatalog({
			...input(),
			seasonsResponse: { ...fixture.seasonsResponse, total: 3 },
		});
		expect(mismatch).toMatchObject({
			completeness: "partial",
			reasons: ["RAW_COUNT_MISMATCH"],
		});
	});

	it("keeps distinct provider identifiers separate even when labels and numbers match", () => {
		const value = input();
		value.seasonsResponse.data[1] = {
			...value.seasonsResponse.data[1]!,
			title: value.seasonsResponse.data[0]!.title,
			season_number: value.seasonsResponse.data[0]!.season_number,
		};
		expect(normalizeCrunchyrollCatalog(value).snapshot.seasons).toHaveLength(2);
	});

	it("marks conflicting aliases and unknown classifications partial", () => {
		const value = input();
		const response = value.episodeResponses.GYDQCGQ03;
		response.data.push({
			...response.data[0]!,
			identifier: "GY8VM8MWY|S00111804|E2",
		});
		response.total = 2;
		expect(normalizeCrunchyrollCatalog(value)).toMatchObject({
			completeness: "partial",
			reasons: ["ALIAS_CONFLICT"],
		});

		const unknown = input();
		delete (
			unknown.episodeResponses.GYZXCM252.data[0] as Record<string, unknown>
		).premium_available_date;
		delete (
			unknown.episodeResponses.GYZXCM252.data[0] as Record<string, unknown>
		).episode_air_date;
		expect(normalizeCrunchyrollCatalog(unknown).completeness).toBe("partial");
	});

	it("classifies sentinel, future, expired, and clips without confusing display numbering with order", () => {
		const base = input();
		const cases = availabilityFixture.derivedCases;
		const rows = [availabilityFixture.liveSentinel, ...cases].map(
			(value, index) => {
				const row = value as Record<string, any>;
				return {
					...row,
					id: row.id ?? `CASE${index}`,
					identifier: String(
						row.identifier ?? `SERIES|SEASON|E${index}`,
					).replace(/^.*\|.*\|/, "GY8VM8MWY|S00111803|"),
					title: row.case ?? "Live sentinel",
					sequence_number: row.sequence_number ?? index,
					versions: [
						{
							guid: row.id ?? `CASE${index}`,
							season_guid: "GYZXCM252",
							original: index === 0,
						},
					],
				};
			},
		);
		base.episodeResponses.GYZXCM252 = {
			total: rows.length,
			meta: { versions_considered: true },
			data: rows,
		};
		const result = normalizeCrunchyrollCatalog(base);
		expect(result.completeness).toBe("complete");
		const episodes = result.snapshot.seasons[0]!.episodes;
		expect(
			episodes.some((episode) =>
				episode.providerEpisodeIdentifier.endsWith("CLIP"),
			),
		).toBe(false);
		expect(
			episodes.find((episode) =>
				episode.providerEpisodeIdentifier.endsWith("FUTURE"),
			)?.available,
		).toBe(false);
		expect(
			episodes.find((episode) =>
				episode.providerEpisodeIdentifier.endsWith("EXPIRED"),
			)?.available,
		).toBe(false);
		expect(
			episodes.find((episode) =>
				episode.providerEpisodeIdentifier.endsWith("E3"),
			)?.available,
		).toBe(true);
		expect(
			episodes.find((episode) =>
				episode.providerEpisodeIdentifier.endsWith("E12.5"),
			)?.episodeNumber,
		).toBe(12.5);
	});

	it("supports complete zero availability, locale fallback, and makes failures or limits partial", () => {
		const unavailable = input();
		for (const response of Object.values(
			unavailable.episodeResponses,
		) as Array<{ data: Array<Record<string, any>> }>) {
			for (const episode of response.data)
				episode.episode_air_date = "2099-01-01T00:00:00Z";
		}
		const zero = normalizeCrunchyrollCatalog(unavailable);
		expect(zero.completeness).toBe("complete");
		expect(
			zero.snapshot.seasons
				.flatMap((season) => season.episodes)
				.every((episode) => !episode.available),
		).toBe(true);

		const fallback = normalizeCrunchyrollCatalog({
			...input(),
			requestedLocale: "ar-SA",
		});
		expect(fallback.snapshot.seasons[0]?.title).toBe("HAIKYU!!");
		expect(fallback.snapshot.context.requestedLocale).toBe("ar-SA");

		expect(
			normalizeCrunchyrollCatalog({ ...input(), region: null }).completeness,
		).toBe("partial");
		expect(
			normalizeCrunchyrollCatalog({ ...input(), contextUnchanged: false })
				.completeness,
		).toBe("partial");
		expect(
			normalizeCrunchyrollCatalog({ ...input(), episodeResponses: {} })
				.completeness,
		).toBe("partial");
		expect(
			normalizeCrunchyrollCatalog({
				...input(),
				seasonsResponse: {
					...fixture.seasonsResponse,
					data: Array.from({ length: 101 }, (_, index) => ({
						...fixture.seasonsResponse.data[0]!,
						id: `S${index}`,
						identifier: `${fixture.seriesId}|S${index}`,
					})),
					total: 101,
				},
			}).completeness,
		).toBe("partial");
	});
});
