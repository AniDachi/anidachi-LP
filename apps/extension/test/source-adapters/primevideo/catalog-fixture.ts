import { fixture, gtis, ids } from "./fixture";

// Small representative of sanitized Upload HTML: two preparations, four observed
// seasons, explicit pagination/counts and typed PLAY actions (disabled SSR buttons).
export function catalogFixture() {
	const f = fixture();
	const seasons = [
		{ full: gtis.anchor, compact: ids.anchor, number: 1 },
		{
			full: "amzn1.dv.gti.season-two",
			compact: "0SEASONTWO0000000000000000",
			number: 2,
		},
		{
			full: "amzn1.dv.gti.season-three",
			compact: "0SEASONTHREE00000000000000",
			number: 3,
		},
		{ full: gtis.season, compact: ids.season, number: 5 },
	];
	const counts = [2, 1, 1, 2];
	const pages = seasons.map((season, seasonIndex) => {
		const data = structuredClone(f.data);
		const { atf, btf } = data.init.preparations.body;
		const members = Array.from({ length: counts[seasonIndex]! }, (_, index) =>
			seasonIndex === 3
				? {
						full: index ? gtis.second : gtis.first,
						compact: index ? ids.second : ids.first,
					}
				: {
						full: `amzn1.dv.gti.episode-${seasonIndex}-${index}`,
						compact: `0EPISODE${seasonIndex}${index}`.padEnd(26, "0"),
					},
		);
		const self = (
			full: string,
			compact: string,
			titleType: string,
			sequenceNumber: number,
		) => ({
			gti: full,
			compactGTI: compact,
			link: `/detail/${compact}?ref_=title`,
			titleType,
			sequenceNumber,
			isLaunched: true,
		});
		const record = {
			[season.full]: self(season.full, season.compact, "season", season.number),
		};
		const seasonDetail = {
			title: `The Boys - Season ${season.number}`,
			parentTitle: "The Boys",
			titleType: "season",
			seasonNumber: season.number,
		};
		// Keep the existing playing SDK title only on the current season.
		const detail = Object.fromEntries(
			members.map((member, index) => [
				member.full,
				{
					title:
						seasonIndex === 3
							? index
								? "Teenage Kix"
								: "Fifteen Inches of Sheer Dynamite"
							: `Episode ${index + 1}`,
					titleType: "episode",
					episodeNumber: index + 1,
				},
			]),
		);
		const state = {
			pageTitleId: season.full,
			self: record,
			detail: { headerDetail: { [season.full]: seasonDetail }, detail: {} },
			seasons: {
				[season.full]: seasons.map((row) => ({
					seasonId: row.full,
					seasonLink: `/detail/${row.compact}?ref_=season`,
					sequenceNumber: row.number,
					isSelected: row.full === season.full,
				})),
			},
			episodeList: { actions: { pagination: [], episodePages: [] } },
		};
		Object.assign(atf, { state });
		Object.assign(btf, {
			state: {
				pageTitleId: season.full,
				self: Object.fromEntries(
					members.map((member, index) => [
						member.full,
						self(member.full, member.compact, "episode", index + 1),
					]),
				),
				detail: { headerDetail: {}, detail },
				seasons: {},
				episodeList: {
					cardTitleIds: members.map((member) => member.full),
					totalCardSize: members.length,
					actions: { pagination: [], episodePages: [{ isSelected: true }] },
				},
				action: {
					btf: Object.fromEntries(
						members.map((member) => [
							member.full,
							{
								messages: { entitlementType: "Entitled" },
								primaryActions: [
									{
										actionType: "PLAY",
										payload: {
											payloadType: "PLAYBACK",
											playback: {
												playbackID: member.full,
												playbackURL: `/detail/${member.compact}?autoplay=1&t=0`,
												isTrailer: false,
												videoMaterialType: "Feature",
											},
										},
									},
								],
							},
						]),
					),
				},
			},
		});
		return { data, season, members };
	});
	const current = pages[3]!;
	document.documentElement.lang = "en-us";
	document.getElementById("dv-web-page-hydration-data")!.textContent =
		JSON.stringify(current.data);
	for (const action of document.querySelectorAll(
		'[data-testid="episodes-playbutton"]',
	))
		action.setAttribute("disabled", "");
	const html = (index: number, lang = "en-us") =>
		`<html lang="${lang}"><body><script id="dv-web-page-hydration-data" type="application/json">${JSON.stringify(pages[index]!.data)}</script><a data-testid="episodes-playbutton" disabled></a></body></html>`;
	return { ...f, pages, html };
}
