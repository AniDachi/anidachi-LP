import type { Metadata } from "next";
import Link from "next/link";
import { HowToJsonLd } from "@/components/json-ld";
import {
	SeoGuideAnswer,
	SeoGuideRelated,
	SeoGuideSteps,
	SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const PAGE_PATH =
	"/guides/how-to-remove-anime-from-continue-watching-on-crunchyroll";
const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;
const MARK_WATCHED_HELP =
	"https://help.crunchyroll.com/article/how-do-i-mark-episodes-seasons-and-shows-as-watched";

const howToSteps = [
	{
		name: "Open the series page",
		text: "Search for the anime and open its series page, not only the homepage card.",
	},
	{
		name: "Mark the series as watched",
		text: "Open the three-dot menu in the top right and choose Mark Series as Watched.",
	},
	{
		name: "Mark a leftover season",
		text: "If one season remains, open that season's menu and choose Mark Season as Watched.",
	},
];

export const metadata: Metadata = {
	title: "How to Remove Anime from Continue Watching on Crunchyroll",
	description:
		"Remove an anime from Crunchyroll Continue Watching: Mark Series as Watched on the series page, or Mark Season as Watched if one season is stuck.",
	alternates: { canonical: PAGE_PATH },
	openGraph: {
		title: "Remove Anime from Continue Watching on Crunchyroll",
		description:
			"Mark the series, then a leftover season, then the episode if the card stays.",
		url: PAGE_PATH,
		images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Remove Anime from Continue Watching on Crunchyroll",
		description: "Series first, then the season that is still on the row.",
		images: ["/opengraph-image.png"],
	},
};

const faq = [
	{
		question: "How do I remove an anime from Continue Watching on Crunchyroll?",
		answer:
			"Open the series page, use the three-dot menu in the top right, and choose Mark Series as Watched. If one season stays, use Mark Season as Watched in that season's menu.",
	},
	{
		question: "What if only one episode is on the card?",
		answer:
			"Open that episode's three-dot menu and choose Mark as Watched. On iPhone, Crunchyroll also documents a long-press, then Mark as Watched.",
	},
	{
		question: "Do movies and OVAs use the same row?",
		answer:
			"Yes. A film or OVA you started can sit on Continue Watching. Open its page and mark it watched, or delete its history entry.",
	},
	{
		question: "How do I remove every anime at once?",
		answer:
			"Clear History deletes the whole episode list, including shows you are still watching. Use that only when the entire row should go.",
	},
];

const tocHeadings: TocHeading[] = [
	{ id: "answer", label: "Short answer", level: 2 },
	{ id: "series", label: "Series, season, episode", level: 2 },
	{ id: "all", label: "Every title", level: 2 },
	{ id: "faq", label: "FAQ", level: 2 },
];

export default function HowToRemoveAnimeFromContinueWatchingPage() {
	return (
		<>
			<HowToJsonLd
				name="How to remove anime from Continue Watching on Crunchyroll"
				description="Mark an anime series as watched, then mark a leftover season if the card stays."
				steps={howToSteps}
			/>
			<SeoPageLayout
				breadcrumbs={[
					{ name: "Home", url: "/" },
					{
						name: "Watch Crunchyroll Together",
						url: "/watch-crunchyroll-together",
					},
					{ name: "Remove anime from Continue Watching", url: PAGE_PATH },
				]}
				title="How to remove anime from Continue Watching on Crunchyroll"
				description="Mark the series, then any season still sitting on the row."
				url={PAGE_PATH}
				datePublished="2026-10-08"
				dateModified="2026-10-08"
				faq={faq}
				headings={tocHeadings}
				articleImage={articleImage}
				aboveFoldCta
			>
				<SeoGuideTitle>
					How to remove anime from Continue Watching on Crunchyroll
				</SeoGuideTitle>
				<h2 id="answer" className="scroll-mt-24">
					Short answer
				</h2>
				<SeoGuideAnswer>
					<p>
						Open the anime's series page and choose Mark Series as Watched from
						the three-dot menu in the top right. A multi-season show can leave
						one season on the row. Open that season's menu and choose Mark
						Season as Watched.
					</p>
				</SeoGuideAnswer>
				<h2
					id="series"
					className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
				>
					Series, season, episode
				</h2>
				<SeoGuideSteps steps={howToSteps} />
				<p className="mb-8 leading-relaxed text-ani-muted">
					Crunchyroll's mark-as-watched article, published 28 August 2026, is
					the source for those menus. Checked 8 October 2026:{" "}
					<a
						href={MARK_WATCHED_HELP}
						className="text-brand-orange hover:underline"
						rel="noopener noreferrer"
						target="_blank"
					>
						How do I mark episodes, seasons, and shows as watched?
					</a>
					. The same controls for any show, not only anime wording, are on{" "}
					<Link
						href="/guides/how-to-remove-shows-from-continue-watching-on-crunchyroll"
						className="text-brand-orange hover:underline"
					>
						how to remove shows from Continue Watching
					</Link>
					. AniDachi is not affiliated with Crunchyroll.
				</p>
				<h2
					id="all"
					className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
				>
					Every title
				</h2>
				<p className="mb-8 leading-relaxed text-ani-muted">
					Clear History removes the whole episode list. Steps:{" "}
					<Link
						href="/guides/how-to-clear-watch-history-on-crunchyroll"
						className="text-brand-orange hover:underline"
					>
						how to clear watch history on Crunchyroll
					</Link>
					. Where that list lives:{" "}
					<Link
						href="/crunchyroll-watch-history"
						className="text-brand-orange hover:underline"
					>
						Crunchyroll watch history
					</Link>
					.
				</p>
				<SeoGuideRelated
					links={[
						{
							href: "/guides/how-to-remove-shows-from-continue-watching-on-crunchyroll",
							label: "Remove shows from Continue Watching",
						},
						{
							href: "/crunchyroll-watch-history",
							label: "Crunchyroll watch history",
						},
						{
							href: "/watch-crunchyroll-together",
							label: "Crunchyroll watch party",
						},
					]}
				/>
			</SeoPageLayout>
		</>
	);
}
