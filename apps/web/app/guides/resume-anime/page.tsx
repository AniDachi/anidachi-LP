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

const PAGE_PATH = "/guides/resume-anime";
const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

const howToSteps = [
	{
		name: "Record with Plus or Pro",
		text: "Your own Plus or Pro access, including a trial, plus recording permission in the extension, saves episode progress. YouTube has a separate recording switch.",
	},
	{
		name: "Open Watch Library",
		text: "Saved history stays available on Free. Open Watch Library on the website, or Watch in the extension menu.",
	},
	{
		name: "Resume the episode",
		text: "Choose the saved title. Resume opens the spot that was stored. Deleting a saved title is also available on Free.",
	},
];

export const metadata: Metadata = {
	title: "Resume Anime — Pick Up a Saved Crunchyroll or YouTube Episode",
	description:
		"Resume anime from AniDachi Watch Library. Plus or Pro records the episode. Free accounts can open saved history and Resume.",
	alternates: { canonical: PAGE_PATH },
	openGraph: {
		title: "Resume Anime",
		description:
			"Saved episode progress from Crunchyroll and YouTube watchrooms.",
		url: PAGE_PATH,
		images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Resume Anime",
		description:
			"Plus or Pro records it. Free can resume what is already saved.",
		images: ["/opengraph-image.png"],
	},
};

const faq = [
	{
		question: "How do I resume an anime I already started?",
		answer:
			"Open Watch Library, or Watch in the extension menu, and choose the saved title. Resume uses the episode progress AniDachi stored from a watchroom.",
	},
	{
		question: "Who can record progress?",
		answer:
			"Recording and editing need your own Plus or Pro access, including a trial, and recording permission in the extension. YouTube recording has a separate switch. Saved history, Resume, and deletion stay available on Free.",
	},
	{
		question: "Is this Crunchyroll Continue Watching?",
		answer:
			"No. Crunchyroll's homepage row is Crunchyroll's list. AniDachi Resume reads Watch Library on your AniDachi account.",
	},
	{
		question: "Does Resume sync a score list?",
		answer:
			"No. Watch Library stores titles and episodes from Crunchyroll and YouTube watchrooms. It does not sync MyAnimeList scores or plan-to-watch lists.",
	},
];

const tocHeadings: TocHeading[] = [
	{ id: "answer", label: "Short answer", level: 2 },
	{ id: "steps", label: "How to resume", level: 2 },
	{ id: "crunchyroll", label: "Crunchyroll's row", level: 2 },
	{ id: "faq", label: "FAQ", level: 2 },
];

export default function ResumeAnimePage() {
	return (
		<>
			<HowToJsonLd
				name="How to resume anime in AniDachi"
				description="Record episode progress with Plus or Pro, then resume it from Watch Library."
				steps={howToSteps}
			/>
			<SeoPageLayout
				breadcrumbs={[
					{ name: "Home", url: "/" },
					{
						name: "Watch Crunchyroll Together",
						url: "/watch-crunchyroll-together",
					},
					{ name: "Resume anime", url: PAGE_PATH },
				]}
				title="Resume anime"
				description="Pick up a saved Crunchyroll or YouTube episode from Watch Library."
				url={PAGE_PATH}
				datePublished="2026-10-08"
				dateModified="2026-10-08"
				faq={faq}
				headings={tocHeadings}
				articleImage={articleImage}
				aboveFoldCta
			>
				<SeoGuideTitle>Resume anime</SeoGuideTitle>
				<h2 id="answer" className="scroll-mt-24">
					Short answer
				</h2>
				<SeoGuideAnswer>
					<p>
						Resume opens the episode saved in AniDachi Watch Library. Plus or
						Pro, with recording permission, writes that progress. Once it is
						saved, a Free account can open it, resume, and delete it.
						Crunchyroll's Continue Watching row is a separate list.
					</p>
				</SeoGuideAnswer>
				<h2
					id="steps"
					className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
				>
					How to resume
				</h2>
				<SeoGuideSteps steps={howToSteps} />
				<p className="mb-8 leading-relaxed text-ani-muted">
					The library is at{" "}
					<Link
						href="/account/watch-library"
						className="text-brand-orange hover:underline"
					>
						Watch Library
					</Link>
					. Install from{" "}
					<Link href="/extension" className="text-brand-orange hover:underline">
						the install page
					</Link>
					. The broader progress page is{" "}
					<Link
						href="/anime-tracker"
						className="text-brand-orange hover:underline"
					>
						anime tracker
					</Link>
					. Prices are on{" "}
					<Link href="/pricing" className="text-brand-orange hover:underline">
						pricing
					</Link>
					.
				</p>
				<h2
					id="crunchyroll"
					className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
				>
					Crunchyroll's row
				</h2>
				<p className="mb-8 leading-relaxed text-ani-muted">
					Cleaning Continue Watching does not move your AniDachi spot. Those
					Crunchyroll steps are on{" "}
					<Link
						href="/guides/how-to-remove-shows-from-continue-watching-on-crunchyroll"
						className="text-brand-orange hover:underline"
					>
						how to remove shows from Continue Watching
					</Link>
					.
				</p>
				<SeoGuideRelated
					links={[
						{ href: "/anime-tracker", label: "Anime tracker" },
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
