import type { Metadata } from "next";
import Link from "next/link";
import {
	SeoGuideAnswer,
	SeoGuideRelated,
	SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const PAGE_PATH = "/crunchyroll-watch-history";
const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;
const HISTORY_HELP =
	"https://help.crunchyroll.com/hc/en-us/articles/22728708616852-Getting-started-on-Crunchyroll-website";

export const metadata: Metadata = {
	title: "Crunchyroll Watch History — Where It Is and What It Stores",
	description:
		"Crunchyroll watch history is under your avatar, then History. It lists episodes. Continue Watching is separate. AniDachi keeps its own progress when you clear that list.",
	alternates: { canonical: PAGE_PATH },
	openGraph: {
		title: "Crunchyroll Watch History",
		description:
			"Avatar, then History. Trash deletes one episode. Clear History deletes the list.",
		url: PAGE_PATH,
		images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Crunchyroll Watch History",
		description: "Find the episode list, then decide what to delete.",
		images: ["/opengraph-image.png"],
	},
};

const faq = [
	{
		question: "Where is Crunchyroll watch history?",
		answer:
			"On the Crunchyroll website, click your avatar and choose History. That page lists episodes you opened. The trash icon deletes one episode. Clear History deletes the list.",
	},
	{
		question: "Is Crunchyroll watch history the same as Continue Watching?",
		answer:
			"No. Continue Watching is the homepage row of series still in progress. History is the episode list under your avatar. Deleting an episode from History can change what that row offers.",
	},
	{
		question: "Does clearing Crunchyroll history delete AniDachi progress?",
		answer:
			"No. AniDachi stores episode progress from your own Crunchyroll or YouTube player on your AniDachi account. Clearing Crunchyroll History leaves that record as it is.",
	},
	{
		question: "Does watch history include payments?",
		answer:
			"No. History on this page is episodes. Membership and payment settings are elsewhere in the account.",
	},
];

const tocHeadings: TocHeading[] = [
	{ id: "answer", label: "Short answer", level: 2 },
	{ id: "row", label: "History and Continue Watching", level: 2 },
	{ id: "library", label: "Versus AniDachi", level: 2 },
	{ id: "faq", label: "FAQ", level: 2 },
];

export default function CrunchyrollWatchHistoryPage() {
	return (
		<SeoPageLayout
			breadcrumbs={[
				{ name: "Home", url: "/" },
				{
					name: "Watch Crunchyroll Together",
					url: "/watch-crunchyroll-together",
				},
				{ name: "Crunchyroll watch history", url: PAGE_PATH },
			]}
			title="Crunchyroll watch history"
			description="The episode list under your avatar, separate from Continue Watching."
			url={PAGE_PATH}
			datePublished="2026-10-08"
			dateModified="2026-10-08"
			faq={faq}
			headings={tocHeadings}
			articleImage={articleImage}
			aboveFoldCta
		>
			<SeoGuideTitle>Crunchyroll watch history</SeoGuideTitle>
			<h2 id="answer" className="scroll-mt-24">
				Short answer
			</h2>
			<SeoGuideAnswer>
				<p>
					On the Crunchyroll website, click your avatar and choose History. That
					list is the episodes you opened. The trash icon deletes one episode.
					Clear History deletes the whole list. Continue Watching, on the home
					page, is the row of series still in progress.
				</p>
			</SeoGuideAnswer>
			<h2
				id="row"
				className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
			>
				History and Continue Watching
			</h2>
			<p className="mb-4 leading-relaxed text-ani-muted">
				Crunchyroll documents the website path as avatar, History, then either
				the trash icon or Clear History. A confirmation appears at the top when
				you clear the list. Checked against{" "}
				<a
					href={HISTORY_HELP}
					className="text-brand-orange hover:underline"
					rel="noopener noreferrer"
					target="_blank"
				>
					Getting started on the Crunchyroll website
				</a>{" "}
				on 8 October 2026. AniDachi is not affiliated with Crunchyroll.
			</p>
			<p className="mb-8 leading-relaxed text-ani-muted">
				To take one series off the homepage row, use{" "}
				<Link
					href="/guides/how-to-remove-shows-from-continue-watching-on-crunchyroll"
					className="text-brand-orange hover:underline"
				>
					how to remove shows from Continue Watching
				</Link>
				. To wipe every title, use{" "}
				<Link
					href="/guides/how-to-clear-watch-history-on-crunchyroll"
					className="text-brand-orange hover:underline"
				>
					how to clear watch history on Crunchyroll
				</Link>
				.
			</p>
			<h2
				id="library"
				className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
			>
				Crunchyroll watch history versus AniDachi
			</h2>
			<p className="mb-4 leading-relaxed text-ani-muted">
				Crunchyroll History is Crunchyroll’s episode list. AniDachi does not
				read it, import it, or delete it.{" "}
				<Link href="/anime-tracker" className="text-brand-orange hover:underline">
					AniDachi
				</Link>{" "}
				records the title you are playing in desktop Chrome, on your AniDachi
				account, including a full YouTube watch page. Clearing the Crunchyroll
				list does not clear that record.
			</p>
			<p className="mb-8 leading-relaxed text-ani-muted">
				Recording and editing need your own Plus or Pro access, including a
				trial, plus permission in the extension. YouTube recording is a
				separate switch. Free can open saved history, Resume, and delete it.
				Details are on{" "}
				<Link href="/pricing" className="text-brand-orange hover:underline">
					pricing
				</Link>
				. Install from{" "}
				<Link href="/extension" className="text-brand-orange hover:underline">
					/extension
				</Link>
				, then pick a saved episode back up on{" "}
				<Link
					href="/guides/resume-anime"
					className="text-brand-orange hover:underline"
				>
					resume anime
				</Link>
				. A plan of titles you have not started is an{" "}
				<Link
					href="/guides/anime-watchlist"
					className="text-brand-orange hover:underline"
				>
					anime watchlist
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
						href: "/guides/how-to-clear-watch-history-on-crunchyroll",
						label: "Clear Crunchyroll watch history",
					},
					{
						href: "/watch-crunchyroll-together",
						label: "Crunchyroll watch party",
					},
					{ href: "/anime-tracker", label: "Anime tracker" },
				]}
			/>
		</SeoPageLayout>
	);
}
