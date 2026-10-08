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
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const articleImage = `${SITE_URL}/opengraph-image.png`;
const PAGE_PATH =
	"/guides/how-to-remove-shows-from-continue-watching-on-crunchyroll";

const MARK_WATCHED_HELP =
	"https://help.crunchyroll.com/article/how-do-i-mark-episodes-seasons-and-shows-as-watched";
const HISTORY_HELP =
	"https://help.crunchyroll.com/hc/en-us/articles/22728708616852-Getting-started-on-Crunchyroll-website";

export const metadata: Metadata = {
	title: "How to Remove Shows from Continue Watching on Crunchyroll",
	description:
		"Remove one show from Crunchyroll Continue Watching, or clear watch history. Mark the series as watched, or delete episodes from History.",
	alternates: { canonical: PAGE_PATH },
	openGraph: {
		title: "Remove Shows from Continue Watching on Crunchyroll",
		description:
			"Mark a series as watched, or delete its episodes from Crunchyroll History. Clear History wipes every title.",
		url: PAGE_PATH,
		images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Remove Shows from Continue Watching on Crunchyroll",
		description:
			"Mark the series as watched, or delete its episodes from History.",
		images: ["/opengraph-image.png"],
	},
};

const faq = [
	{
		question: "How do I remove a show from Continue Watching on Crunchyroll?",
		answer:
			"On the series page, open the three-dot menu in the top right and choose Mark Series as Watched. If the homepage card stays, open your avatar, choose History, and delete that show’s episodes with the trash icon. Crunchyroll documents both controls. Checked 7 October 2026.",
	},
	{
		question: "How do I clear Crunchyroll watch history?",
		answer:
			"On the Crunchyroll website, click your avatar, then History, then Clear History. A confirmation appears at the top. That removes every title from watch history, including shows you are still in the middle of.",
	},
	{
		question:
			"What is the difference between removing one show and clearing history?",
		answer:
			"Mark Series as Watched, or the trash icon on that show’s episodes, targets one series. Clear History deletes the whole watch history in one click.",
	},
	{
		question: "Does Clear History cancel my Crunchyroll membership?",
		answer:
			"No. Clear History is the button on the History page. Membership and payment settings live elsewhere in the account.",
	},
	{
		question: "Where is Crunchyroll watch history?",
		answer:
			"On the website, click your avatar and choose History. That page lists episodes. The trash icon deletes one episode. Clear History deletes the list.",
	},
	{
		question:
			"Does cleaning Continue Watching delete my AniDachi watch history?",
		answer:
			"No. Crunchyroll’s homepage row and AniDachi’s Watch Library are separate lists. Cleaning Continue Watching leaves AniDachi progress in place. Recording and editing AniDachi progress need your own Plus or Pro access. Saved history, Resume, and deletion stay available on Free.",
	},
];

const tocHeadings: TocHeading[] = [
	{ id: "answer", label: "Short answer", level: 2 },
	{ id: "remove-one", label: "Remove one show", level: 2 },
	{ id: "clear-history", label: "Clear watch history", level: 2 },
	{ id: "stuck", label: "If the card stays", level: 2 },
	{ id: "resume", label: "AniDachi Resume", level: 2 },
	{ id: "related", label: "Related guides", level: 2 },
	{ id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
	{
		name: "Open the series page",
		text: "Search for the show on Crunchyroll and open its series page.",
	},
	{
		name: "Mark the series as watched",
		text: "Open the three-dot menu in the top right and choose Mark Series as Watched.",
	},
	{
		name: "Delete that show from History if the card stays",
		text: "Click your avatar, choose History, and use the trash icon on that show’s episodes.",
	},
];

export default function HowToRemoveShowsFromContinueWatchingPage() {
	const relatedGuideLinks = getGuideLinks({
		includeTags: ["pillar-watch-crunchyroll"],
		excludeHref: PAGE_PATH,
		limit: 4,
	});

	return (
		<>
			<HowToJsonLd
				name="How to remove shows from Continue Watching on Crunchyroll"
				description="Mark a Crunchyroll series as watched, or delete its episodes from History, so it leaves Continue Watching."
				steps={howToSteps}
			/>
			<SeoPageLayout
				breadcrumbs={[
					{ name: "Home", url: "/" },
					{
						name: "Watch Crunchyroll Together",
						url: "/watch-crunchyroll-together",
					},
					{
						name: "Remove from Continue Watching",
						url: PAGE_PATH,
					},
				]}
				title="How to remove shows from Continue Watching on Crunchyroll"
				description="Mark a series as watched, or delete its episodes from Crunchyroll History."
				url={PAGE_PATH}
				datePublished="2026-10-07"
				dateModified="2026-10-08"
				faq={faq}
				headings={tocHeadings}
				articleImage={articleImage}
				aboveFoldCta
			>
				<SeoGuideTitle>
					How to Remove Shows from Continue Watching on Crunchyroll
				</SeoGuideTitle>

				<h2 id="answer" className="scroll-mt-24">
					Short answer
				</h2>
				<SeoGuideAnswer>
					<p>
						Open the series page, use the three-dot menu in the top right, and
						choose <strong>Mark Series as Watched</strong>. Crunchyroll
						documents that as the way to update a show so Continue Watching
						stops offering the next episode. If the card stays, click your
						avatar, open <strong>History</strong>, and delete that show’s
						episodes with the trash icon. <strong>Clear History</strong> on the
						same page removes every title, including shows you are still
						watching.
					</p>
				</SeoGuideAnswer>

				<h2
					id="remove-one"
					className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
				>
					Remove one show
				</h2>
				<p className="text-foreground/80 leading-relaxed mb-4">
					Continue Watching is the homepage row of series you started. History,
					under your avatar, is the episode list behind that row. Marking a
					series as watched updates progress. Deleting history entries removes
					those episodes from the record.
				</p>
				<SeoGuideSteps steps={howToSteps} />
				<p className="text-foreground/80 leading-relaxed mb-4">
					For a single episode, open Continue Watching or the series page, use
					the three-dot menu on that episode, and choose Mark as Watched. For a
					season, open the season menu on the show page and choose Mark Season
					as Watched. On iPhone, Crunchyroll also documents a long-press, then
					Mark as Watched, from the home page and from watch history.
				</p>
				<p className="text-foreground/80 leading-relaxed mb-8">
					Steps checked against Crunchyroll Help on 7 October 2026:{" "}
					<a
						href={MARK_WATCHED_HELP}
						className="text-brand-orange hover:underline"
						rel="noopener noreferrer"
						target="_blank"
					>
						How do I mark episodes, seasons, and shows as watched?
					</a>{" "}
					(published 28 August 2026) and{" "}
					<a
						href={HISTORY_HELP}
						className="text-brand-orange hover:underline"
						rel="noopener noreferrer"
						target="_blank"
					>
						Getting started on the Crunchyroll website
					</a>
					. AniDachi is not affiliated with Crunchyroll.
				</p>

				<h2
					id="clear-history"
					className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
				>
					Clear watch history
				</h2>
				<ol className="list-decimal pl-6 space-y-2 text-foreground/80 mb-4">
					<li>Log in on the Crunchyroll website.</li>
					<li>Click your avatar, then History.</li>
					<li>
						Click Clear History. A confirmation message appears at the top of
						the screen.
					</li>
				</ol>
				<p className="text-foreground/80 leading-relaxed mb-8">
					The trash icon under an episode deletes that episode. Clear History
					deletes the whole list. Use the trash icon when you still want other
					shows on Continue Watching. Clear History is on the History page. It
					does not open membership or payment settings. The click-by-click
					version is{" "}
					<Link
						href="/guides/how-to-clear-watch-history-on-crunchyroll"
						className="text-brand-orange hover:underline"
					>
						how to clear watch history on Crunchyroll
					</Link>
					. What the History page stores is{" "}
					<Link
						href="/crunchyroll-watch-history"
						className="text-brand-orange hover:underline"
					>
						Crunchyroll watch history
					</Link>
					.
				</p>

				<h2
					id="stuck"
					className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
				>
					If the card stays
				</h2>
				<p className="text-foreground/80 leading-relaxed mb-8">
					Crunchyroll’s help articles do not list a separate Remove button on
					the homepage card. People on the Crunchyroll subreddit report that a
					finished show can remain after Mark as Watched. The workaround they
					describe is to play the last episode through the credits, or to delete
					every episode of that series from History. Try Mark Series as Watched
					first, then the trash icons, then the last-episode play-through.
				</p>

				<h2
					id="resume"
					className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
				>
					AniDachi Resume
				</h2>
				<p className="text-foreground/80 leading-relaxed mb-4">
					<Link
						href="/account/watch-library"
						className="text-brand-orange hover:underline"
					>
						Watch Library
					</Link>{" "}
					stores episode progress from Crunchyroll and YouTube watchrooms on
					your AniDachi account, with Resume. Crunchyroll’s History and Continue
					Watching controls leave that library as it is.
				</p>
				<p className="text-foreground/80 leading-relaxed mb-4">
					Recording and editing that progress need your own Plus or Pro access,
					including a trial. Saved history, Resume, and deletion stay available
					on Free. Automatic recording also needs permission in the extension.
					Install from{" "}
					<Link href="/extension" className="text-brand-orange hover:underline">
						the AniDachi install page
					</Link>
					. Plan sizes are on{" "}
					<Link href="/pricing" className="text-brand-orange hover:underline">
						pricing
					</Link>
					. Watchrooms themselves are on{" "}
					<Link
						href="/watch-crunchyroll-together"
						className="text-brand-orange hover:underline"
					>
						Crunchyroll watch party
					</Link>
					. Picking the saved episode back up is{" "}
					<Link
						href="/guides/resume-anime"
						className="text-brand-orange hover:underline"
					>
						resume anime
					</Link>
					. Series and season menus are on{" "}
					<Link
						href="/guides/how-to-remove-anime-from-continue-watching-on-crunchyroll"
						className="text-brand-orange hover:underline"
					>
						how to remove anime from Continue Watching
					</Link>
					.
				</p>

				<h2 id="related" className="scroll-mt-24">
					Related guides
				</h2>
				<SeoGuideRelated
					links={[
						{
							href: "/watch-crunchyroll-together",
							label: "Crunchyroll watch party",
						},
						{
							href: "/guides/how-to-watch-crunchyroll-with-friends",
							label: "How to watch Crunchyroll with friends",
						},
						{
							href: "/extension",
							label: "Install AniDachi",
						},
						{
							href: "/pricing",
							label: "Plus and Pro pricing",
						},
						...relatedGuideLinks.map((guide) => ({
							href: guide.href,
							label: guide.label,
						})),
					]}
				/>
			</SeoPageLayout>
		</>
	);
}
